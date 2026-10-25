import { parseBody } from "./request";
import { workspaceRoute } from "./workspace-http";
import { employeeRoute } from "./employee-http";
import type { EmployeeService } from "./employees";
import { hasValidatedAccessClaims } from "./access-claims";
import type { WorkspaceService } from "./workspace";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { IdempotencyKeySchema, LeadUpdateSchema, PRIVACY_VERSION } from "@azelvori/contracts";
import {
  authorizeStaff,
  HttpError,
  submitLead,
  updateLeadStatus,
  updateLeadFollowUp,
  type Repository,
} from "./domain";

export type ApiConfig = {
  intakeEnabled: boolean;
  pilotEnabled?: boolean;
  allowedOrigin: string;
  workspace?: WorkspaceService;
  employees?: EmployeeService;
  employeeConfig?: { poolId: string; clientId: string; region: string };
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
          schemaVersion: 2,
          capabilities: ["crm-follow-up", "private-workspace"],
          intakeEnabled: config.intakeEnabled,
          pilotEnabled: config.pilotEnabled === true,
        });
      if (path === "/api/v1/employee/config" && method === "GET" && config.employeeConfig)
        return respond(200, config.employeeConfig);
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
        if (config.employees) {
          const employeeResponse = await employeeRoute(event, config.employees, config.workspace);
          if (employeeResponse) return respond(employeeResponse.status, employeeResponse.body);
        }
        const response = await workspaceRoute(event, config.workspace);
        if (response) return respond(response.status, response.body);
      }
      if (path === "/api/v1/admin/pilot/leads" && method === "POST") {
        if (!config.pilotEnabled || config.intakeEnabled)
          throw new HttpError(404, "NOT_FOUND", "โหมดทดสอบนี้ไม่ได้เปิดใช้งาน");
        if (event.headers.origin !== config.allowedOrigin)
          throw new HttpError(403, "ORIGIN_DENIED", "ไม่อนุญาตคำขอจากเว็บไซต์นี้");
        // Only the JWT authorizer's verified access claims can identify the founder.
        const jwt = (
          event.requestContext as APIGatewayProxyEventV2["requestContext"] & {
            authorizer?: { jwt?: { claims?: Record<string, unknown> } };
          }
        ).authorizer?.jwt?.claims;
        if (!hasValidatedAccessClaims(jwt))
          throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
        await authorizeStaff(repo, jwt.sub);
        const key = IdempotencyKeySchema.safeParse(event.headers["idempotency-key"]);
        if (!key.success)
          throw new HttpError(400, "INVALID_KEY", "คำขอขาดรหัสยืนยัน");
        // The server, not the browser, constructs a clearly labelled synthetic
        // lead. Never accept real names, emails or project descriptions here.
        // Identical idempotency keys produce identical stored bodies on retries.
        const pilotLead = {
          serviceType: "WEBSITE",
          title: "[TEST PILOT] เว็บไซต์ทดสอบ " + key.data.slice(0, 8),
          description: "ข้อมูลจำลองสำหรับทดสอบระบบรับบรีฟ คิวงาน และโปรเจกต์จริงบน Staging เท่านั้น ไม่ใช่งานลูกค้าและไม่เรียกเก็บเงิน",
          platform: "Web / iOS / Android",
          engine: "",
          expected: "",
          actual: "",
          reproduction: "",
          severity: "MEDIUM",
          budget: "DISCUSS",
          timeline: "FLEXIBLE",
          targetDate: "",
          referenceUrl: "",
          contactName: "AZELVORI TEST PILOT",
          contactEmail: "pilot@example.com",
          privacyAcknowledged: true,
          privacyVersion: PRIVACY_VERSION,
          rightsConfirmed: true,
          website: "",
        };
        return respond(202, await submitLead(
          repo, pilotLead, key.data, "pilot:" + jwt.sub,
        ));
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
        if (!hasValidatedAccessClaims(jwt))
          throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
        await authorizeStaff(repo, jwt.sub);
        if (path === "/api/v1/admin/leads" && method === "GET")
          return respond(
            200,
            await repo.listLeads(event.queryStringParameters?.cursor),
          );
        const leadId = path.split("/").at(-1)!;
        if (method === "GET") {
          const lead = await repo.getLead(leadId);
          if (!lead) throw new HttpError(404, "NOT_FOUND", "ไม่พบบรีฟ");
          const projectId = await repo.getLeadProject(leadId);
          return respond(200, { lead, ...(projectId ? { projectId } : {}) });
        }
        if (method === "PATCH" && path !== "/api/v1/admin/leads") {
          const update = LeadUpdateSchema.safeParse(parseBody(event));
          if (!update.success)
            throw new HttpError(
              422,
              "VALIDATION",
              "ตรวจสอบสถานะหรือข้อมูลติดตามบรีฟอีกครั้ง",
            );
          const rawVersion = event.headers["if-match"];
          if (!rawVersion || !/^[1-9]\d{0,8}$/.test(rawVersion))
            throw new HttpError(
              428,
              "VERSION_REQUIRED",
              "ต้องระบุเวอร์ชันบรีฟ",
            );
          return respond(
            200,
            "status" in update.data
              ? await updateLeadStatus(
                  repo,
                  leadId,
                  update.data.status,
                  Number(rawVersion),
                  jwt.sub,
                )
              : await updateLeadFollowUp(
                  repo,
                  leadId,
                  update.data.followUp,
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
