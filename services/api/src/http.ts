import { parseBody } from "./request";
import { workspaceRoute } from "./workspace-http";
import type { WorkspaceService } from "./workspace";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { IdempotencyKeySchema, LeadStatusSchema } from "@azelvori/contracts";
import {
  authorizeStaff,
  HttpError,
  submitLead,
  updateLeadStatus,
  type Repository,
} from "./domain";

export type ApiConfig = {
  intakeEnabled: boolean;
  allowedOrigin: string;
  workspace?: WorkspaceService;
};
export function createHandler(repo: Repository, config: ApiConfig) {
  return async (
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    const requestId = event.requestContext.requestId;
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    };
    const respond = (
      statusCode: number,
      body: unknown,
      extra?: Record<string, string>,
    ) => ({
      statusCode,
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
    const path = event.rawPath,
      method = event.requestContext.http.method;
    try {
      if (path === "/health" && method === "GET")
        return respond(200, {
          status: "ok",
          service: "azelvori-api",
          schemaVersion: 1,
        });
      if (path === "/api/v1/leads" && method === "POST") {
        if (!config.intakeEnabled)
          throw new HttpError(
            503,
            "INTAKE_CLOSED",
            "ระบบรับบรีฟยังไม่เปิดใช้งาน กรุณาเก็บร่างไว้ก่อน",
          );
        if (event.headers.origin !== config.allowedOrigin)
          throw new HttpError(
            403,
            "ORIGIN_DENIED",
            "ไม่อนุญาตคำขอจากเว็บไซต์นี้",
          );
        const key = IdempotencyKeySchema.safeParse(
          event.headers["idempotency-key"],
        );
        if (!key.success)
          throw new HttpError(
            400,
            "INVALID_KEY",
            "คำขอขาดรหัสยืนยัน กรุณาโหลดหน้าใหม่",
          );
        return respond(
          202,
          await submitLead(
            repo,
            parseBody(event),
            key.data,
            event.requestContext.http.sourceIp,
          ),
        );
      }
      if (config.workspace) {
        const response = await workspaceRoute(event, config.workspace);
        if (response) return respond(response.status, response.body);
      }
      if (
        path === "/api/v1/admin/leads" ||
        /^\/api\/v1\/admin\/leads\/[^/]+$/.test(path)
      ) {
        // Only API Gateway's validated JWT context is trusted. Never decode an Authorization header here.
        const jwt = (
          event.requestContext as APIGatewayProxyEventV2["requestContext"] & {
            authorizer?: { jwt?: { claims?: Record<string, unknown> } };
          }
        ).authorizer?.jwt?.claims;
        const scopes =
          typeof jwt?.scope === "string" ? jwt.scope.split(" ") : [];
        if (
          typeof jwt?.sub !== "string" ||
          jwt.token_use !== "access" ||
          !scopes.includes("azelvori/access")
        )
          throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
        await authorizeStaff(repo, jwt.sub);
        if (path === "/api/v1/admin/leads" && method === "GET")
          return respond(
            200,
            await repo.listLeads(event.queryStringParameters?.cursor),
          );
        if (method === "PATCH") {
          const status = LeadStatusSchema.safeParse(parseBody(event));
          if (!status.success)
            throw new HttpError(422, "VALIDATION", "สถานะไม่ถูกต้อง");
          const rawVersion = event.headers["if-match"];
          if (!rawVersion || !/^[1-9]\d{0,8}$/.test(rawVersion))
            throw new HttpError(
              428,
              "VERSION_REQUIRED",
              "ต้องระบุเวอร์ชันบรีฟ",
            );
          return respond(
            200,
            await updateLeadStatus(
              repo,
              path.split("/").at(-1)!,
              status.data.status,
              Number(rawVersion),
              jwt.sub,
            ),
          );
        }
      }
      throw new HttpError(404, "NOT_FOUND", "ไม่พบรายการที่ขอ");
    } catch (error) {
      if (error instanceof HttpError)
        return respond(
          error.status,
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.fields ? { fields: error.fields } : {}),
            },
            requestId,
          },
          error.status === 429 ? { "retry-after": "60" } : undefined,
        );
      // No bodies, tokens, email addresses or provider exception details in application logs.
      console.error(
        JSON.stringify({
          event: "request.failed",
          requestId,
          code: "INTERNAL_ERROR",
        }),
      );
      return respond(500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่",
        },
        requestId,
      });
    }
  };
}
