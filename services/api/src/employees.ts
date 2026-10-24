import { randomBytes, randomUUID } from "node:crypto";
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminDisableUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { authorizeStaff, HttpError, type Repository } from "./domain";
import { meta, row, check, type WorkspaceStore } from "./workspace-store";
import type { Actor } from "./identity";

export const employeeInput = z.object({
  firstName: z.string().trim().min(1).max(70),
  lastName: z.string().trim().min(1).max(70),
  nickname: z.string().trim().min(1).max(40),
}).strict();
export type Employee = {
  key: string; userId: string; role: "EMPLOYEE"; firstName: string; lastName: string;
  nickname: string; active: boolean; version: number; createdAt: string;
  revokedAt?: string;
};
export const employeeKey = (sub: string) => meta("EMPLOYEE#" + sub);
const listingKey = (code: string) => ({ pk: "EMPLOYEE_DIRECTORY", sk: "KEY#" + code });
const founderKey = (sub: string) => ({ ...meta("STAFF#" + sub), version: null, staff: true as const });

export class EmployeeService {
  constructor(
    private store: WorkspaceStore, private leads: Repository,
    private table: string, private pool: string,
    private cognito = new CognitoIdentityProviderClient({}),
    private dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}
  private async founder(actor: Actor) { await authorizeStaff(this.leads, actor.sub); }
  /** Atomic persistent counter. Disabled and failed registrations never recycle numbers. */
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
  async create(actor: Actor, raw: unknown) {
    await this.founder(actor);
    const parsed = employeeInput.safeParse(raw);
    if (!parsed.success)
      throw new HttpError(422, "INVALID_EMPLOYEE", "กรอกชื่อ นามสกุล และชื่อเล่นพนักงานให้ครบ");
    const key = String(await this.nextNumber()).padStart(5, "0");
    // Embedding the non-recycled key makes generated passwords unique across all issues,
    // independent of random collision probability. Never store password in DynamoDB.
    const password = "AZa-" + key + "-" + randomBytes(22).toString("base64url");
    const username = "emp-" + key;
    const created = await this.cognito.send(new AdminCreateUserCommand({
      UserPoolId: this.pool, Username: username, TemporaryPassword: password,
      MessageAction: "SUPPRESS",
      UserAttributes: [{ Name: "name", Value: parsed.data.firstName + " " + parsed.data.lastName }],
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
        key, userId: sub, role: "EMPLOYEE", ...parsed.data, active: true,
        version: 1, createdAt: new Date().toISOString(),
      };
      const saved = await this.store.commit({
        checks: [founderKey(actor.sub)],
        puts: [row(employeeKey(sub), employee), row(listingKey(key), employee)],
        audit: { pk: "EMPLOYEE#" + sub, sk: employee.createdAt + "#" + randomUUID(),
          action: "employee.created", actor: actor.sub, target: key, at: employee.createdAt },
      });
      if (!saved) throw new HttpError(409, "EMPLOYEE_CREATE_CONFLICT", "สิทธิ์หรือข้อมูลพนักงานเปลี่ยน กรุณาลองอีกครั้ง");
      return { employee, password };
    } catch (error) {
      await this.cognito.send(new AdminDisableUserCommand({
        UserPoolId: this.pool, Username: username,
      })).catch(() => undefined);
      throw error;
    }
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
        UserPoolId: this.pool, Username: "emp-" + code,
      }));
    } catch {
      // API authorization remains revoked immediately even if Cognito fails.
    }
    return { employee };
  }
  async active(actor: Actor) {
    const record = await this.store.get<Employee>(employeeKey(actor.sub));
    if (!record?.data.active || record.data.userId !== actor.sub)
      throw new HttpError(403, "EMPLOYEE_DISABLED", "บัญชีพนักงานถูกปิดหรือไม่มีสิทธิ์");
    return record.data;
  }
}
