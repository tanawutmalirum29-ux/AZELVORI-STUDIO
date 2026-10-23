import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../workspace-fixtures";
import { digest } from "../../services/api/src/domain";
import {
  meta,
  row,
  cursorEncode,
} from "../../services/api/src/workspace-store";
import { projectProgress, type ProjectMember } from "@azelvori/contracts";
describe("private project workflow", () => {
  it("creates one tenant/project per qualified lead and does not imply payment", async () => {
    const f = await workspaceFixture();
    expect(f.project.state).toBe("DISCOVERY");
    expect(projectProgress(f.project)).toBe(0);
    expect(f.project).not.toHaveProperty("paymentStatus");
    await expect(
      f.service.createProject(f.founder, f.body, randomUUID()),
    ).rejects.toMatchObject({ code: "PROJECT_EXISTS" });
  });
  it("replays concurrent project creation and rejects changed bodies with the same key", async () => {
    const f = await workspaceFixture();
    const leadId = "LEAD-2026-FEDCBA9876543210";
    f.leads.leads.set(leadId, { ...f.leads.leads.get(f.body.leadId)!, leadId });
    const key = randomUUID(),
      body = { ...f.body, leadId };
    const values = await Promise.all(
      Array.from({ length: 10 }, () =>
        f.service.createProject(f.founder, body, key),
      ),
    );
    expect(new Set(values.map((v) => v.projectId)).size).toBe(1);
    await expect(
      f.service.createProject(
        f.founder,
        { ...body, title: "another project" },
        key,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("rejects customer project creation and forged tenant/role properties", async () => {
    const f = await workspaceFixture();
    await expect(
      f.service.createProject(f.a, f.body, randomUUID()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.createProject(
        f.founder,
        { ...f.body, tenantId: randomUUID(), isAdmin: true },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("denies early and lost leads", async () => {
    for (const status of [
      "NEW",
      "ACKNOWLEDGED",
      "DISCOVERY",
      "LOST",
    ] as const) {
      const f = await workspaceFixture();
      f.leads.leads.set(f.body.leadId, {
        ...f.leads.leads.get(f.body.leadId)!,
        status,
      });
      await expect(
        f.service.createProject(f.founder, f.body, randomUUID()),
      ).rejects.toMatchObject({ code: "LEAD_NOT_READY" });
    }
  });
  it("isolates project list, detail, chat and members from unrelated customers", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    expect((await f.service.list(f.a)).items.map((p) => p.projectId)).toEqual([
      f.project.projectId,
    ]);
    expect((await f.service.list(f.b)).items).toEqual([]);
    for (const action of [
      () => f.service.get(f.b, f.project.projectId),
      () => f.service.messages(f.b, f.project.projectId),
      () =>
        f.service.send(
          f.b,
          f.project.projectId,
          { text: "forged" },
          randomUUID(),
        ),
    ])
      await expect(action()).rejects.toMatchObject({ status: 404 });
    await expect(
      f.service.members(f.a, f.project.projectId),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rechecks authoritative grants instead of trusting the listing index", async () => {
    const f = await workspaceFixture();
    f.store.put(
      row(
        { pk: `USER#${f.b.sub}`, sk: `PROJECT#${f.project.projectId}` },
        { projectId: f.project.projectId },
      ),
    );
    expect((await f.service.list(f.b)).items).toEqual([]);
  });
  it("binds a single-use invitation to verified email and never stores its raw token", async () => {
    const f = await workspaceFixture();
    const invite = await f.service.invite(
      f.founder,
      f.project.projectId,
      { email: "CUSTOMER-A@EXAMPLE.COM" },
      randomUUID(),
    );
    expect(invite.token).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify([...f.store.rows.values()])).not.toContain(
      invite.token,
    );
    await expect(
      f.service.acceptInvite(f.b, { token: invite.token }),
    ).rejects.toMatchObject({ status: 404 });
    f.identity.identities.get(f.a.sub)!.emailVerified = false;
    await expect(
      f.service.acceptInvite(f.a, { token: invite.token }),
    ).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    f.identity.identities.get(f.a.sub)!.emailVerified = true;
    expect(
      (await f.service.acceptInvite(f.a, { token: invite.token })).projectId,
    ).toBe(f.project.projectId);
    expect(
      (await f.service.acceptInvite(f.a, { token: invite.token })).projectId,
    ).toBe(f.project.projectId);
  });
  it("replaying invitation creation does not re-email or disclose the token", async () => {
    const f = await workspaceFixture(),
      key = randomUUID(),
      body = { email: "customer-a@example.com" };
    const first = await f.service.invite(
        f.founder,
        f.project.projectId,
        body,
        key,
      ),
      again = await f.service.invite(f.founder, f.project.projectId, body, key);
    expect(again.invitationId).toBe(first.invitationId);
    expect(again).not.toHaveProperty("token");
    expect(again.replayed).toBe(true);
    expect(f.identity.provisions).toBe(1);
  });
  it("concurrent invitation retries return a token only for the persisted winner", async () => {
    const f = await workspaceFixture(),
      key = randomUUID(),
      body = { email: "customer-a@example.com" };
    const results = await Promise.all([
      f.service.invite(f.founder, f.project.projectId, body, key),
      f.service.invite(f.founder, f.project.projectId, body, key),
    ]);
    expect(new Set(results.map((r) => r.invitationId)).size).toBe(1);
    const token = results.find((r) => r.token)?.token;
    expect(token).toBeTruthy();
    expect(results.filter((r) => r.token)).toHaveLength(1);
    expect((await f.service.acceptInvite(f.a, { token })).projectId).toBe(
      f.project.projectId,
    );
  });
  it("expires invites in application code even before Dynamo TTL deletion", async () => {
    const f = await workspaceFixture();
    const invite = await f.service.invite(
      f.founder,
      f.project.projectId,
      { email: "customer-a@example.com" },
      randomUUID(),
    );
    f.advance(72 * 3600000);
    await expect(
      f.service.acceptInvite(f.a, { token: invite.token }),
    ).rejects.toMatchObject({ status: 410 });
    expect(
      await f.store.get(meta(`INVITE#${digest(invite.token!)}`)),
    ).toBeDefined();
  });
  it("replacement and revoked invitations cannot grant access", async () => {
    const f = await workspaceFixture();
    const old = await f.service.invite(
      f.founder,
      f.project.projectId,
      { email: "customer-a@example.com" },
      randomUUID(),
    );
    const next = await f.service.invite(
      f.founder,
      f.project.projectId,
      { email: "customer-a@example.com" },
      randomUUID(),
    );
    await expect(
      f.service.acceptInvite(f.a, { token: old.token }),
    ).rejects.toMatchObject({ code: "INVITATION_REPLACED" });
    await f.service.revokeInvitation(
      f.founder,
      f.project.projectId,
      next.invitationId,
    );
    await expect(
      f.service.acceptInvite(f.a, { token: next.token }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("concurrent invitation acceptance grants membership once", async () => {
    const f = await workspaceFixture();
    const i = await f.service.invite(
      f.founder,
      f.project.projectId,
      { email: "customer-a@example.com" },
      randomUUID(),
    );
    const results = await Promise.all([
      f.service.acceptInvite(f.a, { token: i.token }),
      f.service.acceptInvite(f.a, { token: i.token }),
    ]);
    expect(results[0].projectId).toBe(results[1].projectId);
    expect(
      (await f.service.members(f.founder, f.project.projectId)).items,
    ).toHaveLength(1);
    expect(
      f.store.audit.filter((a) => a.action === "invitation.accepted"),
    ).toHaveLength(1);
  });
  it("revocation takes effect for reads, writes, lists, retries and old invitation links", async () => {
    const f = await workspaceFixture();
    const i = await f.join(f.a),
      key = randomUUID();
    await f.service.send(f.a, f.project.projectId, { text: "saved" }, key);
    const [member] = (await f.service.members(f.founder, f.project.projectId))
      .items;
    await f.service.revokeMember(
      f.founder,
      f.project.projectId,
      f.a.sub,
      member.version,
    );
    for (const act of [
      () => f.service.get(f.a, f.project.projectId),
      () => f.service.messages(f.a, f.project.projectId),
      () => f.service.send(f.a, f.project.projectId, { text: "saved" }, key),
      () => f.service.acceptInvite(f.a, { token: i.token }),
    ])
      await expect(act()).rejects.toMatchObject({ status: 404 });
    expect((await f.service.list(f.a)).items).toEqual([]);
  });
  it("blocks a write when membership is revoked between read and commit", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    const key = {
        pk: `PROJECT#${f.project.projectId}`,
        sk: `MEMBER#${f.a.sub}`,
      },
      member = (await f.store.get<ProjectMember>(key))!;
    f.store.beforeCommit = () =>
      f.store.put(row(key, { ...member.data, active: false, version: 2 }, 2));
    await expect(
      f.service.send(
        f.a,
        f.project.projectId,
        { text: "must not persist" },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await f.service.messages(f.founder, f.project.projectId)).items,
    ).toEqual([]);
  });
  it("checks tenant membership as well as the project grant", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    f.store.put(
      row(
        { pk: `TENANT#${f.project.tenantId}`, sk: `MEMBER#${f.a.sub}` },
        { active: false },
        2,
      ),
    );
    await expect(f.service.get(f.a, f.project.projectId)).rejects.toMatchObject(
      { status: 404 },
    );
  });
  it("checks staff revocation again inside the transaction", async () => {
    const f = await workspaceFixture();
    f.store.beforeCommit = () =>
      f.store.put(
        row(
          meta(`STAFF#${f.founder.sub}`),
          { active: false, role: "FOUNDER_ADMIN" },
          2,
        ),
      );
    await expect(
      f.service.update(
        f.founder,
        f.project.projectId,
        { state: "IN_PROGRESS" },
        1,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("persists duplicate messages once and detects conflicting retry payloads", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    const key = randomUUID();
    const receipt = await f.service.send(
      f.a,
      f.project.projectId,
      { text: "<script>hello</script>" },
      key,
    );
    for (let i = 0; i < 10; i++)
      expect(
        await f.service.send(
          f.a,
          f.project.projectId,
          { text: "<script>hello</script>" },
          key,
        ),
      ).toEqual(receipt);
    expect(
      (await f.service.messages(f.a, f.project.projectId)).items,
    ).toHaveLength(1);
    expect(receipt.status).toBe("PERSISTED");
    await expect(
      f.service.send(f.a, f.project.projectId, { text: "changed" }, key),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(JSON.stringify(f.store.audit)).not.toContain("<script>");
  });
  it("concurrent sends persist only one message", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    const key = randomUUID();
    const receipts = await Promise.all(
      Array.from({ length: 5 }, () =>
        f.service.send(f.a, f.project.projectId, { text: "one message" }, key),
      ),
    );
    expect(new Set(receipts.map((m) => m.messageId)).size).toBe(1);
    expect(
      (await f.service.messages(f.a, f.project.projectId)).items,
    ).toHaveLength(1);
  });
  it("limits fresh messages while permitting retries", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    for (let i = 0; i < 5; i++)
      await f.service.send(
        f.a,
        f.project.projectId,
        { text: `message ${i}` },
        randomUUID(),
      );
    await expect(
      f.service.send(
        f.a,
        f.project.projectId,
        { text: "too many" },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 429 });
    f.advance(60000);
    await expect(
      f.service.send(f.a, f.project.projectId, { text: "later" }, randomUUID()),
    ).resolves.toMatchObject({ status: "PERSISTED" });
  });
  it("rejects blank, oversized and forged chat fields", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    for (const body of [
      { text: "  " },
      { text: "x".repeat(2001) },
      { text: "hi", senderRole: "STUDIO" },
      { text: "hi", tenantId: randomUUID() },
    ])
      await expect(
        f.service.send(f.a, f.project.projectId, body, randomUUID()),
      ).rejects.toMatchObject({ status: 422 });
  });
  it("accepts only the exact reviewed project version, by a customer", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    const id = f.project.milestones[0].id;
    await expect(
      f.service.acceptMilestone(f.a, f.project.projectId, id, 1, randomUUID()),
    ).rejects.toMatchObject({ code: "NOT_READY_FOR_REVIEW" });
    const review = await f.service.update(
      f.founder,
      f.project.projectId,
      { milestoneId: id, milestoneState: "REVIEW" },
      1,
    );
    await expect(
      f.service.acceptMilestone(
        f.founder,
        f.project.projectId,
        id,
        review.version,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.acceptMilestone(f.a, f.project.projectId, id, 1, randomUUID()),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    const key = randomUUID(),
      accepted = await f.service.acceptMilestone(
        f.a,
        f.project.projectId,
        id,
        review.version,
        key,
      );
    expect(projectProgress(accepted)).toBe(25);
    expect(accepted.milestones[0].acceptedBy).toBe(f.a.sub);
    expect(
      await f.service.acceptMilestone(
        f.a,
        f.project.projectId,
        id,
        review.version,
        key,
      ),
    ).toEqual(accepted);
    await expect(
      f.service.update(
        f.founder,
        f.project.projectId,
        { milestoneId: id, milestoneState: "PENDING" },
        accepted.version,
      ),
    ).rejects.toMatchObject({ code: "ACCEPTANCE_LOCKED" });
  });
  it("cannot complete a project without customer milestone acceptance", async () => {
    const f = await workspaceFixture();
    await expect(
      f.service.update(
        f.founder,
        f.project.projectId,
        { state: "COMPLETED" },
        1,
      ),
    ).rejects.toMatchObject({ code: "REVIEW_REQUIRED" });
  });
  it("optimistic updates reject stale edits", async () => {
    const f = await workspaceFixture();
    const results = await Promise.allSettled([
      f.service.update(
        f.founder,
        f.project.projectId,
        { state: "IN_PROGRESS" },
        1,
      ),
      f.service.update(f.founder, f.project.projectId, { state: "PAUSED" }, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("scopes pagination cursors to the project and stream", async () => {
    const f = await workspaceFixture();
    await f.join(f.a);
    const other = cursorEncode(`PROJECT#${randomUUID()}`, "MSG#", "MSG#2026");
    await expect(
      f.service.messages(f.a, f.project.projectId, other),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await expect(
      f.service.messages(f.a, f.project.projectId, "not-json"),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });
  it("does not grant a newly provisioned account access if the DB transaction fails", async () => {
    const f = await workspaceFixture();
    f.store.beforeCommit = () =>
      f.store.put(
        row(
          meta(`STAFF#${f.founder.sub}`),
          { active: false, role: "FOUNDER_ADMIN" },
          2,
        ),
      );
    await expect(
      f.service.invite(
        f.founder,
        f.project.projectId,
        { email: "customer-a@example.com" },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.identity.accounts.has("customer-a@example.com")).toBe(true);
    expect((await f.service.list(f.a)).items).toEqual([]);
  });
});
