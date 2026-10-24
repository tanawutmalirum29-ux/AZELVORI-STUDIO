import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

const authority =
  "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_QATEST";
const domain = "https://qa.auth.ap-southeast-1.amazoncognito.com";
const userKey = `oidc.user:${authority}:qa-client`;

// Exercise the real OIDC client, PKCE, storage and React callback. Only the
// provider/API HTTP boundaries are fixtures; no real credentials or AWS writes.
async function provider(page: Page) {
  let authorize: URL | undefined;
  let tokenExchanges = 0;
  let release!: () => void;
  const tokenGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${domain}/oauth2/authorize?**`, async (route) => {
    authorize = new URL(route.request().url());
    expect(authorize.searchParams.get("response_type")).toBe("code");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    await route.fulfill({
      contentType: "text/html",
      body: "<h1>Test identity provider</h1>",
    });
  });
  await page.route(`${domain}/oauth2/token`, async (route) => {
    tokenExchanges++;
    const form = new URLSearchParams(route.request().postData() ?? "");
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("client_id")).toBe("qa-client");
    expect(form.get("redirect_uri")).toBe(
      authorize?.searchParams.get("redirect_uri"),
    );
    expect(form.get("code")).toBe("fixture-one-use-code");
    expect(
      createHash("sha256")
        .update(form.get("code_verifier") ?? "")
        .digest("base64url"),
    ).toBe(authorize?.searchParams.get("code_challenge"));
    await tokenGate;
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const claims = {
      iss: authority,
      aud: "qa-client",
      sub: "fixture-founder",
      iat: now,
      exp: now + 300,
      ...(authorize?.searchParams.get("nonce")
        ? { nonce: authorize.searchParams.get("nonce") }
        : {}),
    };
    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        access_token: "fixture-access",
        refresh_token: "fixture-refresh",
        id_token: `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}.fixture-signature`,
        token_type: "Bearer",
        expires_in: 300,
        scope: "openid email aws.cognito.signin.user.admin azelvori/access",
      }),
    });
  });
  await page.route("https://api.example.test/**", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    expect(route.request().headers().authorization).toBe(
      "Bearer fixture-access",
    );
    const path = new URL(route.request().url()).pathname;
    expect(["/api/v1/me", "/api/v1/admin/leads"]).toContain(path);
    await route.fulfill({
      headers,
      contentType: "application/json",
      body: JSON.stringify(
        path === "/api/v1/me"
          ? {
              userId: "fixture-founder",
              email: "founder@example.test",
              emailVerified: true,
              staff: true,
            }
          : { items: [] },
      ),
    });
  });
  return {
    release,
    exchanges: () => tokenExchanges,
    async begin() {
      await page
        .getByRole("button", { name: "เข้าสู่ระบบผู้ดูแล", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Test identity provider" }),
      ).toBeVisible();
      const callback = new URL(authorize!.searchParams.get("redirect_uri")!);
      callback.searchParams.set("code", "fixture-one-use-code");
      callback.searchParams.set("state", authorize!.searchParams.get("state")!);
      return callback.toString();
    },
  };
}

test("callback exchanges once, offers continuation during slow navigation, and opens admin", async ({
  page,
}, info) => {
  const identity = await provider(page);
  await page.goto("/admin/login");
  const callback = await identity.begin();
  let continueNavigation!: () => void;
  const navigationGate = new Promise<void>((resolve) => {
    continueNavigation = resolve;
  });
  await page.route("**/admin", async (route) => {
    await navigationGate;
    await route.continue();
  });
  await page.goto(callback);
  await expect(
    page.getByRole("heading", { name: "กำลังยืนยันบัญชี…" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  identity.release();
  await expect(
    page.getByRole("heading", { name: "ยืนยันบัญชีแล้ว" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "เปิดหน้าแอดมิน", exact: true }),
  ).toHaveAttribute("href", "/admin");
  await page.screenshot({
    path: info.outputPath("callback-confirmed.png"),
    fullPage: true,
  });
  continueNavigation();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "บรีฟและคิวงาน" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "บรีฟและคิวงาน" }),
  ).toBeVisible();
  expect(identity.exchanges()).toBe(1);
});

test("a missing callback state gives a safe admin retry and a fresh sign-in succeeds", async ({
  page,
}) => {
  const identity = await provider(page);
  await page.goto("/auth/callback/?code=expired-fixture&state=missing-fixture");
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบไม่สำเร็จ" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(identity.exchanges()).toBe(0);
  await page.getByRole("link", { name: "เข้าสู่ระบบผู้ดูแลอีกครั้ง" }).click();
  const callback = await identity.begin();
  identity.release();
  await page.goto(callback);
  await expect(
    page.getByRole("heading", { name: "บรีฟและคิวงาน" }),
  ).toBeVisible();
  expect(identity.exchanges()).toBe(1);
});

test("a stalled token body reaches a deadline and late success cannot restore a session", async ({
  page,
}, info) => {
  const identity = await provider(page);
  await page.clock.install();
  await page.addInitScript(
    ({ domain }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (String(args[0]) !== `${domain}/oauth2/token`) return response;
        const body = await response.text();
        document.documentElement.dataset.fixtureBodyPending = "true";
        // Headers have arrived, so the library's 15-second timer has stopped.
        // Delay only the response body past the whole-callback deadline.
        return new Response(
          new ReadableStream({
            start(controller) {
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode(body));
                controller.close();
              }, 25_000);
            },
          }),
          { status: response.status, headers: response.headers },
        );
      };
    },
    { domain },
  );
  await page.goto("/admin/login");
  const callback = await identity.begin();
  identity.release();
  await page.goto(callback);
  await expect(page.locator("html")).toHaveAttribute(
    "data-fixture-body-pending",
    "true",
  );
  await page.clock.fastForward(20_001);
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบไม่สำเร็จ" }),
  ).toBeVisible();
  await expect(
    page.getByText("ระบบบัญชีตอบกลับช้า", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "เข้าสู่ระบบผู้ดูแลอีกครั้ง" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("callback-timeout.png"),
    fullPage: true,
  });
  await page.clock.fastForward(6_000);
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบไม่สำเร็จ" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/auth/callback");
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), userKey),
  ).toBeNull();
  expect(identity.exchanges()).toBe(1);
});
