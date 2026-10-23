import { z } from "zod";

export const SERVICE_TYPES = [
  "WEBSITE",
  "WEB_APP",
  "GAME_NEW",
  "GAME_BUGFIX",
  "MAINTENANCE",
] as const;
export const SERVICE_LABELS: Record<ServiceType, string> = {
  WEBSITE: "เว็บไซต์",
  WEB_APP: "เว็บแอปพลิเคชัน",
  GAME_NEW: "พัฒนาเกม",
  GAME_BUGFIX: "แก้บั๊กเกม",
  MAINTENANCE: "ดูแลและปรับปรุง",
};
export type ServiceType = (typeof SERVICE_TYPES)[number];
export const BUDGETS = [
  "UNDER_10000",
  "10000_30000",
  "30000_60000",
  "60000_PLUS",
  "DISCUSS",
] as const;
export const BUDGET_LABELS: Record<(typeof BUDGETS)[number], string> = {
  UNDER_10000: "ต่ำกว่า 10,000 บาท",
  "10000_30000": "10,000–30,000 บาท",
  "30000_60000": "30,000–60,000 บาท",
  "60000_PLUS": "60,000 บาทขึ้นไป",
  DISCUSS: "ขอคำแนะนำเรื่องงบ",
};
export const PRIVACY_VERSION = "alpha-2026-10-23";
const shortText = z.string().trim().max(200);
const optionalText = z.string().trim().max(3000).default("");
const LeadFields = z
  .object({
    serviceType: z.enum(SERVICE_TYPES),
    title: shortText.min(5, "ระบุชื่อโปรเจกต์อย่างน้อย 5 ตัวอักษร"),
    description: z
      .string()
      .trim()
      .min(30, "เล่ารายละเอียดอย่างน้อย 30 ตัวอักษร")
      .max(5000),
    platform: shortText.min(2, "ระบุแพลตฟอร์มหรือกลุ่มอุปกรณ์"),
    engine: z.string().trim().max(100).default(""),
    expected: optionalText,
    actual: optionalText,
    reproduction: optionalText,
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    budget: z.enum(BUDGETS),
    timeline: z.enum(["FLEXIBLE", "ONE_MONTH", "THREE_MONTHS", "SPECIFIC"]),
    targetDate: z.string().default(""),
    referenceUrl: z
      .string()
      .trim()
      .max(1000)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "ใช้ลิงก์ https:// ที่ไม่มีรหัสผ่าน")
      .default(""),
    contactName: z
      .string()
      .trim()
      .min(2, "ระบุชื่อที่ต้องการให้เรียก")
      .max(100),
    contactEmail: z
      .email("ตรวจสอบอีเมลอีกครั้ง")
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    privacyAcknowledged: z.literal(true, "กรุณาอ่านและรับทราบนโยบายข้อมูล"),
    privacyVersion: z.literal(PRIVACY_VERSION),
    rightsConfirmed: z.boolean(),
    website: z.string().max(200).default(""),
  })
  .strict();
type LeadFieldsOutput = z.output<typeof LeadFields>;
function validateDetails(
  data: Pick<
    LeadFieldsOutput,
    "serviceType" | "engine" | "expected" | "actual" | "reproduction"
  >,
  ctx: z.RefinementCtx,
) {
  if (data.serviceType === "GAME_BUGFIX") {
    for (const key of ["engine", "expected", "actual", "reproduction"] as const)
      if (data[key].length < 3)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "กรอกข้อมูลสำหรับวิเคราะห์บั๊ก",
        });
  }
  if (data.serviceType === "GAME_NEW" && data.engine.length < 2)
    ctx.addIssue({
      code: "custom",
      path: ["engine"],
      message: "ระบุเอนจิน หรือเลือกให้ช่วยแนะนำ",
    });
}
function validateTiming(
  data: Pick<LeadFieldsOutput, "timeline" | "targetDate">,
  ctx: z.RefinementCtx,
) {
  if (data.timeline === "SPECIFIC") {
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(data.targetDate) &&
      Number.isFinite(Date.parse(data.targetDate)) &&
      new Date(data.targetDate).toISOString().slice(0, 10) === data.targetDate;
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "เลือกวันที่ที่ถูกต้อง",
      });
  }
}
function validateRights(
  data: Pick<LeadFieldsOutput, "rightsConfirmed">,
  ctx: z.RefinementCtx,
) {
  if (!data.rightsConfirmed)
    ctx.addIssue({
      code: "custom",
      path: ["rightsConfirmed"],
      message: "ยืนยันสิทธิ์ในเนื้อหาและไฟล์ที่จะใช้",
    });
}
// Validate only the current step. Unanswered consent on a later step must
// never prevent conditional checks such as game reproduction requirements.
export const LeadDetailsSchema = LeadFields.pick({
  serviceType: true,
  title: true,
  description: true,
  platform: true,
  engine: true,
  expected: true,
  actual: true,
  reproduction: true,
})
  .strip()
  .superRefine(validateDetails);
export const LeadTimingSchema = LeadFields.pick({
  budget: true,
  timeline: true,
  targetDate: true,
})
  .strip()
  .superRefine(validateTiming);
export const LeadReferencesSchema = LeadFields.pick({
  referenceUrl: true,
  rightsConfirmed: true,
})
  .strip()
  .superRefine(validateRights);
export const LeadSchema = LeadFields.superRefine((data, ctx) => {
  validateDetails(data, ctx);
  validateTiming(data, ctx);
  validateRights(data, ctx);
});
export type LeadInput = z.input<typeof LeadSchema>;
export type Lead = z.output<typeof LeadSchema>;
export const LEAD_STATUSES = [
  "NEW",
  "ACKNOWLEDGED",
  "DISCOVERY",
  "QUALIFIED",
  "SCOPED",
  "QUOTED",
  "WON",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadRecord = Lead & {
  leadId: string;
  createdAt: string;
  status: LeadStatus;
  version: number;
};
export type LeadReceipt = {
  leadId: string;
  receivedAt: string;
  status: "RECEIVED";
};
export const LeadStatusSchema = z
  .object({ status: z.enum(LEAD_STATUSES) })
  .strict();
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ["ACKNOWLEDGED", "LOST"],
  ACKNOWLEDGED: ["DISCOVERY", "LOST"],
  DISCOVERY: ["QUALIFIED", "LOST"],
  QUALIFIED: ["SCOPED", "LOST"],
  SCOPED: ["QUOTED", "LOST"],
  QUOTED: ["WON", "LOST"],
  WON: [],
  LOST: [],
};
export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string> };
  requestId: string;
};
export const IdempotencyKeySchema = z.string().uuid();
export type Milestone = {
  id: string;
  label: string;
  weight: number;
  status: "PENDING" | "ACTIVE" | "ACCEPTED";
  detail: string;
};
export function verifiedProgress(milestones: Milestone[]): number {
  const total = milestones.reduce((sum, m) => sum + Math.max(0, m.weight), 0);
  return total
    ? Math.round(
        (milestones
          .filter((m) => m.status === "ACCEPTED")
          .reduce((sum, m) => sum + Math.max(0, m.weight), 0) /
          total) *
          100,
      )
    : 0;
}
