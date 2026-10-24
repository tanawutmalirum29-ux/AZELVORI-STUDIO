import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type {
  StudioProject,
  ProjectMessage,
  ProjectMember,
  LeadRecord,
} from "@azelvori/contracts";
import { validLead } from "../fixtures";

const authority =
  "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_QATEST";
const projectId = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(64);
const date = "2026-10-23T09:00:00.000Z";
// This suite tests the production UI against a deterministic HTTP boundary.
// It does not claim to exercise a deployed Cognito pool or DynamoDB table.
async function setup(page: Page, staff = false, verified = true) {
  const userId = staff ? "founder" : "customer-a";
  await page.addInitScript(
    ({ authority, userId }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      sessionStorage.setItem(
        `oidc.user:${authority}:qa-client`,
        JSON.stringify({
          access_token: "qa-access",
          token_type: "Bearer",
          expires_at: exp,
          scope: "openid email aws.cognito.signin.user.admin azelvori/access",
          profile: {
            sub: userId,
            iss: authority,
            aud: "qa-client",
            exp,
            iat: exp - 3600,
          },
        }),
      );
    },
    { authority, userId },
  );
  const state = {
    identity: {
      userId,
      email: `${userId}@example.com`,
      emailVerified: verified,
      staff,
    },
    project: {
      projectId,
      tenantId: "22222222-2222-4222-8222-222222222222",
      leadId: "LEAD-2026-0123456789ABCDEF",
      title: "เว็บไซต์ร้านตัวอย่าง",
      summary: validLead.description,
      serviceType: "WEBSITE",
      state: "IN_PROGRESS",
      version: 1,
      createdAt: date,
      updatedAt: date,
      milestones: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          label: "ยืนยันบรีฟและขอบเขตงาน",
          weight: 25,
          status: "REVIEW",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          label: "พัฒนาและส่งให้ตรวจ",
          weight: 50,
          status: "PENDING",
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          label: "ตรวจรับและส่งมอบ",
          weight: 25,
          status: "PENDING",
        },
      ],
    } as StudioProject,
    member: {
      userId: "customer-a",
      email: "customer-a@example.com",
      projectId,
      role: "CUSTOMER",
      active: true,
      version: 1,
      joinedAt: date,
    } as ProjectMember,
    messages: [] as ProjectMessage[],
    sendKeys: [] as string[],
    acceptedVersions: [] as string[],
    failSend: false,
    revoked: false,
    requestedCode: false,
    acceptedInvite: false,
    invitedEmail: "",
    inviteRevoked: false,
    created: false,
    lead: {
      ...validLead,
      leadId: "LEAD-2026-0123456789ABCDEF",
      status: "QUALIFIED",
      version: 1,
      createdAt: date,
    } as LeadRecord,
    crmUnavailable: false,
    crmForbidden: false,
    adminRequests: [] as string[],
  };
  await page.route("https://api.example.test/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace("/api/v1", ""),
      method = request.method();
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    };
    const send = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    const fail = (status: number, message: string) =>
      send({ error: { code: "TEST_FAILURE", message } }, status);
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/me") return send(state.identity);
    if (path === "/me/email/request") {
      state.requestedCode = true;
      return send({ status: "CODE_SENT" });
    }
    if (path === "/me/email/verify") {
      state.identity.emailVerified = true;
      return send(state.identity);
    }
    if (path === "/invitations/accept") {
      expect(request.postDataJSON().token).toBe(token);
      state.acceptedInvite = true;
      return send(state.project);
    }
    if (path.startsWith("/admin/leads")) {
      state.adminRequests.push(`${method} ${path}`);
      if (state.crmForbidden) return fail(403, "สิทธิ์ผู้ดูแลถูกถอน");
      if (path === "/admin/leads") return send({ items: [state.lead] });
      if (method === "GET")
        return send({
          lead: state.lead,
          ...(state.created ? { projectId } : {}),
        });
      if (method === "PATCH") {
        if (state.crmUnavailable) {
          state.crmUnavailable = false;
          return fail(503, "ลองใหม่อีกครั้ง ร่างยังไม่ถูกบันทึก");
        }
        if (request.headers()["if-match"] !== String(state.lead.version))
          return fail(409, "บรีฟถูกเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด");
        const body = request.postDataJSON();
        state.lead = {
          ...state.lead,
          version: state.lead.version + 1,
          ...(body.status
            ? { status: body.status }
            : { followUp: { ...body.followUp, updatedAt: date } }),
        };
        return send(state.lead);
      }
    }
    if (path === "/admin/projects" && method === "POST") {
      state.created = true;
      return send(state.project, 201);
    }
    if (state.revoked) return fail(404, "ไม่พบโปรเจกต์หรือไม่มีสิทธิ์เข้าถึง");
    if (path === "/projects") return send({ items: [state.project] });
    if (path === `/projects/${projectId}`) return send(state.project);
    if (path === `/projects/${projectId}/messages`) {
      if (method === "GET") return send({ items: state.messages });
      state.sendKeys.push(request.headers()["idempotency-key"]);
      if (state.failSend) {
        state.failSend = false;
        return fail(503, "ระบบไม่พร้อมชั่วคราว กรุณาลองใหม่");
      }
      const saved: ProjectMessage = {
        messageId: "66666666-6666-4666-8666-666666666666",
        projectId,
        senderId: userId,
        senderRole: staff ? "STUDIO" : "CUSTOMER",
        text: request.postDataJSON().text,
        createdAt: date,
        status: "PERSISTED",
      };
      state.messages.push(saved);
      return send(saved, 201);
    }
    if (path.endsWith("/accept") && path.includes("/milestones/")) {
      const version = request.headers()["if-match"];
      state.acceptedVersions.push(version);
      if (version !== String(state.project.version))
        return fail(409, "ข้อมูลเปลี่ยนแล้ว กรุณาตรวจเวอร์ชันใหม่");
      state.project.milestones[0] = {
        ...state.project.milestones[0],
        status: "ACCEPTED",
        acceptedBy: userId,
        acceptedAt: date,
      };
      state.project.version++;
      return send(state.project);
    }
    if (path === `/admin/projects/${projectId}/invitations`) {
      state.invitedEmail = request.postDataJSON().email;
      return send(
        {
          invitationId: "77777777-7777-4777-8777-777777777777",
          token,
          expiresAt: "2026-10-26T09:00:00.000Z",
          account: "CREATED",
          replayed: false,
        },
        201,
      );
    }
    if (path.includes("/invitations/") && path.endsWith("/revoke")) {
      state.inviteRevoked = true;
      return send({ status: "REVOKED" });
    }
    if (path === `/admin/projects/${projectId}/members`)
      return send({ items: [state.member] });
    if (path.includes("/members/") && path.endsWith("/revoke")) {
      expect(request.headers()["if-match"]).toBe("1");
      state.member.active = false;
      state.member.version++;
      return send(state.member);
    }
    return fail(404, `Unhandled fixture: ${method} ${path}`);
  });
  return state;
}
async function layout(page: Page, info: TestInfo, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  for (const item of await page.locator(".wks-milestones > li > div").all()) {
    // A row may fit the viewport while its text is squeezed into one-word columns.
    expect((await item.boundingBox())!.width).toBeGreaterThanOrEqual(140);
  }
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
}
test("founder inbox replies, retries without duplicates and reloads saved messages", async ({
  page,
}, info) => {
  const state = await setup(page, true);
  state.messages.push({
    messageId: "88888888-8888-4888-8888-888888888888",
    projectId,
    senderId: "customer-a",
    senderRole: "CUSTOMER",
    text: "<img src=x onerror=alert(1)> คุยรายละเอียดเว็บไซต์",
    createdAt: date,
    status: "PERSISTED",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/inbox");
  await expect(page.getByRole("heading", { name: "กล่องข้อความลูกค้า" })).toBeVisible();
  await expect(page.getByText("คุยรายละเอียดเว็บไซต์", { exact: false })).toBeVisible();
  const reply = page.getByRole("textbox", { name: "ตอบกลับลูกค้า", exact: true });
  const text = "<script>bad()</script> ส่งราคาเบื้องต้นหลังตรวจบรีฟ";
  await reply.fill(text);
  state.failSend = true;
  await page.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ระบบไม่พร้อมชั่วคราว");
  await expect(reply).toHaveValue(text);
  await page.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  expect(state.sendKeys).toHaveLength(2);
  expect(state.sendKeys[0]).toBe(state.sendKeys[1]);
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(reply).toHaveValue("");
  await layout(page, info, "founder-inbox");
  expect((await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("customer cannot enter the founder inbox or request other threads", async ({
  page,
}) => {
  await setup(page, false);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/projects")) requests.push(request.url());
  });
  await page.goto("/admin/inbox");
  await expect(page.getByText("บัญชีลูกค้าไม่สามารถเปิดข้อความของสตูดิโอได้")).toBeVisible();
  expect(requests).toEqual([]);
});

test("customer message retries keep draft and key, escape markup, survive reload", async ({
  page,
}, info) => {
  const state = await setup(page);
  state.failSend = true;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app");
  const draft = page.getByRole("textbox", {
    name: "ข้อความถึงสตูดิโอ",
    exact: true,
  });
  const text = "<script>alert(1)</script> ตรวจรายละเอียดงานสำหรับมือถือครับ";
  await draft.fill(text);
  await page.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
  await expect(
    page.getByText("ระบบไม่พร้อมชั่วคราว กรุณาลองใหม่", { exact: true }),
  ).toBeVisible();
  await expect(draft).toHaveValue(text);
  await page.getByRole("button", { name: "ส่งข้อความ", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  expect(state.sendKeys).toHaveLength(2);
  expect(state.sendKeys[0]).toBe(state.sendKeys[1]);
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(draft).toHaveValue("");
  await layout(page, info, "customer-workspace");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("review confirmation pins displayed version and reloads after conflict", async ({
  page,
}, info) => {
  const state = await setup(page);
  await page.goto("/app");
  await page
    .getByRole("button", { name: "ตรวจรับ milestone", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("เวอร์ชัน 1");
  state.project.version = 2;
  await page.getByRole("button", { name: "ยืนยันตรวจรับเวอร์ชันนี้" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("ข้อมูลเปลี่ยนแล้ว กรุณาตรวจเวอร์ชันใหม่", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("เวอร์ชัน 2", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "ตรวจรับ milestone", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("เวอร์ชัน 2");
  await layout(page, info, "review-version");
  await page.getByRole("button", { name: "ยืนยันตรวจรับเวอร์ชันนี้" }).click();
  await expect(
    page.getByText("บันทึกการตรวจรับ milestone แล้ว", { exact: true }),
  ).toBeVisible();
  expect(state.acceptedVersions).toEqual(["1", "2"]);
  await expect(page.locator(".wks-progress")).toContainText("25%");
});
test("founder creates from ready brief, issues and revokes invitation and member", async ({
  page,
}, info) => {
  const state = await setup(page, true);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: /ผ่านการประเมิน.*เว็บไซต์ร้านตัวอย่าง/ })
    .click();
  await page.getByRole("button", { name: "สร้างโปรเจกต์ส่วนตัว" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/projects\\?project=${projectId}`),
  );
  await page
    .getByLabel("อีเมลลูกค้าที่ต้องการเชิญ")
    .fill("new-customer@example.com");
  await page.getByRole("button", { name: "สร้างคำเชิญ", exact: true }).click();
  await expect(
    page.getByLabel("ลิงก์คำเชิญ — แสดงครั้งนี้เท่านั้น"),
  ).toHaveValue(new RegExp(`/invite#token=${token}`));
  expect(state.invitedEmail).toBe("new-customer@example.com");
  expect(state.created).toBe(true);
  await layout(page, info, "founder-workspace");
  await page.getByRole("button", { name: "ยกเลิกคำเชิญนี้" }).click();
  await expect(
    page.getByText("ยกเลิกคำเชิญแล้ว", { exact: true }),
  ).toBeVisible();
  expect(state.inviteRevoked).toBe(true);
  await page.getByRole("button", { name: "ถอนสิทธิ์", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "customer-a@example.com",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.member.active).toBe(true);
  await page.getByRole("button", { name: "ถอนสิทธิ์", exact: true }).click();
  await page
    .getByRole("button", { name: "ยืนยันถอนสิทธิ์", exact: true })
    .click();
  await expect(page.locator(".wks-members")).toContainText("ถอนสิทธิ์แล้ว");
  expect(state.member.active).toBe(false);
});
test("invitation removes URL secret, verifies email before acceptance", async ({
  page,
}, info) => {
  const state = await setup(page, false, false);
  await page.goto(`/invite#token=${token}`);
  await expect(page).toHaveURL(/\/invite$/);
  await expect(
    page.getByRole("button", { name: "รับคำเชิญเข้าโปรเจกต์", exact: true }),
  ).toBeDisabled();
  expect(state.requestedCode).toBe(false);
  await page
    .getByRole("button", { name: "ส่งรหัสยืนยันอีเมล", exact: true })
    .click();
  await expect(
    page.getByText("ส่งรหัสยืนยันแล้ว ตรวจกล่องอีเมลของคุณ", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill("123456");
  await page.getByRole("button", { name: "ยืนยันอีเมล", exact: true }).click();
  await page
    .getByRole("button", { name: "รับคำเชิญเข้าโปรเจกต์", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "เข้าร่วมโปรเจกต์แล้ว" }),
  ).toBeVisible();
  expect(state.acceptedInvite).toBe(true);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("azelvori:pending-invite"),
    ),
  ).toBeNull();
  await layout(page, info, "invitation-accepted");
  await page.getByRole("link", { name: "เปิดโปรเจกต์", exact: true }).click();
  await expect(
    page.getByLabel("ข้อความถึงสตูดิโอ", { exact: true }),
  ).toBeVisible();
});
test("poll detects revoked access and clears private content", async ({
  page,
}) => {
  const state = await setup(page);
  await page.clock.install();
  await page.goto("/app");
  await expect(
    page.getByLabel("ข้อความถึงสตูดิโอ", { exact: true }),
  ).toBeVisible();
  state.revoked = true;
  await page.clock.fastForward(16000);
  await expect(
    page.getByRole("link", { name: "ไปหน้าเข้าสู่ระบบ", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wks-content")).toHaveCount(0);
  await expect(
    page.getByText(state.project.title, { exact: true }),
  ).toHaveCount(0);
});

test("admin saves follow-up, retries without losing draft and reopens an existing project", async ({
  page,
}, info) => {
  const state = await setup(page, true);
  state.created = true;
  await page.goto("/admin");
  await page.getByRole("button", { name: new RegExp(validLead.title) }).click();
  await page
    .getByRole("combobox", { name: "ความสำคัญ", exact: true })
    .selectOption("HIGH");
  await page.getByLabel("วันนัดติดตาม", { exact: true }).fill("2026-01-01");
  const note = page.getByRole("textbox", { name: "โน้ตภายใน", exact: true });
  await note.fill("<script>private note</script> โทรติดตามรายละเอียดงาน");
  state.crmUnavailable = true;
  await page
    .getByRole("button", { name: "บันทึกการติดตาม", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("ร่างยังไม่ถูกบันทึก");
  await expect(note).toHaveValue(
    "<script>private note</script> โทรติดตามรายละเอียดงาน",
  );
  await page
    .getByRole("button", { name: "บันทึกการติดตาม", exact: true })
    .click();
  await expect(
    page.getByText("บันทึกติดตามงานแล้ว", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "ถึงนัดติดตาม", exact: false })
    .click();
  await page.getByRole("button", { name: new RegExp(validLead.title) }).click();
  await expect(note).toHaveValue(
    "<script>private note</script> โทรติดตามรายละเอียดงาน",
  );
  await page
    .getByRole("searchbox", { name: "ค้นหาบรีฟที่โหลดแล้ว" })
    .fill("ไม่ตรงกับบรีฟ");
  await expect(
    page.getByRole("heading", { name: "ไม่พบในคิวที่เลือก" }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "ค้นหาบรีฟที่โหลดแล้ว" }).fill("");
  await layout(page, info, "admin-follow-up");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(
    page.getByRole("button", { name: "สร้างโปรเจกต์ส่วนตัว", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "เปิดโปรเจกต์ของบรีฟนี้", exact: false })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/projects\\?project=${projectId}`),
  );
  await expect(page.locator(".wks-content")).toBeVisible();
});
test("admin conflicts preserve draft, require explicit reload and clear private data after revocation", async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.goto("/admin");
  await page.getByRole("button", { name: new RegExp(validLead.title) }).click();
  const note = page.getByRole("textbox", { name: "โน้ตภายใน", exact: true });
  await note.fill("ร่างที่ยังไม่บันทึก");
  state.lead = {
    ...state.lead,
    version: 2,
    followUp: {
      note: "ข้อมูลใหม่จากผู้ดูแลอีกหน้าหนึ่ง",
      priority: "NORMAL",
      followUpDate: "",
      updatedAt: date,
    },
  };
  await page
    .getByRole("button", { name: "บันทึกการติดตาม", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("บรีฟถูกเปลี่ยนแล้ว");
  await expect(note).toHaveValue("ร่างที่ยังไม่บันทึก");
  await expect(
    page.getByRole("button", { name: "บันทึกการติดตาม", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "โหลดบรีฟล่าสุด", exact: true })
    .click();
  await expect(note).toHaveValue("ข้อมูลใหม่จากผู้ดูแลอีกหน้าหนึ่ง");
  state.crmForbidden = true;
  await page
    .getByRole("button", { name: "โหลดข้อมูลล่าสุด", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "เข้าสู่ระบบผู้ดูแล", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".crm-layout")).toHaveCount(0);
  await expect(
    page.getByText(validLead.contactEmail, { exact: true }),
  ).toHaveCount(0);
});
test("customer accounts cannot open either admin workspace", async ({
  page,
}) => {
  const state = await setup(page);
  for (const path of ["/admin", "/admin/projects"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล" }),
    ).toBeVisible();
    await expect(page.locator(".crm-layout, .wks-content")).toHaveCount(0);
  }
  expect(state.adminRequests).toEqual([]);
});
