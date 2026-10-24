import { describe, it, expect, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../workspace-fixtures";
import { createHandler } from "../../services/api/src/http";
const event = (
  path: string,
  method = "GET",
  body: unknown = {},
  sub = "customer-a",
) =>
  ({
    rawPath: path,
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
    requestContext: {
      requestId: "r-test",
      http: { method, sourceIp: "192.0.2.1" },
      authorizer: {
        jwt: {
          claims: {
            sub,
            token_use: "access",
            scope: "openid azelvori/access aws.cognito.signin.user.admin",
          },
        },
      },
    },
  }) as unknown as APIGatewayProxyEventV2;
async function setup() {
  const f = await workspaceFixture();
  await f.join(f.a);
  const handle = createHandler(f.leads, {
    intakeEnabled: false,
    allowedOrigin: "https://studio.example",
    workspace: f.service,
  });
  return { ...f, handle };
}
describe("authenticated workspace HTTP routes", () => {
  it("returns persisted project/messages and no-store headers", async () => {
    const f = await setup();
    const e = event(
      `/api/v1/projects/${f.project.projectId}/messages`,
      "POST",
      { text: "hello" },
    );
    const res = await f.handle(e);
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body!).status).toBe("PERSISTED");
    expect(res.headers?.["cache-control"]).toBe("no-store");
    const list = await f.handle(
      event(`/api/v1/projects/${f.project.projectId}/messages`),
    );
    expect(JSON.parse(list.body!).items).toHaveLength(1);
    expect(
      (await f.handle(event(`/api/v1/projects/${f.project.projectId}`)))
        .statusCode,
    ).toBe(200);
  });
  it("accepts Cognito native USER_PASSWORD_AUTH access scope for /me and owned messages", async () => {
    const f = await setup();
    const me = event("/api/v1/me");
    (me.requestContext as any).authorizer.jwt.claims.scope = "aws.cognito.signin.user.admin";
    const identity = await f.handle(me);
    expect(identity.statusCode).toBe(200);
    expect(JSON.parse(identity.body!).userId).toBe(f.a.sub);
    const messages = event(`/api/v1/projects/${f.project.projectId}/messages`, "GET", {}, f.a.sub);
    (messages.requestContext as any).authorizer.jwt.claims.scope = "aws.cognito.signin.user.admin";
    expect((await f.handle(messages)).statusCode).toBe(200);
    const foreign = event(`/api/v1/projects/${f.project.projectId}`, "GET", {}, f.b.sub);
    (foreign.requestContext as any).authorizer.jwt.claims.scope = "aws.cognito.signin.user.admin";
    expect((await f.handle(foreign)).statusCode).toBe(404);
  });
  it("native Cognito scope never grants admin access to customers", async () => {
    const f = await setup();
    const req = event("/api/v1/admin/projects", "POST", {
      leadId: "nonexistent", title: "Unauthorized", summary: "Unauthorized",
    }, f.a.sub);
    (req.requestContext as any).authorizer.jwt.claims.scope = "aws.cognito.signin.user.admin";
    expect((await f.handle(req)).statusCode).toBe(403);
  });
  it("never trusts a bearer header without validated gateway claims", async () => {
    const f = await setup();
    const e = event("/api/v1/projects");
    delete (e.requestContext as any).authorizer;
    expect((await f.handle(e)).statusCode).toBe(401);
  });
  it.each([{ token_use: "id" }, { scope: "openid" }, { scope: "aws.cognito.signin.user.admin-extra" }, { scope: "" }])(
    "rejects invalid access claims %j",
    async (patch) => {
      const f = await setup();
      const e = event("/api/v1/projects");
      Object.assign((e.requestContext as any).authorizer.jwt.claims, patch);
      expect((await f.handle(e)).statusCode).toBe(401);
    },
  );
  it("returns uniform 404 for unowned or nonexistent projects", async () => {
    const f = await setup();
    for (const id of [f.project.projectId, randomUUID()]) {
      const res = await f.handle(
        event(`/api/v1/projects/${id}`, "GET", {}, f.b.sub),
      );
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body!).error.code).toBe("NOT_FOUND");
    }
  });
  it("requires versions and founder authorization for mutations", async () => {
    const f = await setup(),
      path = `/api/v1/admin/projects/${f.project.projectId}`;
    expect(
      (await f.handle(event(path, "PATCH", { state: "PAUSED" }, f.founder.sub)))
        .statusCode,
    ).toBe(428);
    const e = event(path, "PATCH", { state: "PAUSED" });
    e.headers["if-match"] = "1";
    expect((await f.handle(e)).statusCode).toBe(403);
  });
  it("rejects malformed bodies and unknown private routes", async () => {
    const f = await setup(),
      e = event(`/api/v1/projects/${f.project.projectId}/messages`, "POST");
    e.body = "{";
    expect((await f.handle(e)).statusCode).toBe(400);
    expect(
      (
        await f.handle(
          event(`/api/v1/projects/${f.project.projectId}/internal-messages`),
        )
      ).statusCode,
    ).toBe(404);
  });
  it("supports explicit email verification without granting memberships", async () => {
    const f = await setup();
    f.identity.identities.get(f.b.sub)!.emailVerified = false;
    const requested = await f.handle(
      event("/api/v1/me/email/request", "POST", {}, f.b.sub),
    );
    expect(JSON.parse(requested.body!).status).toBe("CODE_SENT");
    const verified = await f.handle(
      event("/api/v1/me/email/verify", "POST", { code: "123456" }, f.b.sub),
    );
    expect(JSON.parse(verified.body!).emailVerified).toBe(true);
    expect((await f.service.list(f.b)).items).toEqual([]);
  });
  it("sanitizes identity provider failures without exposing email or tokens", async () => {
    const f = await setup();
    vi.spyOn(f.identity, "current").mockRejectedValue(
      new Error("private-email@example.com token-secret"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await f.handle(event("/api/v1/me"));
      expect(res.statusCode).toBe(500);
      expect(res.body).not.toContain("private-email");
      expect(JSON.stringify(log.mock.calls)).not.toContain("token-secret");
    } finally {
      log.mockRestore();
    }
  });
});
