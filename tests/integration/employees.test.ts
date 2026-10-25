import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EmployeeService } from "../../services/api/src/employees";
import { workspaceFixture } from "../workspace-fixtures";

async function fixture(first = 0) {
  const f = await workspaceFixture();
  let sequence = first;
  let issued = 0;
  const commands: { name: string; input: any }[] = [];
  let account = 0;
  const cognito = {
    send: vi.fn(async (cmd: { constructor: { name: string }; input: any }) => {
      commands.push({ name: cmd.constructor.name, input: cmd.input });
      if (cmd.constructor.name === "AdminCreateUserCommand") {
        account++;
        return { User: { Attributes: [{ Name: "sub", Value: "staff-sub-" + account }] } };
      }
      return {};
    }),
  } as unknown as CognitoIdentityProviderClient;
  const db = {
    send: vi.fn(async (cmd: { constructor: { name: string }; input: any }) => {
      commands.push({ name: cmd.constructor.name, input: cmd.input });
      if (cmd.constructor.name === "UpdateCommand") {
        const id = cmd.input.Key.pk === "SEQUENCE#EMPLOYEE_CREDENTIAL" ? ++issued : ++sequence;
        return { Attributes: { seq: id } };
      }
      return {};
    }),
  } as unknown as DynamoDBDocumentClient;
  const service = new EmployeeService(f.store, f.leads, "data", "staff-pool", "audit", cognito, db);
  const input = { firstName: "สมชาย", lastName: "ตัวอย่าง", nickname: "บอย" };
  return { ...f, employeeDirectory: service, commands, input };
}
describe("founder-issued employee credentials and access", () => {
  it("creates two never-reused sequential keys, never persists passwords, and revokes instantly", async () => {
    const f = await fixture();
    const a = await f.employeeDirectory.create(f.founder, f.input);
    const b = await f.employeeDirectory.create(f.founder, { ...f.input, nickname: "นัท" });
    expect(a.employee.key).toBe("00001");
    expect(b.employee.key).toBe("00002");
    expect(a.password).not.toBe(b.password);
    expect(a.password).toContain(a.employee.key);
    expect(b.password).toContain(b.employee.key);
    expect(JSON.stringify([...f.store.rows.values()])).not.toContain(a.password);
    expect(JSON.stringify([...f.store.rows.values()])).not.toContain(b.password);
    expect((await f.employeeDirectory.list(f.founder)).items).toHaveLength(2);
    const staffActor = { sub: a.employee.userId, token: "employee-access" };
    expect((await f.employeeDirectory.active(staffActor)).active).toBe(true);
    expect((await f.employeeDirectory.revoke(f.founder, a.employee.key)).employee.active).toBe(false);
    await expect(f.employeeDirectory.active(staffActor)).rejects.toMatchObject({ status: 403 });
    await expect(f.employeeDirectory.revoke(f.founder, "99999")).rejects.toMatchObject({ status: 404 });
    expect(f.commands.filter(c=>c.name==="AdminDisableUserCommand")).toHaveLength(1);
    const c = await f.employeeDirectory.create(f.founder, { ...f.input, nickname: "ใหม่" });
    expect(c.employee.key).toBe("00003");
    expect(new Set([a.password,b.password,c.password]).size).toBe(3);
    expect((await f.employeeDirectory.list(f.founder)).items.find(x=>x.key==="00001")?.active).toBe(false);
  });
  it("reuses disabled key with globally fresh credential and a different Cognito subject", async () => {
    const f = await fixture();
    const first = await f.employeeDirectory.create(f.founder, f.input);
    const second = await f.employeeDirectory.create(f.founder, { ...f.input, nickname: "นัท" });
    const oldActor = { sub: first.employee.userId, token: "former-employee-jwt" };
    expect(first.employee.loginUsername).toBe("emp-00001-v1");
    expect(second.employee.loginUsername).toBe("emp-00002-v2");
    await expect(f.employeeDirectory.reissue(f.founder, first.employee.key, f.input))
      .rejects.toMatchObject({ status: 409, code: "EMPLOYEE_KEY_ACTIVE" });
    const inactive = await f.employeeDirectory.revoke(f.founder, first.employee.key);
    expect(inactive.employee.active).toBe(false);
    const replacement = await f.employeeDirectory.reissue(f.founder, first.employee.key, {
      firstName: "จิรา", lastName: "ทดสอบ", nickname: "พลอย",
    });
    expect(replacement.employee.key).toBe(first.employee.key);
    expect(replacement.employee.userId).not.toBe(first.employee.userId);
    expect(replacement.employee.loginUsername).toBe("emp-00001-v3");
    expect(replacement.password).toContain("-3-00001-");
    expect([first.password, second.password]).not.toContain(replacement.password);
    await expect(f.employeeDirectory.active(oldActor)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.employeeProjects(oldActor)).rejects.toMatchObject({ status: 403 });
    await expect(f.employeeDirectory.active({
      sub: replacement.employee.userId, token: "new-employee-jwt",
    })).resolves.toMatchObject({ active: true, nickname: "พลอย" });
    const dir = (await f.employeeDirectory.list(f.founder)).items;
    expect(dir).toHaveLength(2);
    expect(dir.find(e => e.key === "00001")?.userId).toBe(replacement.employee.userId);
    expect(f.store.audit.some(a => a.action === "employee.reissued" &&
      a.formerUserId === first.employee.userId)).toBe(true);
    expect(JSON.stringify([...f.store.rows.values()])).not.toContain(replacement.password);
    await f.employeeDirectory.revoke(f.founder, replacement.employee.key);
    const third = await f.employeeDirectory.reissue(f.founder, "00001", f.input);
    expect(third.password).not.toBe(replacement.password);
    expect(new Set([first.password,second.password,replacement.password,third.password]).size).toBe(4);
    expect(third.employee.loginUsername).toBe("emp-00001-v4");
    await expect(f.employeeDirectory.active({ sub: replacement.employee.userId, token: "revoked" }))
      .rejects.toMatchObject({status:403});
    expect(f.commands.filter(x => x.name === "AdminDisableUserCommand")
      .map(x => x.input.Username)).toEqual(["emp-00001-v1","emp-00001-v1","emp-00001-v3","emp-00001-v3"]);
  });
  it("a raced reissue cannot reactivate a retired identity or overwrite current directory", async () => {
    const f = await fixture();
    const first = await f.employeeDirectory.create(f.founder, f.input);
    await f.employeeDirectory.revoke(f.founder, first.employee.key);
    f.store.beforeCommit = () => {
      const directory = f.store.rows.get("EMPLOYEE_DIRECTORY\0KEY#00001");
      if (directory) f.store.put({ ...directory, version: directory.version + 1 });
    };
    await expect(f.employeeDirectory.reissue(f.founder, "00001", f.input))
      .rejects.toMatchObject({ status: 409 });
    expect((await f.employeeDirectory.list(f.founder)).items[0].active).toBe(false);
    expect(f.commands.at(-1)?.name).toBe("AdminDisableUserCommand");
    expect(f.commands.at(-1)?.input.Username).toBe("emp-00001-v2");
  });
  it("expands key length after 99999 without recycling a single number", async () => {
    const f = await fixture(99998);
    const last = await f.employeeDirectory.create(f.founder, f.input);
    const next = await f.employeeDirectory.create(f.founder, f.input);
    expect(last.employee.key).toBe("99999");
    expect(next.employee.key).toBe("100000");
    expect(next.password).toContain("100000");
  });
  it("rejects unauthorized issuance, admin-less claims and cross-client employee reads", async () => {
    const f = await fixture();
    await expect(f.employeeDirectory.create(f.a, f.input)).rejects.toMatchObject({ status: 403 });
    await expect(f.employeeDirectory.list(f.a)).rejects.toMatchObject({ status: 403 });
    const a = await f.employeeDirectory.create(f.founder, f.input);
    const actor = { sub: a.employee.userId, token: "employee-token" };
    const projects = await f.employeeDirectory.active(actor);
    expect(projects.role).toBe("EMPLOYEE");
    expect(f.commands.some(c=>c.name==="AdminSetUserPasswordCommand" && c.input.Permanent===true)).toBe(true);
    expect(f.commands.some(c=>c.name==="AdminCreateUserCommand" && c.input.MessageAction==="SUPPRESS")).toBe(true);
  });
  it("staff can reply to project messages but loses access on revoke", async () => {
    const f = await fixture();
    const created = await f.employeeDirectory.create(f.founder, f.input);
    const actor = { sub: created.employee.userId, token: "employee-token" };
    const projects = await f.service.employeeProjects(actor);
    expect(projects.items.some(p=>p.projectId===f.project.projectId)).toBe(true);
    const response = await f.service.employeeSend(actor, f.project.projectId,
      { text: "รับเรื่องแล้วครับ" }, randomUUID());
    expect(response.senderRole).toBe("STUDIO");
    expect((await f.service.employeeMessages(actor, f.project.projectId)).items
      .some(m=>m.messageId===response.messageId)).toBe(true);
    await f.employeeDirectory.revoke(f.founder, created.employee.key);
    await expect(f.service.employeeProjects(actor)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.employeeSend(actor, f.project.projectId,
      {text:"cannot send"},randomUUID())).rejects.toMatchObject({status:403});
  });
});
