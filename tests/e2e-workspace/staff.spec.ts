import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("employee signs in with issued key, chats, acknowledges work and signs out", async ({ page }) => {
  const access = "synthetic-employee-access";
  const project = { projectId: "11111111-1111-4111-8111-111111111111",
    leadId: "LEAD-2026-0123456789ABCDEF", title: "Client website", updatedAt: "2026-10-25T10:00:00.000Z" };
  const messages = [{ messageId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", projectId:project.projectId,
    senderId:"customer-a", senderRole:"CUSTOMER", text:"ลูกค้าขออัปเดตงาน",
    createdAt:"2026-10-25T10:00:00.000Z",status:"PERSISTED" }];
  let lead = { leadId:project.leadId, title:"งานเว็บไซต์", contactName:"ลูกค้า",
    status:"NEW", description:"สร้างเว็บบริษัท" };
  const requests: string[] = [];
  await page.route("https://cognito-idp.ap-southeast-2.amazonaws.com/**", async route => {
    if (route.request().method()==="OPTIONS")
      return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"POST,OPTIONS"}});
    const body = route.request().postDataJSON() as {AuthParameters?:Record<string,string>};
    if ((route.request().headers()["x-amz-target"] ?? "").endsWith("RevokeToken")) {
      return route.fulfill({headers:{"Access-Control-Allow-Origin":"*"},
        contentType:"application/x-amz-json-1.1",body:"{}"});
    }
    expect(body.AuthParameters?.USERNAME).toBe("emp-00001");
    expect(body.AuthParameters?.PASSWORD).toBe("demo-employee-strong-password");
    requests.push("cognito");
    await route.fulfill({headers:{"Access-Control-Allow-Origin":"*"},
      contentType:"application/x-amz-json-1.1",
      body:JSON.stringify({AuthenticationResult:{AccessToken:access,RefreshToken:"synthetic-refresh",ExpiresIn:300}})});
  });
  await page.route("https://api.example.test/**", async route => {
    if (route.request().method()==="OPTIONS")
      return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
    const path = new URL(route.request().url()).pathname;
    const headers={"Access-Control-Allow-Origin":"*"};
    if (path==="/api/v1/employee/config") return route.fulfill({
      headers,contentType:"application/json",body:JSON.stringify({
        poolId:"ap-southeast-2_TEST",clientId:"staff-client",region:"ap-southeast-2"})});
    expect(route.request().headers().authorization).toBe("Bearer "+access);
    requests.push(path);
    if (path==="/api/v1/employee/me") return route.fulfill({headers,
      contentType:"application/json",body:JSON.stringify({
        userId:"staff-sub",key:"00001",firstName:"นางสาว",lastName:"ทดสอบ",
        nickname:"ฟ้า",active:true,role:"EMPLOYEE"})});
    if (path==="/api/v1/employee/projects") return route.fulfill({headers,
      contentType:"application/json",body:JSON.stringify({items:[project]})});
    if (path.endsWith("/messages")) {
      if (route.request().method()==="POST") {
        const input = route.request().postDataJSON() as {text:string};
        const entry={messageId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          projectId:project.projectId,senderId:"staff-sub",senderRole:"STUDIO",
          text:input.text,createdAt:"2026-10-25T10:01:00.000Z",status:"PERSISTED"};
        messages.push(entry);
        return route.fulfill({status:201,headers,contentType:"application/json",body:JSON.stringify(entry)});
      }
      return route.fulfill({headers,contentType:"application/json",
        body:JSON.stringify({items:messages})});
    }
    if (path==="/api/v1/employee/leads") return route.fulfill({headers,
      contentType:"application/json",body:JSON.stringify({items:[lead]})});
    if (path.endsWith("/acknowledge")) {
      lead={...lead,status:"ACKNOWLEDGED"};
      return route.fulfill({headers,contentType:"application/json",
        body:JSON.stringify({lead})});
    }
    throw Error("Unexpected API: "+path);
  });
  await page.goto("/staff/login");
  await expect(page.getByRole("heading",{name:"เข้าสู่ระบบพนักงาน"})).toBeVisible();
  await page.getByLabel("คีย์พนักงาน").fill("00001");
  await page.getByLabel("รหัสผ่าน").fill("demo-employee-strong-password");
  await page.getByRole("button",{name:"เข้าสู่พื้นที่พนักงาน"}).click();
  await expect(page).toHaveURL(/\/staff\/inbox$/);
  await expect(page.getByText("ลูกค้าขออัปเดตงาน")).toBeVisible();
  await page.getByRole("textbox",{name:"ตอบกลับลูกค้า"}).fill("พนักงานรับเรื่องแล้ว");
  await page.getByRole("button",{name:"ส่งข้อความ"}).click();
  await expect(page.getByText("พนักงานรับเรื่องแล้ว")).toBeVisible();
  await page.getByRole("button",{name:"งานลูกค้า"}).click();
  await expect(page.getByText("งานเว็บไซต์")).toBeVisible();
  await page.getByRole("button",{name:"รับเรื่อง"}).click();
  await expect(page.getByText("ACKNOWLEDGED")).toBeVisible();
  expect(requests).toContain("/api/v1/employee/leads/"+project.leadId+"/acknowledge");
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("button",{name:"ออกจากระบบพนักงาน"}).click();
  await expect(page).toHaveURL(/\/staff\/login$/);
  const saved=await page.evaluate(()=>JSON.stringify({...sessionStorage}));
  expect(saved).not.toContain("synthetic-employee-access");
});
test("employee login is separate from the founder administration",async({page})=>{
  await page.goto("/staff/login");
  await expect(page.getByRole("heading",{name:"เข้าสู่ระบบพนักงาน"})).toBeVisible();
  await expect(page.getByRole("link",{name:"เข้าสู่ระบบผู้ดูแล"})).toHaveCount(0);
  await expect(page.getByRole("textbox",{name:"คีย์พนักงาน"})).toBeVisible();
});
