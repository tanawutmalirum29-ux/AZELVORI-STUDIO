import { createHash, randomUUID } from "node:crypto";
import {
  LeadSchema,
  LEAD_TRANSITIONS,
  type LeadRecord,
  type LeadReceipt,
  type LeadStatus,
} from "@azelvori/contracts";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export type IdempotencyRecord = { hash: string; receipt: LeadReceipt };
export type StaffGrant = {
  userId: string;
  role: "FOUNDER_ADMIN" | "PROJECT_MANAGER";
  active: boolean;
};
export type LeadPage = { items: LeadRecord[]; nextCursor?: string };
export interface Repository {
  findReceipt(key: string): Promise<IdempotencyRecord | undefined>;
  consumeRate(key: string, now: number): Promise<boolean>;
  createLead(
    lead: LeadRecord,
    key: string,
    hash: string,
    receipt: LeadReceipt,
  ): Promise<boolean>;
  getStaff(userId: string): Promise<StaffGrant | undefined>;
  listLeads(cursor?: string): Promise<LeadPage>;
  getLead(leadId: string): Promise<LeadRecord | undefined>;
  changeStatus(
    lead: LeadRecord,
    status: LeadStatus,
    actor: string,
  ): Promise<boolean>;
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function submitLead(
  repo: Repository,
  body: unknown,
  key: string,
  sourceIp: string,
  now = new Date(),
): Promise<LeadReceipt> {
  const result = LeadSchema.safeParse(body);
  if (!result.success)
    throw new HttpError(
      422,
      "VALIDATION",
      "ตรวจสอบข้อมูลบรีฟอีกครั้ง",
      Object.fromEntries(
        result.error.issues.map((i) => [i.path.join("."), i.message]),
      ),
    );
  const data = result.data;
  if (data.website)
    throw new HttpError(422, "VALIDATION", "ไม่สามารถรับบรีฟนี้ได้");
  if (
    data.timeline === "SPECIFIC" &&
    data.targetDate <
      now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })
  )
    throw new HttpError(
      422,
      "VALIDATION",
      "วันที่ส่งมอบต้องไม่เป็นวันที่ผ่านมาแล้ว",
      { targetDate: "เลือกวันนี้หรือวันในอนาคต" },
    );
  const hash = digest(JSON.stringify(data));
  const idemKey = digest(key);
  const existing = await repo.findReceipt(idemKey);
  if (existing) return resolveReceipt(existing, hash);
  const rateKey = digest(`${sourceIp}|${Math.floor(now.getTime() / 60_000)}`);
  if (!(await repo.consumeRate(rateKey, now.getTime())))
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "ส่งคำขอถี่เกินไป กรุณารอ 1 นาทีแล้วลองใหม่",
    );
  const leadId = `LEAD-${now.getUTCFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const receipt: LeadReceipt = {
    leadId,
    receivedAt: now.toISOString(),
    status: "RECEIVED",
  };
  const lead: LeadRecord = {
    ...data,
    leadId,
    createdAt: now.toISOString(),
    status: "NEW",
    version: 1,
  };
  if (!(await repo.createLead(lead, idemKey, hash, receipt))) {
    const raced = await repo.findReceipt(idemKey);
    if (!raced)
      throw new HttpError(
        503,
        "RETRY",
        "ระบบยังยืนยันไม่ได้ กรุณาลองใหม่ด้วยคำขอเดิม",
      );
    return resolveReceipt(raced, hash);
  }
  return receipt;
}
function resolveReceipt(existing: IdempotencyRecord, hash: string) {
  if (existing.hash !== hash)
    throw new HttpError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "รหัสคำขอนี้ใช้กับบรีฟอื่นแล้ว",
    );
  return existing.receipt;
}
export async function authorizeStaff(
  repo: Repository,
  sub: string,
): Promise<StaffGrant> {
  const grant = await repo.getStaff(sub);
  if (!grant?.active || grant.role !== "FOUNDER_ADMIN")
    throw new HttpError(403, "FORBIDDEN", "บัญชีนี้ไม่มีสิทธิ์จัดการบรีฟ");
  return grant;
}
export async function updateLeadStatus(
  repo: Repository,
  leadId: string,
  status: LeadStatus,
  version: number,
  actor: string,
) {
  const lead = await repo.getLead(leadId);
  if (!lead) throw new HttpError(404, "NOT_FOUND", "ไม่พบบรีฟ");
  if (lead.version !== version)
    throw new HttpError(
      409,
      "STALE_VERSION",
      "บรีฟถูกเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด",
    );
  if (!LEAD_TRANSITIONS[lead.status].includes(status))
    throw new HttpError(
      409,
      "INVALID_TRANSITION",
      "เปลี่ยนสถานะตามลำดับงานเท่านั้น",
    );
  if (!(await repo.changeStatus(lead, status, actor)))
    throw new HttpError(
      409,
      "STALE_VERSION",
      "มีผู้แก้ไขพร้อมกัน กรุณาโหลดข้อมูลล่าสุด",
    );
  return { leadId, status, version: version + 1 };
}
