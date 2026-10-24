import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ProjectIdSchema } from "@azelvori/contracts";
import { hasValidatedAccessClaims } from "./access-claims";
import { HttpError } from "./domain";
import { parseBody } from "./request";
import type { EmployeeService } from "./employees";
import type { WorkspaceService } from "./workspace";

type JwtClaims = Record<string, unknown> | undefined;
function claimsFrom(event: APIGatewayProxyEventV2): JwtClaims {
  return (event.requestContext as APIGatewayProxyEventV2["requestContext"] & {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  }).authorizer?.jwt?.claims;
}
export async function employeeRoute(
  event: APIGatewayProxyEventV2,
  employee: EmployeeService,
  workspace: WorkspaceService,
) {
  const path = event.rawPath, method = event.requestContext.http.method;
  const isAdmin = path === "/api/v1/admin/employees" ||
    /^\/api\/v1\/admin\/employees\/\d{5,}\/revoke$/.test(path);
  const isEmployee = path === "/api/v1/employee/me" ||
    path === "/api/v1/employee/projects" ||
    /^\/api\/v1\/employee\/projects\/[^/]+\/messages$/.test(path);
  if (!isAdmin && !isEmployee) return;
  const claims = claimsFrom(event);
  if (!hasValidatedAccessClaims(claims))
    throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
  const actor = { sub: claims.sub, token: event.headers.authorization?.replace(/^Bearer /i, "") ?? "" };
  const result = (body: unknown, status = 200) => ({ body, status });
  if (isAdmin) {
    if (path === "/api/v1/admin/employees" && method === "GET")
      return result(await employee.list(actor, event.queryStringParameters?.cursor));
    if (path === "/api/v1/admin/employees" && method === "POST")
      return result(await employee.create(actor, parseBody(event)), 201);
    if (method === "POST" && path.endsWith("/revoke"))
      return result(await employee.revoke(actor, path.split("/")[5]));
  }
  if (isEmployee) {
    // Only the dedicated employee Cognito user-pool JWT authorizer is attached
    // to these routes in CDK. Founder/customer JWTs cannot pass the gateway.
    if (path === "/api/v1/employee/me" && method === "GET")
      return result(await employee.active(actor));
    if (path === "/api/v1/employee/projects" && method === "GET")
      return result(await workspace.employeeProjects(actor, event.queryStringParameters?.cursor));
    const id = path.split("/")[5];
    if (!ProjectIdSchema.safeParse(id).success)
      throw new HttpError(404, "NOT_FOUND", "ไม่พบโปรเจกต์");
    if (method === "GET")
      return result(await workspace.employeeMessages(actor, id, event.queryStringParameters?.cursor));
    if (method === "POST")
      return result(await workspace.employeeSend(actor, id, parseBody(event), event.headers["idempotency-key"] ?? ""), 201);
  }
  throw new HttpError(404, "NOT_FOUND", "ไม่พบรายการที่ขอ");
}
