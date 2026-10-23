import { describe, expect, it } from "vitest";
import {
  LeadSchema,
  LeadDetailsSchema,
  LeadTimingSchema,
  LeadReferencesSchema,
  verifiedProgress,
  SERVICE_TYPES,
} from "@azelvori/contracts";
import { validLead } from "../fixtures";
describe("brief contracts", () => {
  it.each(SERVICE_TYPES)("accepts a valid %s brief", (serviceType) => {
    expect(
      LeadSchema.safeParse({
        ...validLead,
        serviceType,
        engine: "Godot 4.x",
        expected: "เกมทำงาน",
        actual: "เกมหยุด",
        reproduction: "เปิดเกมแล้วกดเริ่ม",
      }).success,
    ).toBe(true);
  });
  it("requires reproduction and engine for debugging", () => {
    const r = LeadSchema.safeParse({
      ...validLead,
      serviceType: "GAME_BUGFIX",
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining([
          "engine",
          "expected",
          "actual",
          "reproduction",
        ]),
      );
  });
  it("checks debug fields before contact and consent have been answered", () => {
    const r = LeadDetailsSchema.safeParse({
      ...validLead,
      serviceType: "GAME_BUGFIX",
      title: "",
      description: "",
      platform: "",
      contactName: "",
      contactEmail: "",
      privacyAcknowledged: false,
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining([
          "title",
          "description",
          "platform",
          "engine",
          "expected",
          "actual",
          "reproduction",
        ]),
      );
  });
  it("checks specific dates before final consent", () => {
    const r = LeadTimingSchema.safeParse({
      ...validLead,
      timeline: "SPECIFIC",
      targetDate: "",
      privacyAcknowledged: false,
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.path[0])).toContain("targetDate");
  });
  it("checks rights before final consent", () => {
    const r = LeadReferencesSchema.safeParse({
      ...validLead,
      rightsConfirmed: false,
      privacyAcknowledged: false,
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.path[0])).toContain("rightsConfirmed");
  });
  it.each([
    "javascript:alert(1)",
    "http://example.com",
    "https://name:password@example.com",
    "data:text/html,test",
  ])("rejects unsafe reference %s", (referenceUrl) => {
    expect(LeadSchema.safeParse({ ...validLead, referenceUrl }).success).toBe(
      false,
    );
  });
  it.each([
    { privacyAcknowledged: false },
    { rightsConfirmed: false },
    { privacyVersion: "old" },
    { contactEmail: "bad" },
    { description: "short" },
    { description: "x".repeat(5001) },
    { tenantId: "forged" },
    { isAdmin: true },
    { timeline: "SPECIFIC", targetDate: "2027-02-30" },
  ])("rejects invalid data: %j", (patch) => {
    expect(LeadSchema.safeParse({ ...validLead, ...patch }).success).toBe(
      false,
    );
  });
  it("normalizes email", () => {
    expect(
      LeadSchema.parse({ ...validLead, contactEmail: "TEST@EXAMPLE.COM" })
        .contactEmail,
    ).toBe("test@example.com");
  });
  it("calculates progress only from accepted milestone weights", () => {
    expect(
      verifiedProgress([
        { id: "a", label: "A", detail: "", weight: 25, status: "ACCEPTED" },
        { id: "b", label: "B", detail: "", weight: 75, status: "ACTIVE" },
      ]),
    ).toBe(25);
    expect(verifiedProgress([])).toBe(0);
  });
});
