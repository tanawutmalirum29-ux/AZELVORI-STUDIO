import { afterEach, describe, expect, it, vi } from "vitest";
import { validLead } from "../fixtures";
const receipt = {
  leadId: "LEAD-2026-0123456789ABCDEF",
  receivedAt: "2026-10-23T10:00:00.000Z",
  status: "RECEIVED",
};
const key = "f2b989ab-5a6c-48ca-9902-7b658e7d983a";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
async function client(status: number, body: unknown) {
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  );
  return import("../../apps/web/src/lib/api");
}
describe("brief receipt verification", () => {
  it("accepts only a 202 receipt and sends the same idempotency key", async () => {
    const { sendLead } = await client(202, receipt);
    await expect(sendLead(validLead, key)).resolves.toEqual(receipt);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/leads",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": key }),
      }),
    );
  });
  it("does not treat a generic 200 response as successful intake", async () => {
    const { sendLead } = await client(200, receipt);
    await expect(sendLead(validLead, key)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it.each([
    null,
    { status: "RECEIVED" },
    { ...receipt, leadId: "invalid" },
    { ...receipt, receivedAt: "not-a-date" },
  ])("rejects malformed receipt %j", async (body) => {
    const { sendLead } = await client(202, body);
    await expect(sendLead(validLead, key)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("preserves server validation errors for the form", async () => {
    const { sendLead } = await client(422, {
      error: {
        code: "VALIDATION",
        message: "ตรวจสอบบรีฟ",
        fields: { title: "ระบุชื่อ" },
      },
    });
    await expect(sendLead(validLead, key)).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION",
      fields: { title: "ระบุชื่อ" },
    });
  });
});
