import { z } from "zod";

export const ProjectIdSchema = z.string().uuid();
export const ProjectCreateSchema = z
  .object({
    leadId: z.string().regex(/^LEAD-\d{4}-[A-F0-9]{16}$/),
    title: z.string().trim().min(5).max(200),
    summary: z.string().trim().min(30).max(5000),
  })
  .strict();
export const PROJECT_STATES = [
  "DISCOVERY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "PAUSED",
  "COMPLETED",
] as const;
export const PROJECT_STATE_LABELS = {
  DISCOVERY: "เก็บรายละเอียด",
  IN_PROGRESS: "กำลังพัฒนา",
  IN_REVIEW: "รอตรวจรับ",
  PAUSED: "พักงาน",
  COMPLETED: "ส่งมอบแล้ว",
} as const;
export const WorkspaceMilestoneSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  weight: z.number().positive(),
  status: z.enum(["PENDING", "ACTIVE", "REVIEW", "ACCEPTED"]),
  acceptedBy: z.string().optional(),
  acceptedAt: z.iso.datetime().optional(),
});
export const ProjectSchema = z.object({
  projectId: ProjectIdSchema,
  tenantId: z.string().uuid(),
  leadId: z.string(),
  title: z.string(),
  summary: z.string(),
  serviceType: z.string(),
  state: z.enum(PROJECT_STATES),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  milestones: z.array(WorkspaceMilestoneSchema),
});
export type StudioProject = z.infer<typeof ProjectSchema>;
export const ProjectUpdateSchema = z
  .object({
    state: z.enum(PROJECT_STATES).optional(),
    milestoneId: z.string().uuid().optional(),
    milestoneState: z.enum(["PENDING", "ACTIVE", "REVIEW"]).optional(),
  })
  .strict()
  .refine(
    (x) =>
      (x.state !== undefined &&
        x.milestoneId === undefined &&
        x.milestoneState === undefined) ||
      (x.state === undefined && !!x.milestoneId && !!x.milestoneState),
    "เลือกเปลี่ยนสถานะโปรเจกต์หรือ milestone อย่างใดอย่างหนึ่ง",
  );
export const InviteCreateSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
  })
  .strict();
export const InviteAcceptSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const MessageCreateSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "กรอกข้อความก่อนส่ง")
      .max(2000, "ข้อความยาวได้ไม่เกิน 2,000 ตัวอักษร"),
  })
  .strict();
export const MessageSchema = z.object({
  messageId: z.string().uuid(),
  projectId: ProjectIdSchema,
  senderId: z.string(),
  senderRole: z.enum(["STUDIO", "CUSTOMER"]),
  text: z.string(),
  createdAt: z.iso.datetime(),
  status: z.literal("PERSISTED"),
});
export type ProjectMessage = z.infer<typeof MessageSchema>;
export const MemberSchema = z.object({
  userId: z.string(),
  projectId: ProjectIdSchema,
  role: z.literal("CUSTOMER"),
  active: z.boolean(),
  version: z.number().int(),
  joinedAt: z.iso.datetime(),
  email: z.email(),
});
export type ProjectMember = z.infer<typeof MemberSchema>;
export const IdentitySchema = z.object({
  userId: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  staff: z.boolean(),
});
export type StudioIdentity = z.infer<typeof IdentitySchema>;
export const InvitationReceiptSchema = z.object({
  invitationId: z.string().uuid(),
  expiresAt: z.iso.datetime(),
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  replayed: z.boolean(),
  account: z.enum(["CREATED", "EXISTING"]),
});
export const ProjectPageSchema = z.object({
  items: z.array(ProjectSchema),
  nextCursor: z.string().optional(),
});
export const MessagePageSchema = z.object({
  items: z.array(MessageSchema),
  nextCursor: z.string().optional(),
});
export const MemberPageSchema = z.object({
  items: z.array(MemberSchema),
  nextCursor: z.string().optional(),
});
export function projectProgress(project: StudioProject): number {
  const total = project.milestones.reduce((n, m) => n + m.weight, 0);
  return total
    ? Math.round(
        (project.milestones
          .filter((m) => m.status === "ACCEPTED")
          .reduce((n, m) => n + m.weight, 0) /
          total) *
          100,
      )
    : 0;
}

export type InvitationReceipt = z.infer<typeof InvitationReceiptSchema>;
