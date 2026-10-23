import {
  PRIVACY_VERSION,
  type Lead,
  type LeadRecord,
  type LeadReceipt,
  type LeadStatus,
} from "@azelvori/contracts";
import type {
  Repository,
  IdempotencyRecord,
  StaffGrant,
} from "../services/api/src/domain";
export const validLead: Lead = {
  serviceType: "WEBSITE",
  title: "เว็บไซต์ร้านตัวอย่าง",
  description:
    "ต้องการเว็บไซต์แนะนำบริการและผลงาน รองรับมือถือและคอมพิวเตอร์ ใช้ข้อมูลสมมติในการทดสอบเท่านั้น",
  platform: "Web / Android / iOS",
  engine: "",
  expected: "",
  actual: "",
  reproduction: "",
  severity: "MEDIUM",
  budget: "DISCUSS",
  timeline: "FLEXIBLE",
  targetDate: "",
  referenceUrl: "",
  contactName: "Test Customer",
  contactEmail: "test@example.com",
  rightsConfirmed: true,
  privacyAcknowledged: true,
  privacyVersion: PRIVACY_VERSION,
  website: "",
};
export class MemoryRepository implements Repository {
  receipts = new Map<string, IdempotencyRecord>();
  leads = new Map<string, LeadRecord>();
  staff = new Map<string, StaffGrant>();
  audit: unknown[] = [];
  rates = new Map<string, number>();
  async findReceipt(key: string) {
    return this.receipts.get(key);
  }
  async consumeRate(key: string) {
    const count = this.rates.get(key) ?? 0;
    if (count >= 5) return false;
    this.rates.set(key, count + 1);
    return true;
  }
  async createLead(
    lead: LeadRecord,
    key: string,
    hash: string,
    receipt: LeadReceipt,
  ) {
    if (this.receipts.has(key)) return false;
    this.receipts.set(key, { hash, receipt });
    this.leads.set(lead.leadId, structuredClone(lead));
    this.audit.push({ action: "lead.created" });
    return true;
  }
  async getStaff(id: string) {
    return this.staff.get(id);
  }
  async listLeads() {
    return { items: [...this.leads.values()] };
  }
  async getLead(id: string) {
    const lead = this.leads.get(id);
    return lead ? structuredClone(lead) : undefined;
  }
  async changeStatus(lead: LeadRecord, status: LeadStatus, actor: string) {
    const current = this.leads.get(lead.leadId);
    if (current?.version !== lead.version) return false;
    this.leads.set(lead.leadId, {
      ...current,
      status,
      version: current.version + 1,
    });
    this.audit.push({ action: "lead.status.changed", actor });
    return true;
  }
}
