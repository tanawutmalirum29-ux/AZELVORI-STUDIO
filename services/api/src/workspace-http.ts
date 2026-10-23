import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ProjectIdSchema } from "@azelvori/contracts";
import { HttpError } from "./domain";
import { parseBody } from "./request";
import type { WorkspaceService } from "./workspace";
export async function workspaceRoute(
  e: APIGatewayProxyEventV2,
  service: WorkspaceService,
) {
  const path = e.rawPath,
    method = e.requestContext.http.method;
  const known =
    /^\/api\/v1\/(me(?:\/email\/(?:request|verify))?|projects(?:\/[^/]+(?:\/(?:messages|milestones\/[^/]+\/accept))?)?|invitations\/accept|admin\/projects(?:\/[^/]+(?:\/(?:invitations(?:\/[^/]+\/revoke)?|members(?:\/[^/]+\/revoke)?))?)?)$/.test(
      path,
    );
  if (!known) return;
  const claims = (
    e.requestContext as APIGatewayProxyEventV2["requestContext"] & {
      authorizer?: { jwt?: { claims?: Record<string, unknown> } };
    }
  ).authorizer?.jwt?.claims;
  if (
    typeof claims?.sub !== "string" ||
    claims.token_use !== "access" ||
    typeof claims.scope !== "string" ||
    !claims.scope.split(" ").includes("azelvori/access")
  )
    throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
  const actor = {
    sub: claims.sub,
    token: e.headers.authorization?.replace(/^Bearer /i, "") ?? "",
  };
  const key = () => e.headers["idempotency-key"] ?? "";
  const version = () => {
    const v = e.headers["if-match"];
    if (!v || !/^[1-9]\d{0,8}$/.test(v))
      throw new HttpError(428, "VERSION_REQUIRED", "ต้องระบุเวอร์ชันข้อมูล");
    return Number(v);
  };
  const result = (body: unknown, status = 200) => ({ body, status });
  if (path === "/api/v1/me" && method === "GET")
    return result(await service.me(actor));
  if (path === "/api/v1/me/email/request" && method === "POST")
    return result(await service.requestVerification(actor));
  if (path === "/api/v1/me/email/verify" && method === "POST")
    return result(await service.verify(actor, parseBody(e)));
  if (path === "/api/v1/invitations/accept" && method === "POST")
    return result(await service.acceptInvite(actor, parseBody(e)));
  if (path === "/api/v1/projects" && method === "GET")
    return result(await service.list(actor, e.queryStringParameters?.cursor));
  if (path === "/api/v1/admin/projects" && method === "POST")
    return result(await service.createProject(actor, parseBody(e), key()), 201);
  const parts = path.split("/");
  const admin = parts[3] === "admin",
    id = parts[admin ? 5 : 4],
    tail = parts.slice(admin ? 6 : 5);
  if (!ProjectIdSchema.safeParse(id).success)
    throw new HttpError(404, "NOT_FOUND", "ไม่พบโปรเจกต์");
  if (!admin && !tail.length && method === "GET")
    return result(await service.get(actor, id));
  if (admin && !tail.length && method === "PATCH")
    return result(await service.update(actor, id, parseBody(e), version()));
  if (!admin && tail[0] === "messages" && method === "GET")
    return result(
      await service.messages(actor, id, e.queryStringParameters?.cursor),
    );
  if (!admin && tail[0] === "messages" && method === "POST")
    return result(await service.send(actor, id, parseBody(e), key()), 201);
  if (!admin && tail[0] === "milestones" && method === "POST")
    return result(
      await service.acceptMilestone(actor, id, tail[1], version(), key()),
    );
  if (
    admin &&
    tail[0] === "invitations" &&
    tail.length === 1 &&
    method === "POST"
  )
    return result(await service.invite(actor, id, parseBody(e), key()), 201);
  if (
    admin &&
    tail[0] === "invitations" &&
    tail[2] === "revoke" &&
    method === "POST"
  )
    return result(await service.revokeInvitation(actor, id, tail[1]));
  if (admin && tail[0] === "members" && tail.length === 1 && method === "GET")
    return result(
      await service.members(actor, id, e.queryStringParameters?.cursor),
    );
  if (
    admin &&
    tail[0] === "members" &&
    tail[2] === "revoke" &&
    method === "POST"
  )
    return result(await service.revokeMember(actor, id, tail[1], version()));
  throw new HttpError(404, "NOT_FOUND", "ไม่พบรายการที่ขอ");
}
