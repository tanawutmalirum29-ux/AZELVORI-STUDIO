import { LeadReceiptSchema } from "@azelvori/contracts";
import type {
  ApiErrorBody,
  LeadInput,
  LeadRecord,
  LeadStatus,
} from "@azelvori/contracts";
export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);
export const intakeEnabled =
  import.meta.env.VITE_PUBLIC_INTAKE_ENABLED === "true" &&
  /^https:\/\//.test(apiBase);
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  expectedStatus?: number,
): Promise<T> {
  if (!/^https:\/\//.test(apiBase))
    throw new ApiError(503, "NOT_CONFIGURED", "ยังไม่ได้เชื่อมต่อระบบ");
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "omit",
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "ไม่สามารถติดต่อระบบได้ กรุณาลองใหม่",
      error?.fields,
    );
  }
  if (expectedStatus !== undefined && response.status !== expectedStatus)
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "ระบบยังยืนยันการรับบรีฟไม่ได้ กรุณาลองใหม่ด้วยข้อมูลเดิม",
    );
  return body as T;
}
export async function sendLead(data: LeadInput, key: string) {
  const body = await api<unknown>(
    "/api/v1/leads",
    {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(data),
    },
    202,
  );
  const receipt = LeadReceiptSchema.safeParse(body);
  if (!receipt.success)
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "ระบบยังยืนยันการรับบรีฟไม่ได้ กรุณาลองใหม่ด้วยข้อมูลเดิม",
    );
  return receipt.data;
}
export const getLeads = (token: string, cursor?: string) =>
  api<{ items: LeadRecord[]; nextCursor?: string }>(
    `/api/v1/admin/leads${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
export const patchLead = (
  token: string,
  lead: LeadRecord,
  status: LeadStatus,
) =>
  api<{ version: number; status: LeadStatus }>(
    `/api/v1/admin/leads/${encodeURIComponent(lead.leadId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "If-Match": String(lead.version),
      },
      body: JSON.stringify({ status }),
    },
  );
