import { z } from "zod";
import {
  IdentitySchema,
  ProjectSchema,
  ProjectPageSchema,
  MessagePageSchema,
  MessageSchema,
  MemberPageSchema,
  MemberSchema,
  InvitationReceiptSchema,
  type StudioProject,
  type ProjectMember,
} from "@azelvori/contracts";
import { api, ApiError } from "./api";
import { accessToken } from "./auth";
async function call<T>(
  schema: z.ZodType<T>,
  path: string,
  options: RequestInit = {},
  status = 200,
): Promise<T> {
  let token: string;
  try {
    token = await accessToken();
  } catch {
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
    );
  }
  const body = await api<unknown>(
    path,
    {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    },
    status,
  );
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "ระบบส่งข้อมูลไม่ครบ กรุณาโหลดใหม่",
    );
  return parsed.data;
}
const post = (body: unknown, key?: string): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: key ? { "Idempotency-Key": key } : {},
});
export const workspaceApi = {
  me: () => call(IdentitySchema, "/api/v1/me"),
  requestVerification: () =>
    call(
      z.object({ status: z.literal("CODE_SENT") }),
      "/api/v1/me/email/request",
      post({}),
    ),
  verify: (code: string) =>
    call(IdentitySchema, "/api/v1/me/email/verify", post({ code })),
  list: (cursor?: string) =>
    call(
      ProjectPageSchema,
      `/api/v1/projects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  get: (id: string) =>
    call(ProjectSchema, `/api/v1/projects/${encodeURIComponent(id)}`),
  create: (
    body: { leadId: string; title: string; summary: string },
    key: string,
  ) => call(ProjectSchema, "/api/v1/admin/projects", post(body, key), 201),
  update: (project: StudioProject, body: unknown) =>
    call(ProjectSchema, `/api/v1/admin/projects/${project.projectId}`, {
      method: "PATCH",
      headers: { "If-Match": String(project.version) },
      body: JSON.stringify(body),
    }),
  accept: (project: StudioProject, milestoneId: string, key: string) =>
    call(
      ProjectSchema,
      `/api/v1/projects/${project.projectId}/milestones/${milestoneId}/accept`,
      {
        ...post({}, key),
        headers: {
          "If-Match": String(project.version),
          "Idempotency-Key": key,
        },
      },
    ),
  messages: (id: string, cursor?: string) =>
    call(
      MessagePageSchema,
      `/api/v1/projects/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  send: (id: string, text: string, key: string) =>
    call(
      MessageSchema,
      `/api/v1/projects/${id}/messages`,
      post({ text }, key),
      201,
    ),
  invite: (id: string, email: string, key: string) =>
    call(
      InvitationReceiptSchema,
      `/api/v1/admin/projects/${id}/invitations`,
      post({ email }, key),
      201,
    ),
  acceptInvite: (token: string) =>
    call(ProjectSchema, "/api/v1/invitations/accept", post({ token })),
  revokeInvite: (id: string, inviteId: string) =>
    call(
      z.object({ status: z.literal("REVOKED") }),
      `/api/v1/admin/projects/${id}/invitations/${inviteId}/revoke`,
      post({}),
    ),
  members: (id: string, cursor?: string) =>
    call(
      MemberPageSchema,
      `/api/v1/admin/projects/${id}/members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  revokeMember: (member: ProjectMember) =>
    call(
      MemberSchema,
      `/api/v1/admin/projects/${member.projectId}/members/${encodeURIComponent(member.userId)}/revoke`,
      { ...post({}), headers: { "If-Match": String(member.version) } },
    ),
};
