import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const receiptId = "LEAD-2026-0123456789ABCDEF";
async function stubRealApi(page: Page) {
  const submissions: { body: Record<string, unknown>; key: string }[] = [];
  await page.route("https://api.example.test/**", async (route) => {
    const req = route.request();
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4175",
      "Access-Control-Allow-Headers": "content-type,idempotency-key",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (req.method() !== "POST" || new URL(req.url()).pathname !== "/api/v1/leads")
      throw Error("Unexpected public API request: " + req.url());
    const body = req.postDataJSON() as Record<string, unknown>;
    submissions.push({ body, key: req.headers()["idempotency-key"] });
    return route.fulfill({
      status: 202, headers, contentType: "application/json",
      body: JSON.stringify({
        leadId: receiptId,
        receivedAt: "2026-10-25T07:00:00.000Z",
        status: "RECEIVED",
      }),
    });
  });
  return submissions;
}

test("public privacy disclosures and real intake receipt without sign-in", async ({ page }, info) => {
  const submissions = await stubRealApi(page);
  await page.goto("/privacy");
  await expect(page.getByText("privacy@example.test")).toBeVisible();
  await expect(page.getByText(/Sydney/)).toBeVisible();
  await expect(page.getByText(/ไม่เปิดรับลูกค้า/)).toHaveCount(0);
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "เงื่อนไขการใช้บริการและส่งบรีฟ" })).toBeVisible();
  await page.goto("/start?service=WEBSITE");
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByLabel("ชื่อหรือหัวข้อโปรเจกต์").fill("เว็บไซต์ร้านสำหรับทดสอบจริง");
  await page.getByLabel("เป้าหมายและรายละเอียด").fill(
    "ต้องการหน้าเว็บไซต์สำหรับทดสอบระบบรับงานจริง รองรับมือถือและคอมพิวเตอร์ ใช้ข้อมูลตัวอย่างเท่านั้น");
  await page.getByLabel("แพลตฟอร์มและอุปกรณ์เป้าหมาย").fill("Web / Android / iOS");
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByLabel("ฉันมีสิทธิ์ใช้งานเนื้อหา", { exact: false }).check();
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByLabel("ชื่อที่ให้เรียก").fill("ลูกค้าทดสอบ");
  await page.getByLabel("อีเมลติดต่อ").fill("qa@example.test");
  await expect(page.getByText(/ส่งและบันทึกบน AWS จริง/)).toBeVisible();
  await page.getByLabel("ฉันอ่านและรับทราบ", { exact: false }).check();
  const send = page.getByRole("button", { name: "ส่งบรีฟให้สตูดิโอ" });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByRole("heading", { name: "ได้รับบรีฟของคุณแล้ว" })).toBeVisible();
  await expect(page.getByText(receiptId)).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].body.contactEmail).toBe("qa@example.test");
  expect(submissions[0].body.privacyVersion).toBe("public-beta-2026-10-25");
  expect(submissions[0].key).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    (await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({path: info.outputPath("public-receipt.png"),fullPage:true});
});
