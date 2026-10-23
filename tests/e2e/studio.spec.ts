import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}
test("public pages, links, layout and honest account availability", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await noOverflow(page);
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: "เปิดเมนู" }).click();
    await expect(
      page.getByRole("link", { name: "เริ่มโปรเจกต์", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ปิดเมนู" }).click();
  }
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .locator("summary")
    .filter({ hasText: "ยังไม่มีรายละเอียดครบ เริ่มคุยได้ไหม?" })
    .click();
  await expect(
    page.getByText("ได้ เลือกประเภทงานและเล่าว่าอยากแก้ปัญหาอะไรในแบบฟอร์ม", {
      exact: false,
    }),
  ).toBeVisible();
  for (const path of [
    "/login",
    "/privacy",
    "/terms",
    "/cookies",
    "/app",
    "/admin",
    "/not-found",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "เข้าสู่พื้นที่ลูกค้า" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("website wizard validates, exports locally and never pretends to submit", async ({
  page,
}, testInfo) => {
  let submitted = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/leads")) submitted = true;
  });
  await page.goto("/start?service=WEBSITE");
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await expect(page.locator("#title")).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("ชื่อหรือหัวข้อโปรเจกต์")
    .fill("เว็บสำหรับทดสอบตัวอย่าง");
  await page
    .getByLabel("เป้าหมายและรายละเอียด")
    .fill(
      "ต้องการเว็บไซต์แนะนำสินค้าและบริการ รองรับมือถือ พร้อมหน้าติดต่อทีมงานโดยใช้ข้อมูลสมมติเท่านั้น",
    );
  await page
    .getByLabel("แพลตฟอร์มและอุปกรณ์เป้าหมาย")
    .fill("Web / iOS / Android");
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await noOverflow(page);
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByLabel("ฉันมีสิทธิ์ใช้งานเนื้อหา", { exact: false }).check();
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByLabel("ชื่อที่ให้เรียก").fill("ทดสอบเท่านั้น");
  await page.getByLabel("อีเมลติดต่อ").fill("synthetic@example.com");
  await page.getByLabel("ฉันอ่านและรับทราบ", { exact: false }).check();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("brief.png"),
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ดาวน์โหลดร่างบรีฟ" }).click();
  expect((await download).suggestedFilename()).toBe(
    "azelvori-brief-draft.json",
  );
  await expect(
    page.getByText("ดาวน์โหลดร่างแล้ว", { exact: false }),
  ).toBeVisible();
  expect(submitted).toBe(false);
  const stored = await page.evaluate(() =>
    localStorage.getItem("azelvori:brief-preferences:v1"),
  );
  expect(stored).not.toContain("synthetic@example.com");
  expect(stored).not.toContain("ต้องการเว็บไซต์");
});
test("bugfix flow requires reproduction details", async ({ page }) => {
  await page.goto("/start?service=GAME_BUGFIX");
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await expect(page.getByLabel("ขั้นตอนทำซ้ำและสภาพแวดล้อม")).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await expect(page.locator("#reproduction")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#engine")).toHaveAttribute("aria-invalid", "true");
});
test("all service types expose the appropriate brief fields", async ({
  page,
}) => {
  for (const service of ["WEB_APP", "GAME_NEW", "MAINTENANCE"]) {
    await page.goto(`/start?service=${service}`);
    await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
    await expect(page.getByLabel("เป้าหมายและรายละเอียด")).toBeVisible();
    await expect(page.locator("#engine")).toHaveCount(
      service === "GAME_NEW" ? 1 : 0,
    );
    await expect(page.locator("#reproduction")).toHaveCount(0);
    await noOverflow(page);
  }
});
test("demo chat escapes markup, review pins version and dialog supports Escape", async ({
  page,
}, testInfo) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "ภาพรวม", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("portal.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "ข้อความ", exact: false }).click();
  await page
    .getByLabel("ข้อความตัวอย่าง", { exact: true })
    .fill("<script>alert(1)</script> ข้อความทดสอบ");
  await page
    .getByRole("button", { name: "เพิ่มข้อความตัวอย่าง", exact: true })
    .click();
  await expect(
    page.getByText("<script>alert(1)</script> ข้อความทดสอบ", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "ตรวจงาน", exact: true }).click();
  await page.getByRole("button", { name: "มือถือ", exact: true }).click();
  await page.getByRole("button", { name: "ทดลองขอแก้ไข" }).click();
  await page.getByLabel("ต้องการให้ปรับอะไร?").fill("ขอหัวข้อที่อ่านชัดขึ้น");
  await page.getByRole("button", { name: "เพิ่มความคิดเห็นตัวอย่าง" }).click();
  await expect(
    page.getByText("คำขอแก้ไขตัวอย่างสำหรับ v0.1:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ทดลองอนุมัติเวอร์ชัน" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "ทดลองอนุมัติเวอร์ชัน" }).click();
  await page.getByRole("button", { name: "ยืนยันการทดลอง" }).click();
  await expect(
    page.getByRole("button", { name: "ทดลองอนุมัติแล้ว" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "ไฟล์งาน", exact: true }).click();
  await noOverflow(page);
  await page.getByRole("button", { name: "ข้อตกลง", exact: true }).click();
  await expect(
    page.getByText("ยังไม่มีใบเสนอราคาจริง", { exact: false }),
  ).toBeVisible();
  await noOverflow(page);
});
