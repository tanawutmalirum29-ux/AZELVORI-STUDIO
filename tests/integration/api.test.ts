import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { MemoryRepository, validLead } from "../fixtures";
import { createHandler } from "../../services/api/src/http";
import { submitLead, updateLeadStatus } from "../../services/api/src/domain";
function event(
  path = "/api/v1/leads",
  method = "POST",
  body: unknown = validLead,
  claims?: Record<string, unknown>,
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers: {
      origin: "https://studio.example",
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "studio.example",
      domainPrefix: "studio",
      stage: "test",
      time: "23/Oct/2026:12:00:00 +0000",
      timeEpoch: 1792756800000,
      routeKey: `${method} ${path}`,
      requestId: "test-request",
      http: {
        method,
        sourceIp: "192.0.2.1",
        path,
        protocol: "HTTP/1.1",
        userAgent: "test",
      },
      ...(claims ? { authorizer: { jwt: { claims } } } : {}),
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}
const staffClaims = {
  sub: "founder",
  token_use: "access",
  scope: "openid azelvori/access",
};
const config = { intakeEnabled: true, allowedOrigin: "https://studio.example" };
describe("HTTP integration / public and admin boundaries", () => {
  it("persists a brief before issuing a receipt", async () => {
    const r = new MemoryRepository();
    const result = await createHandler(r, config)(event());
    expect(result.statusCode).toBe(202);
    const receipt = JSON.parse(result.body!);
    expect(r.leads.has(receipt.leadId)).toBe(true);
    expect(r.audit).toHaveLength(1);
    expect(result.body).not.toContain("test@example.com");
  });
  it("closed intake fails closed and never stores data", async () => {
    const r = new MemoryRepository();
    expect(
      (await createHandler(r, { ...config, intakeEnabled: false })(event()))
        .statusCode,
    ).toBe(503);
    expect(r.leads.size).toBe(0);
  });
  it("denies untrusted origins", async () => {
    const r = new MemoryRepository(),
      e = event();
    e.headers.origin = "https://evil.example";
    expect((await createHandler(r, config)(e)).statusCode).toBe(403);
    expect(r.leads.size).toBe(0);
  });
  it.each(["", "abc", "123"])(
    "requires unpredictable UUID idempotency key: %s",
    async (key) => {
      const e = event();
      e.headers["idempotency-key"] = key;
      expect(
        (await createHandler(new MemoryRepository(), config)(e)).statusCode,
      ).toBe(400);
    },
  );
  it("rejects honeypot submissions", async () => {
    const r = new MemoryRepository();
    expect(
      (
        await createHandler(
          r,
          config,
        )(event(undefined, undefined, { ...validLead, website: "spam" }))
      ).statusCode,
    ).toBe(422);
    expect(r.leads.size).toBe(0);
  });
  it("same request repeated ten times returns one receipt and one audit", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config),
      e = event();
    const ids = [];
    for (let i = 0; i < 10; i++) {
      const res = await h(e);
      expect(res.statusCode).toBe(202);
      ids.push(JSON.parse(res.body!).leadId);
    }
    expect(new Set(ids).size).toBe(1);
    expect(r.leads.size).toBe(1);
    expect(r.audit).toHaveLength(1);
  });
  it("concurrent duplicates are atomic", async () => {
    const r = new MemoryRepository(),
      key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        submitLead(r, validLead, key, "192.0.2.1"),
      ),
    );
    expect(new Set(results.map((r) => r.leadId)).size).toBe(1);
    expect(r.leads.size).toBe(1);
    expect(r.audit).toHaveLength(1);
  });
  it("same key with a changed body conflicts", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config),
      e = event();
    await h(e);
    e.body = JSON.stringify({ ...validLead, title: "Different project" });
    expect((await h(e)).statusCode).toBe(409);
    expect(r.leads.size).toBe(1);
  });
  it("limits fresh requests and supplies retry guidance", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config);
    for (let i = 0; i < 5; i++) expect((await h(event())).statusCode).toBe(202);
    const blocked = await h(event());
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers?.["retry-after"]).toBe("60");
  });
  it("rejects malformed JSON, non-JSON and oversized payloads", async () => {
    const h = createHandler(new MemoryRepository(), config),
      e = event();
    e.body = "{";
    expect((await h(e)).statusCode).toBe(400);
    e.headers["content-type"] = "text/plain";
    expect((await h(e)).statusCode).toBe(415);
    e.headers["content-type"] = "application/json";
    e.body = "x".repeat(41000);
    expect((await h(e)).statusCode).toBe(413);
  });
  it("checks decoded UTF-8 byte size for base64 requests", async () => {
    const h = createHandler(new MemoryRepository(), config),
      e = event();
    e.isBase64Encoded = true;
    e.body = Buffer.from(
      JSON.stringify({ ...validLead, description: "ก".repeat(10000) }),
    ).toString("base64");
    expect((await h(e)).statusCode).toBe(413);
  });
  it("anonymous, forged header, ID-token and missing scope cannot read CRM", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config);
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    for (const claims of [
      undefined,
      { ...staffClaims, token_use: "id" },
      { ...staffClaims, scope: "openid" },
    ]) {
      const e = event("/api/v1/admin/leads", "GET", {}, claims);
      e.headers.authorization = "Bearer forged-token";
      expect((await h(e)).statusCode).toBe(401);
    }
  });
  it.each(["customer-A", "customer-B", "developer", "qa"])(
    "does not expose CRM to %s despite valid access token",
    async (sub) => {
      const r = new MemoryRepository(),
        h = createHandler(r, config);
      await h(event());
      const result = await h(
        event("/api/v1/admin/leads", "GET", {}, { ...staffClaims, sub }),
      );
      expect(result.statusCode).toBe(403);
      expect(result.body).not.toContain(validLead.contactEmail);
    },
  );
  it("rechecks revoked staff grants on every request", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config);
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    const e = event("/api/v1/admin/leads", "GET", {}, staffClaims);
    expect((await h(e)).statusCode).toBe(200);
    r.staff.get("founder")!.active = false;
    expect((await h(e)).statusCode).toBe(403);
  });
  it("manager grant does not imply founder access", async () => {
    const r = new MemoryRepository();
    r.staff.set("founder", {
      userId: "founder",
      role: "PROJECT_MANAGER",
      active: true,
    });
    expect(
      (
        await createHandler(
          r,
          config,
        )(event("/api/v1/admin/leads", "GET", {}, staffClaims))
      ).statusCode,
    ).toBe(403);
  });
  it("versioned status update writes an audit and rejects stale data", async () => {
    const r = new MemoryRepository();
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    const receipt = await submitLead(r, validLead, randomUUID(), "192.0.2.1");
    await updateLeadStatus(r, receipt.leadId, "ACKNOWLEDGED", 1, "founder");
    expect(r.leads.get(receipt.leadId)?.version).toBe(2);
    expect(r.audit).toHaveLength(2);
    await expect(
      updateLeadStatus(r, receipt.leadId, "DISCOVERY", 1, "founder"),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });
  it("requires If-Match on mutations", async () => {
    const r = new MemoryRepository();
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    expect(
      (
        await createHandler(
          r,
          config,
        )(
          event(
            "/api/v1/admin/leads/LEAD-TEST",
            "PATCH",
            { status: "LOST" },
            staffClaims,
          ),
        )
      ).statusCode,
    ).toBe(428);
  });
  it("stores private follow-up with versioning, links existing projects and exposes nothing to customers", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config);
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    const receipt = JSON.parse((await h(event())).body!);
    const path = `/api/v1/admin/leads/${receipt.leadId}`;
    vi.spyOn(r, "getLeadProject").mockResolvedValue(
      "11111111-1111-4111-8111-111111111111",
    );
    const followUp = {
      note: "Private discussion <script>literal</script>",
      priority: "HIGH",
      followUpDate: "2026-11-01",
    };
    const e = event(path, "PATCH", { followUp }, staffClaims);
    e.headers["if-match"] = "1";
    const response = await h(e);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!)).toMatchObject({
      version: 2,
      followUp,
      status: "NEW",
    });
    expect((await h(e)).statusCode).toBe(409);
    const detail = JSON.parse(
      (await h(event(path, "GET", {}, staffClaims))).body!,
    );
    expect(detail.projectId).toBe("11111111-1111-4111-8111-111111111111");
    expect(detail.lead.followUp.note).toBe(followUp.note);
    const forbidden = await h(
      event(path, "GET", {}, { ...staffClaims, sub: "customer" }),
    );
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).not.toContain("Private discussion");
    expect(JSON.stringify(r.audit)).not.toContain(followUp.note);
  });
  it.each([
    { note: "x".repeat(5001), priority: "HIGH", followUpDate: "" },
    { note: "hello", priority: "HIGH", followUpDate: "2026-02-30" },
    { note: "hello", priority: "ADMIN", followUpDate: "" },
    {
      note: "hello",
      priority: "NORMAL",
      followUpDate: "",
      updatedAt: "forged",
    },
  ])("rejects malformed follow-up without writes", async (followUp) => {
    const r = new MemoryRepository(),
      h = createHandler(r, config);
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    const receipt = JSON.parse((await h(event())).body!);
    const e = event(
      `/api/v1/admin/leads/${receipt.leadId}`,
      "PATCH",
      { followUp },
      staffClaims,
    );
    e.headers["if-match"] = "1";
    expect((await h(e)).statusCode).toBe(422);
    expect(r.audit).toHaveLength(1);
  });
  it("does not write follow-up when staff is revoked between authorization and commit", async () => {
    const r = new MemoryRepository(),
      h = createHandler(r, config);
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    const receipt = JSON.parse((await h(event())).body!);
    const save = r.saveFollowUp.bind(r);
    vi.spyOn(r, "saveFollowUp").mockImplementation(async (...args) => {
      r.staff.get("founder")!.active = false;
      return save(...args);
    });
    const e = event(
      `/api/v1/admin/leads/${receipt.leadId}`,
      "PATCH",
      { followUp: { note: "private", priority: "NORMAL", followUpDate: "" } },
      staffClaims,
    );
    e.headers["if-match"] = "1";
    expect((await h(e)).statusCode).toBe(409);
    expect(r.audit).toHaveLength(1);
    expect(r.leads.get(receipt.leadId)?.followUp).toBeUndefined();
  });
  it("rejects skipping the commercial workflow", async () => {
    const r = new MemoryRepository();
    const receipt = await submitLead(r, validLead, randomUUID(), "192.0.2.1");
    await expect(
      updateLeadStatus(r, receipt.leadId, "WON", 1, "founder"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
  it("only one concurrent update succeeds", async () => {
    const r = new MemoryRepository();
    r.staff.set("founder", {
      userId: "founder",
      role: "FOUNDER_ADMIN",
      active: true,
    });
    const receipt = await submitLead(r, validLead, randomUUID(), "192.0.2.1");
    const result = await Promise.allSettled([
      updateLeadStatus(r, receipt.leadId, "ACKNOWLEDGED", 1, "founder"),
      updateLeadStatus(r, receipt.leadId, "LOST", 1, "founder"),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(r.audit).toHaveLength(2);
  });
  it.each([
    "/api/v1/projects/customer-B",
    "/api/v1/conversations/private/messages",
    "/api/v1/invoices/paid/checkout",
  ])(
    "unimplemented private API %s never falls back to demo data",
    async (path) => {
      const result = await createHandler(
        new MemoryRepository(),
        config,
      )(event(path, "GET"));
      expect(result.statusCode).toBe(404);
    },
  );
  it("storage errors return no PII or exception details", async () => {
    const r = new MemoryRepository();
    vi.spyOn(r, "createLead").mockRejectedValue(
      new Error("secret=test@example.com"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createHandler(r, config)(event());
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain("secret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("test@example.com");
    log.mockRestore();
  });
});
