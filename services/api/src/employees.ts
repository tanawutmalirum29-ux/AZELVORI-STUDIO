import { randomBytes, randomUUID } from "node:crypto";
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminDisableUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { authorizeStaff, HttpError, type Repository } from "./domain";
import { meta, row, check, type WorkspaceStore, type Row } from "./workspace-store";
import type { Actor } from "./identity";

export const employeeInput = z.object({
  firstName: z.string().trim().min(1).max(70),
  lastName: z.string().trim().min(1).max(70),
  nickname: z.string().trim().min(1).max(40),
}).strict();
export type Employee = {
  key: string; userId: string; role: "EMPLOYEE"; firstName: string; lastName: string;
  nickname: string; active: boolean; version: number; createdAt: string;
  loginUsername?: string;
  revokedAt?: string;
};
export const employeeKey = (sub: string) => meta("EMPLOYEE#" + sub);
const listingKey = (code: string) => ({ pk: "EMPLOYEE_DIRECTORY", sk: "KEY#" + code });
const founderKey = (sub: string) => ({ ...meta("STAFF#" + sub), version: null, staff: true as const });

export class EmployeeService {
  constructor(
    private store: WorkspaceStore, private leads: Repository,
    private table: string, private pool: string, private auditTable: string,
    private cognito = new CognitoIdentityProviderClient({}),
    private dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}
  private async founder(actor: Actor) { await authorizeStaff(this.leads, actor.sub); }
  /** New key counter grows forever. Reissued keys are selected explicitly by the founder. */
  private async nextNumber(): Promise<number> {
    const out = await this.dynamo.send(new UpdateCommand({
      TableName: this.table, Key: { pk: "SEQUENCE#EMPLOYEE", sk: "META" },
      UpdateExpression: "ADD #seq :one",
      ExpressionAttributeNames: { "#seq": "seq" },
      ExpressionAttributeValues: { ":one": 1 },
      ReturnValues: "UPDATED_NEW",
    }));
    const value = out.Attributes?.seq;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
      throw new Error("Employee sequence is not safe");
    return value;
  }
  async list(actor: Actor, cursor?: string) {
    await this.founder(actor);
    const page = await this.store.page<Employee>("EMPLOYEE_DIRECTORY", "KEY#", cursor);
    return { items: page.items.map((item) => item.data), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) };
  }
  /**
   * A second durable, atomic sequence identifies EACH credential issuance,
   * including reuse of an employee key. Never reset this counter.
   * The AZb prefix does not overlap with previously issued AZa passwords.
   */
  private async nextIssue(): Promise<number> {
    const out = await this.dynamo.send(new UpdateCommand({
      TableName: this.table, Key: { pk: "SEQUENCE#EMPLOYEE_CREDENTIAL", sk: "META" },
      UpdateExpression: "ADD #seq :one",
      ExpressionAttributeNames: { "#seq": "seq" },
      ExpressionAttributeValues: { ":one": 1 },
      ReturnValues: "UPDATED_NEW",
    }));
    const value = out.Attributes?.seq;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
      throw new Error("Employee credential sequence is not safe");
    return value;
  }

  /**
   * Create a new *Cognito user* per issuance. Re-enabling the old identity
   * would let its previously-issued access tokens gain the new worker's grant.
   */
  private async issue(
    actor: Actor, key: string, parsed: z.infer<typeof employeeInput>,
    previous?: Row<Employee>,
  ) {
    const issue = await this.nextIssue();
    // Password is globally unique across newly issued credentials, even if
    // randomness collides. An old AZa-... password can never equal AZb-....
    const password = "AZb-" + issue + "-" + key + "-" + randomBytes(22).toString("base64url");
    // The staff browser recovers the issue number from the password, not from
    // a public key->username lookup API. Old AZa credentials still use emp-{key}.
    const username = "emp-" + key + "-v" + issue;
    const created = await this.cognito.send(new AdminCreateUserCommand({
      UserPoolId: this.pool, Username: username, TemporaryPassword: password,
      MessageAction: "SUPPRESS",
      UserAttributes: [{ Name: "name", Value: parsed.firstName + " " + parsed.lastName }],
    }));
    const sub = created.User?.Attributes?.find((a) => a.Name === "sub")?.Value;
    if (!sub) {
      await this.cognito.send(new AdminDisableUserCommand({ UserPoolId: this.pool, Username: username }));
      throw new Error("Employee Cognito user missing subject");
    }
    try {
      await this.cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: this.pool, Username: username, Password: password, Permanent: true,
      }));
      const employee: Employee = {
        key, userId: sub, loginUsername: username, role: "EMPLOYEE",
        ...parsed, active: true, version: (previous?.version ?? 0) + 1,
        createdAt: new Date().toISOString(),
      };
      // New subjects are unique. Existing directory records are updated only
      // if still disabled with the same version, so two competing reissues
      // cannot both activate. The losing Cognito identity gets disabled.
      const saved = await this.store.commit({
        checks: [
          founderKey(actor.sub),
          ...(previous ? [check(previous, previous)] : []),
        ],
        puts: [
          row(employeeKey(sub), employee, employee.version),
          row(listingKey(key), employee, employee.version),
        ],
        audit: {
          pk: "EMPLOYEE#" + sub, sk: employee.createdAt + "#" + randomUUID(),
          action: previous ? "employee.reissued" : "employee.created",
          actor: actor.sub, target: key, at: employee.createdAt,
          ...(previous ? { formerUserId: previous.data.userId } : {}),
        },
      });
      if (!saved)
        throw new HttpError(409, "EMPLOYEE_CREATE_CONFLICT",
          "คีย์ถูกใช้งานหรือข้อมูลเปลี่ยนแล้ว กรุณาโหลดรายการใหม่");
      // Plaintext secret is returned only once; not persisted in our DB.
      return { employee, password };
    } catch (error) {
      await this.cognito.send(new AdminDisableUserCommand({
        UserPoolId: this.pool, Username: username,
      })).catch(() => undefined);
      throw error;
    }
  }
  async create(actor: Actor, raw: unknown) {
    await this.founder(actor);
    const parsed = employeeInput.safeParse(raw);
    if (!parsed.success)
      throw new HttpError(422, "INVALID_EMPLOYEE", "กรอกชื่อ นามสกุล และชื่อเล่นพนักงานให้ครบ");
    const key = String(await this.nextNumber()).padStart(5, "0");
    return this.issue(actor, key, parsed.data);
  }
  /** Reassign a *disabled key* to a fresh employee, not the former Cognito account. */
  async reissue(actor: Actor, key: string, raw: unknown) {
    await this.founder(actor);
    if (!/^\d{5,}$/.test(key))
      throw new HttpError(404, "NOT_FOUND", "ไม่พบคีย์พนักงาน");
    const parsed = employeeInput.safeParse(raw);
    if (!parsed.success)
      throw new HttpError(422, "INVALID_EMPLOYEE", "กรอกชื่อ นามสกุล และชื่อเล่นพนักงานให้ครบ");
    const former = await this.store.get<Employee>(listingKey(key));
    if (!former)
      throw new HttpError(404, "NOT_FOUND", "ไม่พบคีย์พนักงาน");
    if (former.data.active)
      throw new HttpError(409, "EMPLOYEE_KEY_ACTIVE", "คีย์นี้ยังใช้งานอยู่ ต้องปิดก่อน");
    return this.issue(actor, key, parsed.data, former);
  }
  async revoke(actor: Actor, code: string) {
    await this.founder(actor);
    if (!/^\d{5,}$/.test(code)) throw new HttpError(404, "NOT_FOUND", "ไม่พบพนักงาน");
    const listing = await this.store.get<Employee>(listingKey(code));
    if (!listing) throw new HttpError(404, "NOT_FOUND", "ไม่พบพนักงาน");
    if (!listing.data.active) return { employee: listing.data };
    const primary = await this.store.get<Employee>(employeeKey(listing.data.userId));
    if (!primary?.data.active) throw new HttpError(409, "STALE_EMPLOYEE", "สถานะพนักงานถูกเปลี่ยนแล้ว");
    const now = new Date().toISOString();
    const employee: Employee = { ...primary.data, active: false, version: primary.version + 1, revokedAt: now };
    const ok = await this.store.commit({
      checks: [founderKey(actor.sub), check(primary, primary), check(listing, listing)],
      puts: [row(employeeKey(employee.userId), employee, employee.version), row(listingKey(code), employee, employee.version)],
      audit: { pk: "EMPLOYEE#" + employee.userId, sk: now + "#" + randomUUID(),
        action: "employee.revoked", actor: actor.sub, target: code, at: now },
    });
    if (!ok) throw new HttpError(409, "STALE_EMPLOYEE", "สถานะพนักงานถูกเปลี่ยนแล้ว");
    try {
      await this.cognito.send(new AdminDisableUserCommand({
        UserPoolId: this.pool, Username: listing.data.loginUsername ?? "emp-" + code,
      }));
    } catch {
      // API authorization remains revoked immediately even if Cognito fails.
    }
    return { employee };
  }
  async leadsPage(actor: Actor, cursor?: string) {
    await this.active(actor);
    return this.leads.listLeads(cursor);
  }
  /** Staff acknowledgement never approves a contract or creates a project. */
  async acknowledge(actor: Actor, id: string) {
    await this.active(actor);
    if (!/^LEAD-\d{4}-[A-F0-9]{16}$/.test(id))
      throw new HttpError(404, "NOT_FOUND", "ไม่พบงาน");
    const lead = await this.leads.getLead(id);
    if (!lead) throw new HttpError(404, "NOT_FOUND", "ไม่พบงาน");
    if (lead.status !== "NEW")
      throw new HttpError(409, "ALREADY_HANDLED", "งานนี้ถูกรับเรื่องหรือเปลี่ยนสถานะแล้ว");
    const now = new Date().toISOString();
    try {
      await this.dynamo.send(new TransactWriteCommand({
        TransactItems: [
          { ConditionCheck: {
            TableName: this.table, Key: { pk: "EMPLOYEE#" + actor.sub, sk: "META" },
            ConditionExpression: "#d.#active = :yes AND #d.#role = :role",
            ExpressionAttributeNames: { "#d": "data", "#active": "active", "#role": "role" },
            ExpressionAttributeValues: { ":yes": true, ":role": "EMPLOYEE" },
          } },
          { Update: {
            TableName: this.table, Key: { pk: "LEAD#" + id, sk: "META" },
            UpdateExpression: "SET #d.#status = :ack, #d.#version = :next",
            ConditionExpression: "#d.#version = :old AND #d.#status = :new",
            ExpressionAttributeNames: { "#d": "data", "#status": "status", "#version": "version" },
            ExpressionAttributeValues: { ":ack": "ACKNOWLEDGED", ":new": "NEW",
              ":old": lead.version, ":next": lead.version + 1 },
          } },
          { Put: {
            TableName: this.auditTable,
            Item: { pk: "LEAD#" + id, sk: now + "#" + randomUUID(),
              action: "employee.lead.acknowledged", target: id, actor: actor.sub, at: now },
            ConditionExpression: "attribute_not_exists(pk)",
          } },
        ],
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "TransactionCanceledException")
        throw new HttpError(409, "STALE_LEAD", "งานหรือสิทธิ์เปลี่ยนแล้ว กรุณาโหลดใหม่");
      throw error;
    }
    return { lead: { ...lead, status: "ACKNOWLEDGED" as const, version: lead.version + 1 } };
  }
  async active(actor: Actor) {
    const record = await this.store.get<Employee>(employeeKey(actor.sub));
    if (!record?.data.active || record.data.userId !== actor.sub)
      throw new HttpError(403, "EMPLOYEE_DISABLED", "บัญชีพนักงานถูกปิดหรือไม่มีสิทธิ์");
    return record.data;
  }
}
