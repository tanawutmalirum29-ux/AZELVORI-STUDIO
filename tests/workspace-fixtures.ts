import { randomUUID } from "node:crypto";
import type {
  Actor,
  IdentityProvider,
  VerifiedIdentity,
} from "../services/api/src/identity";
import {
  check,
  cursorDecode,
  cursorEncode,
  meta,
  row,
  type Change,
  type Key,
  type Row,
  type WorkspaceStore,
} from "../services/api/src/workspace-store";
import { WorkspaceService } from "../services/api/src/workspace";
import { MemoryRepository, validLead } from "./fixtures";
const keyOf = (key: Key) => `${key.pk}\0${key.sk}`;
export class MemoryWorkspaceStore implements WorkspaceStore {
  rows = new Map<string, Row>();
  audit: Record<string, unknown>[] = [];
  beforeCommit?: () => void;
  put(value: Row) {
    this.rows.set(keyOf(value), structuredClone(value));
  }
  async get<T>(key: Key) {
    return structuredClone(this.rows.get(keyOf(key))) as Row<T> | undefined;
  }
  async page<T>(pk: string, prefix: string, cursor?: string, reverse = false) {
    const start = cursorDecode(pk, prefix, cursor);
    let items = [...this.rows.values()]
      .filter((i) => i.pk === pk && i.sk.startsWith(prefix))
      .sort((a, b) => a.sk.localeCompare(b.sk));
    if (reverse) items.reverse();
    if (start)
      items = items.filter((i) =>
        reverse ? i.sk < start.sk : i.sk > start.sk,
      );
    const page = items.slice(0, 25);
    return {
      items: structuredClone(page) as Row<T>[],
      ...(items.length > 25
        ? { nextCursor: cursorEncode(pk, prefix, page.at(-1)!.sk) }
        : {}),
    };
  }
  async commit(change: Change) {
    this.beforeCommit?.();
    this.beforeCommit = undefined;
    const checks = new Map(change.checks.map((c) => [keyOf(c), c]));
    for (const p of change.puts)
      if (!checks.has(keyOf(p))) checks.set(keyOf(p), check(p));
    for (const [key, c] of checks) {
      const old = this.rows.get(key);
      if (c.staff) {
        const d = old?.data as { active?: boolean; role?: string } | undefined;
        if (!d?.active || d.role !== (c.staff === "EMPLOYEE" ? "EMPLOYEE" : "FOUNDER_ADMIN")) return false;
      } else if (c.version === null ? !!old : old?.version !== c.version)
        return false;
    }
    for (const p of change.puts) this.put(p);
    this.audit.push(structuredClone(change.audit));
    return true;
  }
}
export class MemoryIdentity implements IdentityProvider {
  identities = new Map<string, VerifiedIdentity>();
  accounts = new Set<string>();
  provisions = 0;
  codes = 0;
  async current(actor: Actor) {
    const user = this.identities.get(actor.sub);
    if (!user) throw new Error("Identity unavailable");
    return structuredClone(user);
  }
  async ensureAccount(email: string): Promise<"CREATED" | "EXISTING"> {
    if (this.accounts.has(email)) return "EXISTING";
    this.accounts.add(email);
    this.provisions++;
    return "CREATED";
  }
  async requestVerification() {
    this.codes++;
  }
  async verify(actor: Actor) {
    const i = this.identities.get(actor.sub)!;
    i.emailVerified = true;
  }
}
export async function workspaceFixture() {
  const store = new MemoryWorkspaceStore(),
    leads = new MemoryRepository(),
    identity = new MemoryIdentity();
  let now = new Date("2026-10-23T10:00:00.000Z");
  const founder = { sub: "founder", token: "founder-access" },
    a = { sub: "customer-a", token: "a-access" },
    b = { sub: "customer-b", token: "b-access" };
  const grant = {
    userId: founder.sub,
    role: "FOUNDER_ADMIN" as const,
    active: true,
  };
  leads.staff.set(founder.sub, grant);
  store.put(row(meta(`STAFF#${founder.sub}`), grant));
  for (const actor of [founder, a, b])
    identity.identities.set(actor.sub, {
      userId: actor.sub,
      email: `${actor.sub}@example.com`,
      emailVerified: true,
    });
  const leadId = "LEAD-2026-0123456789ABCDEF";
  leads.leads.set(leadId, {
    ...validLead,
    leadId,
    status: "QUALIFIED",
    version: 1,
    createdAt: now.toISOString(),
  });
  const service = new WorkspaceService(store, leads, identity, () => now);
  const body = {
    leadId,
    title: validLead.title,
    summary: validLead.description,
  };
  const project = await service.createProject(founder, body, randomUUID());
  async function join(actor: Actor) {
    const email = identity.identities.get(actor.sub)!.email;
    const invitation = await service.invite(
      founder,
      project.projectId,
      { email },
      randomUUID(),
    );
    await service.acceptInvite(actor, { token: invitation.token });
    return invitation;
  }
  return {
    store,
    leads,
    identity,
    service,
    founder,
    a,
    b,
    project,
    body,
    join,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}
