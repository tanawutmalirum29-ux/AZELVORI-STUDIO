import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function cognito(page: Page) {
  const calls: { target: string; payload: Record<string, any> }[] = [];
  await page.route("https://cognito-idp.ap-southeast-1.amazonaws.com/**", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const target = route.request().headers()["x-amz-target"] ?? "";
    const payload = route.request().postDataJSON() as Record<string, any>;
    calls.push({ target, payload });
    const response = target.endsWith("InitiateAuth") ? {
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      ChallengeParameters: { USERNAME: "fixture-founder" },
      Session: "this-is-a-synthetic-session-never-real",
    } : target.endsWith("RespondToAuthChallenge") ? {
      AuthenticationResult: {
        AccessToken: "native-access-test",
        IdToken: "native-id-test",
        RefreshToken: "native-refresh-test",
        ExpiresIn: 300,
      },
    } : {};
    return route.fulfill({ headers, contentType: "application/x-amz-json-1.1",
      body: JSON.stringify(response) });
  });
  await page.route("https://api.example.test/**", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    expect(route.request().headers().authorization).toBe("Bearer native-access-test");
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ headers, contentType: "application/json",
      body: JSON.stringify(path === "/api/v1/me"
        ? { userId: "fixture-founder", email: "owner@example.test", emailVerified: true, staff: true }
        : { items: [] }) });
  });
  return calls;
}
test("first-party founder signs in with Cognito TOTP and keeps password out of storage", async ({
  page,
}, info) => {
  const requests = await cognito(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "ยินดีต้อนรับกลับ" })).toBeVisible();
  await expect(page.getByRole("img", { name: "AZELVORI STUDIO" })).toBeVisible();
  await page.getByLabel("อีเมล", { exact: true }).fill("Owner@Example.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("temporary-passphrase");
  await page.getByRole("button", { name: "เข้าสู่ระบบผู้ดูแล" }).click();
  await expect(page.getByRole("heading", { name: "ยืนยันตัวตนอีกขั้น" })).toBeVisible();
  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill("123456");
  await page.getByRole("button", { name: "ยืนยันและดำเนินการต่อ" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "บรีฟและคิวงาน" })).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
  expect(storage).not.toContain("temporary-passphrase");
  expect(storage).not.toContain("123456");
  expect(requests.map((item) => item.target)).toEqual([
    "AWSCognitoIdentityProviderService.InitiateAuth",
    "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
  ]);
  expect(requests[0].payload.AuthParameters.PASSWORD).toBe("temporary-passphrase");
  expect(requests[1].payload.ChallengeResponses.SOFTWARE_TOKEN_MFA_CODE).toBe("123456");
  await page.screenshot({ path: info.outputPath("direct-login-success.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("custom login remains usable without AWS identifiers and never sends credentials", async ({
  page,
}) => {
  const credentialRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("cognito-idp.")) credentialRequests.push(req.url());
  });
  await page.goto("/admin/login");
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบผู้ดูแล" })).toBeVisible();
  // The private-workspace test server provides AWS config; empty fields must not submit.
  await page.getByRole("button", { name: "เข้าสู่ระบบผู้ดูแล" }).click();
  expect(credentialRequests).toEqual([]);
  expect((await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});
