import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ProjectCreateSchema,
  ProjectUpdateSchema,
  InviteCreateSchema,
  InviteAcceptSchema,
  MessageCreateSchema,
  type StudioProject,
  type InvitationReceipt,
  type ProjectMessage,
  type ProjectMember,
} from "@azelvori/contracts";
import { HttpError, digest, authorizeStaff, type Repository } from "./domain";
import {
  check,
  meta,
  row,
  type Row,
  type Check,
  type WorkspaceStore,
} from "./workspace-store";
import type { Actor, IdentityProvider } from "./identity";
type Invitation = {
  invitationId: string;
  projectId: string;
  emailHash: string;
  expiresAt: string;
  state: "PENDING" | "ACCEPTED" | "REVOKED";
  userId?: string;
};
type Receipt = { hash: string; result: unknown };
const missing = () =>
  new HttpError(404, "NOT_FOUND", "ไม่พบโปรเจกต์หรือไม่มีสิทธิ์เข้าถึง");
const conflict = () =>
  new HttpError(
    409,
    "STALE_VERSION",
    "ข้อมูลถูกเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่",
  );
const parse = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const r = schema.safeParse(data);
  if (!r.success)
    throw new HttpError(
      422,
      "VALIDATION",
      "ตรวจสอบข้อมูลอีกครั้ง",
      Object.fromEntries(
        r.error.issues.map((i) => [i.path.join("."), i.message]),
      ),
    );
  return r.data;
};
const projectKey = (id: string) => meta(`PROJECT#${id}`);
const memberKey = (id: string, user: string) => ({
  pk: `PROJECT#${id}`,
  sk: `MEMBER#${user}`,
});
const staffCheck = (actor: Actor): Check => ({
  ...meta(`STAFF#${actor.sub}`),
  version: null,
  staff: true,
});

export class WorkspaceService {
  constructor(
    readonly store: WorkspaceStore,
    private leads: Repository,
    private identity: IdentityProvider,
    private clock = () => new Date(),
  ) {}
  private async staff(actor: Actor) {
    await authorizeStaff(this.leads, actor.sub);
  }
  private async isStaff(actor: Actor) {
    const g = await this.leads.getStaff(actor.sub);
    return !!g?.active && g.role === "FOUNDER_ADMIN";
  }
  private async limited(actor: Actor, action: string) {
    const now = this.clock();
    if (
      !(await this.leads.consumeRate(
        digest(`${actor.sub}|${action}|${Math.floor(now.getTime() / 60000)}`),
        now.getTime(),
      ))
    )
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "ทำรายการถี่เกินไป กรุณารอ 1 นาทีแล้วลองใหม่",
      );
  }
  private async access(actor: Actor, id: string) {
    const p = await this.store.get<StudioProject>(projectKey(id));
    if (!p) throw missing();
    const tenant = await this.store.get<{ active: boolean }>(
      meta(`TENANT#${p.data.tenantId}`),
    );
    if (!tenant?.data.active) throw missing();
    if (await this.isStaff(actor))
      return {
        p,
        staff: true,
        checks: [staffCheck(actor), check(tenant, tenant)],
      };
    const membership = await this.store.get<{ active: boolean }>({
      pk: `TENANT#${p.data.tenantId}`,
      sk: `MEMBER#${actor.sub}`,
    });
    const grant = await this.store.get<ProjectMember>(memberKey(id, actor.sub));
    if (!membership?.data.active || !grant?.data.active) throw missing();
    return {
      p,
      staff: false,
      checks: [
        check(tenant, tenant),
        check(membership, membership),
        check(grant, grant),
      ],
    };
  }
  private operation(actor: Actor, route: string, key: string, body: unknown) {
    parse(z.string().uuid(), key);
    return {
      key: meta(`OP#${digest(`${actor.sub}|${route}|${key}`)}`),
      hash: digest(JSON.stringify(body)),
    };
  }
  private async replay<T>(
    op: ReturnType<WorkspaceService["operation"]>,
  ): Promise<T | undefined> {
    const r = await this.store.get<Receipt>(op.key);
    if (!r) return;
    if (r.data.hash !== op.hash)
      throw new HttpError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว",
      );
    return r.data.result as T;
  }
  private async save<T>(
    actor: Actor,
    action: string,
    target: string,
    checks: Check[],
    puts: Row[],
    result: T,
    op?: ReturnType<WorkspaceService["operation"]>,
  ): Promise<T> {
    const now = this.clock();
    const ok = await this.store.commit({
      checks: [...checks, ...(op ? [check(op.key)] : [])],
      puts: [
        ...puts,
        ...(op
          ? [
              {
                ...row(op.key, { hash: op.hash, result }),
                expiresAt: Math.floor(now.getTime() / 1000) + 604800,
              },
            ]
          : []),
      ],
      audit: {
        pk: `PROJECT#${target}`,
        sk: `${now.toISOString()}#${randomUUID()}`,
        action,
        actor: actor.sub,
        target,
        at: now.toISOString(),
      },
    });
    if (!ok) {
      if (op) {
        const replay = await this.replay<T>(op);
        if (replay !== undefined) return replay;
      }
      throw conflict();
    }
    return result;
  }
  async me(actor: Actor) {
    return {
      ...(await this.identity.current(actor)),
      staff: await this.isStaff(actor),
    };
  }
  async requestVerification(actor: Actor) {
    await this.limited(actor, "verify-email");
    await this.identity.current(actor);
    await this.identity.requestVerification(actor);
    return { status: "CODE_SENT" };
  }
  async verify(actor: Actor, body: unknown) {
    const data = parse(
      z.object({ code: z.string().regex(/^\d{6}$/) }).strict(),
      body,
    );
    await this.limited(actor, "verify-code");
    await this.identity.current(actor);
    await this.identity.verify(actor, data.code);
    return this.me(actor);
  }
  async createProject(actor: Actor, body: unknown, key: string) {
    await this.staff(actor);
    const data = parse(ProjectCreateSchema, body);
    const op = this.operation(actor, "project.create", key, data);
    const cached = await this.replay<StudioProject>(op);
    if (cached) return cached;
    const lead = await this.leads.getLead(data.leadId);
    if (!lead) throw new HttpError(404, "LEAD_NOT_FOUND", "ไม่พบบรีฟ");
    if (!["QUALIFIED", "SCOPED", "QUOTED", "WON"].includes(lead.status))
      throw new HttpError(
        409,
        "LEAD_NOT_READY",
        "ประเมินบรีฟให้ผ่านก่อนสร้างโปรเจกต์",
      );
    const link = meta(`LEADPROJECT#${data.leadId}`);
    if (await this.store.get(link)) {
      const completed = await this.replay<StudioProject>(op);
      if (completed) return completed;
      throw new HttpError(
        409,
        "PROJECT_EXISTS",
        "บรีฟนี้มีโปรเจกต์แล้ว เปิดจากรายการโปรเจกต์ได้เลย",
      );
    }
    const id = randomUUID(),
      tenantId = randomUUID(),
      now = this.clock().toISOString();
    const project: StudioProject = {
      projectId: id,
      tenantId,
      leadId: lead.leadId,
      title: data.title,
      summary: data.summary,
      serviceType: lead.serviceType,
      state: "DISCOVERY",
      version: 1,
      createdAt: now,
      updatedAt: now,
      milestones: [
        {
          id: randomUUID(),
          label: "ยืนยันบรีฟและขอบเขตงาน",
          weight: 25,
          status: "PENDING",
        },
        {
          id: randomUUID(),
          label: "พัฒนาและส่งให้ตรวจ",
          weight: 50,
          status: "PENDING",
        },
        {
          id: randomUUID(),
          label: "ตรวจรับและส่งมอบ",
          weight: 25,
          status: "PENDING",
        },
      ],
    };
    return this.save(
      actor,
      "project.created",
      id,
      [staffCheck(actor), check(link)],
      [
        row(projectKey(id), project),
        row(meta(`TENANT#${tenantId}`), { active: true }),
        row(link, { projectId: id }),
        row(
          { pk: "DIRECTORY#PROJECTS", sk: `PROJECT#${id}` },
          { projectId: id },
        ),
      ],
      project,
      op,
    );
  }
  async list(actor: Actor, cursor?: string) {
    const staff = await this.isStaff(actor);
    const page = await this.store.page<{ projectId: string }>(
      staff ? "DIRECTORY#PROJECTS" : `USER#${actor.sub}`,
      "PROJECT#",
      cursor,
    );
    const items: StudioProject[] = [];
    for (const item of page.items) {
      try {
        items.push((await this.access(actor, item.data.projectId)).p.data);
      } catch (e) {
        if (!(e instanceof HttpError) || e.status !== 404) throw e;
      }
    }
    return {
      items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }
  async get(actor: Actor, id: string) {
    return (await this.access(actor, id)).p.data;
  }
  async update(actor: Actor, id: string, body: unknown, version: number) {
    await this.staff(actor);
    const { p, checks } = await this.access(actor, id);
    if (p.version !== version) throw conflict();
    const data = parse(ProjectUpdateSchema, body);
    const next = structuredClone(p.data);
    if (data.state) {
      if (
        data.state === "COMPLETED" &&
        next.milestones.some((m) => m.status !== "ACCEPTED")
      )
        throw new HttpError(
          409,
          "REVIEW_REQUIRED",
          "ลูกค้าต้องตรวจรับ milestone ครบก่อนส่งมอบ",
        );
      next.state = data.state;
    } else {
      const m = next.milestones.find((m) => m.id === data.milestoneId);
      if (!m) throw missing();
      if (m.status === "ACCEPTED")
        throw new HttpError(
          409,
          "ACCEPTANCE_LOCKED",
          "milestone ที่ลูกค้าตรวจรับแล้วแก้สถานะย้อนหลังไม่ได้",
        );
      m.status = data.milestoneState!;
    }
    next.version++;
    next.updatedAt = this.clock().toISOString();
    return this.save(
      actor,
      "project.updated",
      id,
      [...checks, check(p, p)],
      [row(p, next, next.version)],
      next,
    );
  }
  async acceptMilestone(
    actor: Actor,
    id: string,
    milestoneId: string,
    version: number,
    key: string,
  ) {
    const { p, staff, checks } = await this.access(actor, id);
    if (staff)
      throw new HttpError(
        403,
        "CUSTOMER_REVIEW_REQUIRED",
        "ให้ลูกค้าที่ได้รับเชิญตรวจรับงานด้วยบัญชีของตนเอง",
      );
    const op = this.operation(actor, `milestone.accept:${id}`, key, {
      milestoneId,
      version,
    });
    const cached = await this.replay<StudioProject>(op);
    if (cached) return cached;
    if (p.version !== version) throw conflict();
    const next = structuredClone(p.data),
      m = next.milestones.find((m) => m.id === milestoneId);
    if (!m || m.status !== "REVIEW")
      throw new HttpError(
        409,
        "NOT_READY_FOR_REVIEW",
        "milestone นี้ยังไม่อยู่ในสถานะรอตรวจรับ",
      );
    m.status = "ACCEPTED";
    m.acceptedBy = actor.sub;
    m.acceptedAt = this.clock().toISOString();
    next.version++;
    next.updatedAt = m.acceptedAt;
    return this.save(
      actor,
      "milestone.accepted",
      id,
      [...checks, check(p, p)],
      [row(p, next, next.version)],
      next,
      op,
    );
  }
  async invite(
    actor: Actor,
    id: string,
    body: unknown,
    key: string,
  ): Promise<InvitationReceipt> {
    await this.staff(actor);
    const { p, checks } = await this.access(actor, id);
    const data = parse(InviteCreateSchema, body);
    const op = this.operation(actor, `invite.create:${id}`, key, data);
    const cached = await this.replay<{
      invitationId: string;
      expiresAt: string;
      account: "CREATED" | "EXISTING";
    }>(op);
    if (cached) return { ...cached, replayed: true };
    await this.limited(actor, "invite");
    // Cognito provisioning is external to the DB transaction. A provisioned account
    // has NO project access until a verified-email invitation is accepted.
    const account = await this.identity.ensureAccount(data.email);
    const token = randomBytes(32).toString("hex"),
      hash = digest(token),
      emailHash = digest(data.email),
      invitationId = randomUUID(),
      expiresAt = new Date(this.clock().getTime() + 72 * 3600000).toISOString();
    const activeKey = { pk: `PROJECT#${id}`, sk: `INVITEEMAIL#${emailHash}` },
      active = await this.store.get(activeKey);
    const invitation: Invitation = {
      invitationId,
      projectId: id,
      emailHash,
      expiresAt,
      state: "PENDING",
    };
    const result = { invitationId, expiresAt, account };
    const saved = await this.save(
      actor,
      "invitation.created",
      id,
      [...checks, check(activeKey, active), check(p, p)],
      [
        {
          ...row(meta(`INVITE#${hash}`), invitation),
          expiresAt: Math.floor(Date.parse(expiresAt) / 1000) + 604800,
        },
        row(activeKey, { invitationId }, (active?.version ?? 0) + 1),
        row(meta(`INVITEID#${invitationId}`), { hash, projectId: id }),
      ],
      result,
      op,
    );
    // A racing retry must never return a token that was not the persisted winner.
    return {
      ...saved,
      replayed: saved.invitationId !== invitationId,
      ...(saved.invitationId === invitationId ? { token } : {}),
    };
  }
  async revokeInvitation(actor: Actor, id: string, inviteId: string) {
    await this.staff(actor);
    const { checks } = await this.access(actor, id);
    const pointer = await this.store.get<{ hash: string; projectId: string }>(
      meta(`INVITEID#${inviteId}`),
    );
    if (!pointer || pointer.data.projectId !== id) throw missing();
    const invite = await this.store.get<Invitation>(
      meta(`INVITE#${pointer.data.hash}`),
    );
    if (!invite) throw missing();
    if (invite.data.state !== "PENDING")
      throw new HttpError(
        409,
        "INVITATION_CLOSED",
        "คำเชิญถูกใช้หรือยกเลิกแล้ว",
      );
    return this.save(
      actor,
      "invitation.revoked",
      id,
      [...checks, check(invite, invite)],
      [row(invite, { ...invite.data, state: "REVOKED" }, invite.version + 1)],
      { status: "REVOKED" },
    );
  }
  async acceptInvite(actor: Actor, body: unknown) {
    const data = parse(InviteAcceptSchema, body);
    await this.limited(actor, "accept-invite");
    const identity = await this.identity.current(actor);
    if (!identity.emailVerified)
      throw new HttpError(
        403,
        "EMAIL_NOT_VERIFIED",
        "ยืนยันอีเมลก่อนรับคำเชิญ",
      );
    const invite = await this.store.get<Invitation>(
      meta(`INVITE#${digest(data.token)}`),
    );
    if (
      !invite ||
      invite.data.emailHash !== digest(identity.email.toLowerCase()) ||
      invite.data.state === "REVOKED"
    )
      throw new HttpError(
        404,
        "INVITATION_NOT_FOUND",
        "คำเชิญไม่ถูกต้องหรือไม่ใช่อีเมลของบัญชีนี้",
      );
    if (Date.parse(invite.data.expiresAt) <= this.clock().getTime())
      throw new HttpError(
        410,
        "INVITATION_EXPIRED",
        "คำเชิญหมดอายุ กรุณาขอคำเชิญใหม่จากสตูดิโอ",
      );
    const id = invite.data.projectId,
      active = await this.store.get<{ invitationId: string }>({
        pk: `PROJECT#${id}`,
        sk: `INVITEEMAIL#${invite.data.emailHash}`,
      });
    if (active?.data.invitationId !== invite.data.invitationId)
      throw new HttpError(
        410,
        "INVITATION_REPLACED",
        "มีคำเชิญใหม่มาแทนแล้ว กรุณาใช้ลิงก์ล่าสุด",
      );
    if (invite.data.state === "ACCEPTED") {
      if (invite.data.userId !== actor.sub) throw missing();
      return this.get(actor, id);
    }
    const p = await this.store.get<StudioProject>(projectKey(id));
    if (!p) throw missing();
    const tenant = await this.store.get<{ active: boolean }>(
      meta(`TENANT#${p.data.tenantId}`),
    );
    if (!tenant?.data.active) throw missing();
    const membershipKey = {
        pk: `TENANT#${p.data.tenantId}`,
        sk: `MEMBER#${actor.sub}`,
      },
      membership = await this.store.get<{ active: boolean }>(membershipKey),
      grant = await this.store.get<ProjectMember>(memberKey(id, actor.sub)),
      indexKey = { pk: `USER#${actor.sub}`, sk: `PROJECT#${id}` },
      index = await this.store.get(indexKey);
    if (membership && !membership.data.active) throw missing();
    const member: ProjectMember = {
      projectId: id,
      userId: actor.sub,
      role: "CUSTOMER",
      active: true,
      version: (grant?.version ?? 0) + 1,
      joinedAt: this.clock().toISOString(),
      email: identity.email,
    };
    const puts: Row[] = [
      row(
        invite,
        { ...invite.data, state: "ACCEPTED", userId: actor.sub },
        invite.version + 1,
      ),
      row(memberKey(id, actor.sub), member, member.version),
      row(indexKey, { projectId: id }, (index?.version ?? 0) + 1),
    ];
    if (!membership) puts.push(row(membershipKey, { active: true }));
    try {
      return await this.save(
        actor,
        "invitation.accepted",
        id,
        [
          check(invite, invite),
          check(active, active),
          check(tenant, tenant),
          check(membershipKey, membership),
          check(memberKey(id, actor.sub), grant),
          check(indexKey, index),
        ],
        puts,
        p.data,
      );
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        const raced = await this.store.get<Invitation>(invite);
        if (raced?.data.state === "ACCEPTED" && raced.data.userId === actor.sub)
          return this.get(actor, id);
      }
      throw error;
    }
  }
  async members(actor: Actor, id: string, cursor?: string) {
    await this.staff(actor);
    await this.access(actor, id);
    const page = await this.store.page<ProjectMember>(
      `PROJECT#${id}`,
      "MEMBER#",
      cursor,
    );
    return {
      items: page.items.map((i) => i.data),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }
  async revokeMember(
    actor: Actor,
    id: string,
    userId: string,
    version: number,
  ) {
    await this.staff(actor);
    const { checks } = await this.access(actor, id),
      grant = await this.store.get<ProjectMember>(memberKey(id, userId));
    if (!grant) throw missing();
    if (grant.version !== version) throw conflict();
    const changed = {
      ...grant.data,
      active: false,
      version: grant.version + 1,
    };
    return this.save(
      actor,
      "member.revoked",
      id,
      [...checks, check(grant, grant)],
      [row(grant, changed, changed.version)],
      changed,
    );
  }
  async messages(actor: Actor, id: string, cursor?: string) {
    await this.access(actor, id);
    const page = await this.store.page<ProjectMessage>(
      `PROJECT#${id}`,
      "MSG#",
      cursor,
      true,
    );
    return {
      items: page.items.map((i) => i.data).reverse(),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }
  async send(actor: Actor, id: string, body: unknown, key: string) {
    const { staff, checks } = await this.access(actor, id),
      data = parse(MessageCreateSchema, body),
      op = this.operation(actor, `message.send:${id}`, key, data);
    const cached = await this.replay<ProjectMessage>(op);
    if (cached) return cached;
    await this.limited(actor, `chat:${id}`);
    const createdAt = this.clock().toISOString(),
      messageId = randomUUID();
    const message: ProjectMessage = {
      messageId,
      projectId: id,
      senderId: actor.sub,
      senderRole: staff ? "STUDIO" : "CUSTOMER",
      text: data.text,
      createdAt,
      status: "PERSISTED",
    };
    return this.save(
      actor,
      "message.created",
      id,
      checks,
      [
        row(
          { pk: `PROJECT#${id}`, sk: `MSG#${createdAt}#${messageId}` },
          message,
        ),
      ],
      message,
      op,
    );
  }
}
