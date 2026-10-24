/** First activation from the owner's AWS CloudShell. Never bundled into the app. */
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { awsCli, AwsFailure, setupAdmin, type AwsCall } from "./admin-setup";
import type { LambdaConcurrencyMode } from "../infrastructure/cdk/app";

export const target = {
  appId: "d3uhwi8blbgrci",
  branchName: "main",
  repository: "https://github.com/tanawutmalirum29-ux/AZELVORI-STUDIO",
  origin: "https://main.d3uhwi8blbgrci.amplifyapp.com",
  stack: "Azelvori-staging",
} as const;
const OptionsSchema = z
  .object({
    region: z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d$/),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase())
      .optional(),
    profile: z
      .string()
      .regex(/^[\w.@-]+$/)
      .optional(),
    check: z.boolean().default(false),
  })
  .strict();
export type ActivationOptions = z.infer<typeof OptionsSchema>;
export function parseActivationOptions(args: string[], region?: string) {
  const values: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || key in values)
      throw new Error(
        "ตัวเลือกซ้ำหรือไม่ถูกต้อง ดู npm run activate -- --help",
      );
    if (key === "check") values[key] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw new Error(`ขาดค่าสำหรับ --${key}`);
      values[key] = args[++i];
    }
  }
  values.region ??= region;
  const result = OptionsSchema.safeParse(values);
  if (!result.success)
    throw new Error(
      "ตรวจ --region, --email และ --profile; ใช้ --check เพื่อตรวจอย่างเดียว",
    );
  return result.data;
}
const EnvSchema = z.record(z.string(), z.string());
const StackSchema = z.object({
  StackId: z.string(),
  StackStatus: z.string(),
  Outputs: z
    .array(z.object({ OutputKey: z.string(), OutputValue: z.string() }))
    .default([]),
  Tags: z.array(z.object({ Key: z.string(), Value: z.string() })).default([]),
});
type CloudStack = z.infer<typeof StackSchema>;
function stackConcurrencyMode(stack: CloudStack): LambdaConcurrencyMode {
  // Older activation templates always reserved 5 and did not publish this output.
  const mode =
    stack.Outputs.find((o) => o.OutputKey === "LambdaConcurrencyMode")
      ?.OutputValue ?? "reserved";
  if (mode !== "reserved" && mode !== "shared")
    throw new Error(
      "LambdaConcurrencyMode ของ stack ไม่ถูกต้อง; ตรวจ backend ก่อนรันใหม่",
    );
  return mode;
}
const settled = new Set([
  "CREATE_COMPLETE",
  "UPDATE_COMPLETE",
  "UPDATE_ROLLBACK_COMPLETE",
]);
const publicKeys = [
  "VITE_API_BASE_URL",
  "VITE_COGNITO_AUTHORITY",
  "VITE_COGNITO_CLIENT_ID",
  "VITE_COGNITO_DOMAIN",
  "VITE_SITE_URL",
  "VITE_PUBLIC_INTAKE_ENABLED",
] as const;

async function readStack(
  aws: AwsCall,
  name: string,
): Promise<CloudStack | undefined> {
  try {
    const result = await aws("cloudformation", "describe-stacks", {
      StackName: name,
    });
    const stacks = z.array(StackSchema).length(1).safeParse(result.Stacks);
    if (!stacks.success)
      throw new Error(`อ่านสถานะ ${name} ไม่ได้; ยังไม่สร้างทับ`);
    return stacks.data[0];
  } catch (e) {
    if (e instanceof AwsFailure && e.code === "StackNotFound") return undefined;
    throw e;
  }
}
function verifyStack(
  stack: CloudStack,
  name: string,
  account: string,
  region: string,
) {
  if (
    !stack.StackId.startsWith(
      `arn:aws:cloudformation:${region}:${account}:stack/${name}/`,
    ) ||
    !settled.has(stack.StackStatus)
  )
    throw new Error(
      `${name} อยู่ผิดเป้าหมายหรือยังไม่พร้อม (${stack.StackStatus}); ตรวจ CloudFormation Events ก่อนรันใหม่`,
    );
}
export function frontendFromStack(
  stack: CloudStack,
  region: string,
  account: string,
) {
  const outputs = Object.fromEntries(
    stack.Outputs.map((o) => [o.OutputKey, o.OutputValue]),
  );
  const tags = Object.fromEntries(stack.Tags.map((t) => [t.Key, t.Value]));
  if (
    tags.Project !== "AZELVORI-STUDIO" ||
    tags.Environment !== "staging" ||
    outputs.AppOrigin !== target.origin
  )
    throw new Error(
      "Stack เดิมไม่ตรงกับเว็บและ environment นี้; ไม่เปลี่ยน backend เดิม",
    );
  if (outputs.IntakeEnabled !== "false")
    throw new Error(
      "Stack เดิมเปิดรับบรีฟแล้วหรือไม่มี IntakeEnabled output; ใช้คู่มืออัปเดต backend เดิม ไม่รันตัวช่วยเปิดครั้งแรกทับ",
    );
  const api = new URL(outputs.ApiBaseUrl || "https://invalid.local");
  if (
    api.origin !== outputs.ApiBaseUrl ||
    api.protocol !== "https:" ||
    !api.hostname.endsWith(`.execute-api.${region}.amazonaws.com`) ||
    !new RegExp(`^${region}_[A-Za-z0-9]+$`).test(outputs.UserPoolId ?? "") ||
    outputs.CognitoAuthority !==
      `https://cognito-idp.${region}.amazonaws.com/${outputs.UserPoolId}` ||
    outputs.CognitoDomain !==
      `https://azelvori-staging-${account}.auth.${region}.amazoncognito.com` ||
    !outputs.CognitoClientId ||
    !outputs.OperationsTable ||
    !outputs.AuditTable
  )
    throw new Error(
      "Stack outputs ไม่ครบหรือไม่ตรงกับ AWS region; ดูคู่มือก่อนเชื่อม Amplify",
    );
  return {
    VITE_API_BASE_URL: outputs.ApiBaseUrl,
    VITE_COGNITO_AUTHORITY: outputs.CognitoAuthority,
    VITE_COGNITO_CLIENT_ID: outputs.CognitoClientId,
    VITE_COGNITO_DOMAIN: outputs.CognitoDomain,
    VITE_SITE_URL: target.origin,
    VITE_PUBLIC_INTAKE_ENABLED: "false",
  };
}
async function inspect(options: ActivationOptions, aws: AwsCall) {
  const caller = await aws("sts", "get-caller-identity", {});
  const account = z
    .string()
    .regex(/^\d{12}$/)
    .parse(caller.Account);
  const app = (await aws("amplify", "get-app", { appId: target.appId })).app as
    Record<string, unknown> | undefined;
  const arn = `arn:aws:amplify:${options.region}:${account}:apps/${target.appId}`;
  if (
    !app ||
    app.appId !== target.appId ||
    app.appArn !== arn ||
    app.defaultDomain !== `${target.appId}.amplifyapp.com` ||
    typeof app.repository !== "string" ||
    app.repository.replace(/\.git$/, "").toLowerCase() !==
      target.repository.toLowerCase()
  )
    throw new Error(
      "Amplify app/repository/account/region ไม่ตรงกับ AZELVORI; ไม่มีการเปลี่ยนค่า",
    );
  const branch = (
    await aws("amplify", "get-branch", {
      appId: target.appId,
      branchName: target.branchName,
    })
  ).branch as Record<string, unknown> | undefined;
  if (
    !branch ||
    branch.branchName !== target.branchName ||
    branch.branchArn !== `${arn}/branches/main`
  )
    throw new Error("ไม่พบ branch main ที่ตรงกับ app นี้");
  if (branch.activeJobId) {
    const jobId = z.string().regex(/^\d+$/).parse(branch.activeJobId);
    const job = (
      await aws("amplify", "get-job", {
        appId: target.appId,
        branchName: target.branchName,
        jobId,
      })
    ).job as { summary?: { status?: string } } | undefined;
    if (
      !["SUCCEED", "FAILED", "CANCELLED"].includes(job?.summary?.status ?? "")
    )
      throw new Error(
        "Amplify main กำลัง build อยู่หรือยังตรวจสถานะไม่ได้ รอให้จบแล้วรันคำสั่งนี้อีกครั้ง",
      );
  }
  const appEnv = EnvSchema.parse(app.environmentVariables ?? {});
  const branchEnv = EnvSchema.parse(branch.environmentVariables ?? {});
  const effective = { ...appEnv, ...branchEnv };
  const stack = await readStack(aws, target.stack);
  let frontend: Record<string, string> = {
    VITE_SITE_URL: target.origin,
    VITE_PUBLIC_INTAKE_ENABLED: "false",
  };
  if (stack) {
    verifyStack(stack, target.stack, account, options.region);
    frontend = frontendFromStack(stack, options.region, account);
  }
  for (const key of publicKeys) {
    if (effective[key] && effective[key] !== frontend[key])
      throw new Error(
        `${key} มีค่าของระบบอื่นหรือเปิดรับบรีฟอยู่; ไม่เขียนทับ โปรดตรวจ Amplify ก่อน`,
      );
  }
  let bootstrap = false;
  let lambdaConcurrency = stack
    ? stackConcurrencyMode(stack)
    : ("reserved" as LambdaConcurrencyMode);
  let unreservedConcurrency: number | undefined;
  if (!stack) {
    const toolkit = await readStack(aws, "CDKToolkit");
    if (toolkit) verifyStack(toolkit, "CDKToolkit", account, options.region);
    bootstrap = !toolkit;
    const limits = (await aws("lambda", "get-account-settings", {}))
      .AccountLimit as { UnreservedConcurrentExecutions?: number } | undefined;
    const quota = z
      .number()
      .int()
      .positive()
      .safeParse(limits?.UnreservedConcurrentExecutions);
    if (!quota.success)
      throw new Error(
        "อ่าน Lambda concurrency ที่ใช้งานได้ไม่สำเร็จหรือ quota เป็น 0; ตรวจ Lambda GetAccountSettings ใน region นี้ก่อน ยังไม่สร้างทรัพยากร",
      );
    unreservedConcurrency = quota.data;
    lambdaConcurrency = quota.data >= 105 ? "reserved" : "shared";
  }
  return {
    account,
    stack,
    bootstrap,
    appEnv,
    branchEnv,
    lambdaConcurrency,
    unreservedConcurrency,
  };
}
type Inspection = Awaited<ReturnType<typeof inspect>>;
export type ActivationPlan = {
  account: string;
  region: string;
  email?: string;
  backend: "CREATE" | "REUSE";
  bootstrap: boolean;
  lambdaConcurrency: LambdaConcurrencyMode;
  unreservedConcurrency?: number;
};
type Dependencies = {
  aws: AwsCall;
  confirm: (plan: ActivationPlan) => Promise<boolean>;
  deploy: (plan: ActivationPlan) => Promise<void>;
  health: (url: string) => Promise<unknown>;
  wait: () => Promise<void>;
  report: (message: string) => void;
  pollAttempts?: number;
};
function sameConfiguration(a: Inspection, b: Inspection) {
  // Do not print the snapshots: unrelated environment values can be secrets.
  const signature = (value: Record<string, string>) =>
    JSON.stringify(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
    );
  return (
    a.account === b.account &&
    a.lambdaConcurrency === b.lambdaConcurrency &&
    signature(a.appEnv) === signature(b.appEnv) &&
    signature(a.branchEnv) === signature(b.branchEnv)
  );
}
export async function activate(options: ActivationOptions, deps: Dependencies) {
  if (!options.check && !options.email)
    throw new Error("ต้องระบุอีเมลเจ้าของสตูดิโอ");
  const before = await inspect(options, deps.aws);
  const plan: ActivationPlan = {
    account: before.account,
    region: options.region,
    email: options.email,
    backend: before.stack ? "REUSE" : "CREATE",
    bootstrap: before.bootstrap,
    lambdaConcurrency: before.lambdaConcurrency,
    unreservedConcurrency: before.unreservedConcurrency,
  };
  deps.report(
    JSON.stringify(
      {
        ...plan,
        appId: target.appId,
        branch: target.branchName,
        origin: target.origin,
        stack: target.stack,
        intake: "CLOSED",
      },
      null,
      2,
    ),
  );
  if (options.check) return { mode: "CHECK_ONLY" };
  if (!(await deps.confirm(plan))) return { mode: "CANCELLED" };
  const fresh = await inspect(options, deps.aws);
  if (
    !sameConfiguration(before, fresh) ||
    before.stack?.StackId !== fresh.stack?.StackId ||
    before.bootstrap !== fresh.bootstrap
  )
    throw new Error(
      "เป้าหมายหรือค่าบน AWS เปลี่ยนระหว่างยืนยัน; รันใหม่เพื่อตรวจแผนล่าสุด",
    );
  if (!fresh.stack) {
    deps.report("กำลังสร้าง backend staging สำหรับเว็บนี้…");
    await deps.deploy(plan);
  } else deps.report("ใช้ backend เดิมที่ตรวจแล้ว โดยไม่ deploy ทับ stack");
  const stack = await readStack(deps.aws, target.stack);
  if (!stack)
    throw new Error("ยังไม่พบ backend หลัง deploy; หยุดก่อนสร้างบัญชี");
  verifyStack(stack, target.stack, plan.account, options.region);
  if (stackConcurrencyMode(stack) !== plan.lambdaConcurrency)
    throw new Error(
      "โหมด Lambda หลัง deploy ไม่ตรงกับแผนที่ยืนยัน; หยุดก่อนสร้างบัญชี",
    );
  const frontend = frontendFromStack(stack, options.region, plan.account);
  const health = z
    .object({
      status: z.literal("ok"),
      service: z.literal("azelvori-api"),
      schemaVersion: z.literal(2),
      capabilities: z.array(z.string()),
      intakeEnabled: z.literal(false),
    })
    .safeParse(await deps.health(`${frontend.VITE_API_BASE_URL}/health`));
  if (
    !health.success ||
    !health.data.capabilities.includes("crm-follow-up") ||
    !health.data.capabilities.includes("private-workspace")
  )
    throw new Error(
      "API ยังไม่ตอบกลับตามรุ่นที่ต้องใช้ หรือเปิดรับบรีฟอยู่; ยังไม่เชื่อมหน้าเว็บ",
    );
  deps.report(
    "API ตอบกลับแล้ว กำลังตรวจ/สร้างบัญชีเจ้าของและสิทธิ์ในฐานข้อมูล…",
  );
  await setupAdmin(
    {
      ...options,
      email: options.email!,
      account: plan.account,
      stack: target.stack,
      apply: true,
    },
    deps.aws,
  );
  const current = await inspect(options, deps.aws);
  if (
    !sameConfiguration(before, current) ||
    current.stack?.StackId !== stack.StackId
  )
    throw new Error(
      "ค่าบน Amplify หรือ backend เปลี่ยนระหว่างตั้งค่า; หยุดก่อนบันทึก env รันใหม่หลังตรวจค่า",
    );
  const environmentVariables = { ...current.branchEnv, ...frontend };
  if (publicKeys.some((key) => current.branchEnv[key] !== frontend[key])) {
    deps.report("กำลังบันทึกค่าการเชื่อมต่อ 6 ค่าให้ Amplify branch main…");
    await deps.aws("amplify", "update-branch", {
      appId: target.appId,
      branchName: target.branchName,
      environmentVariables,
    });
    const verified = await inspect(options, deps.aws);
    if (
      !sameConfiguration(
        { ...current, branchEnv: environmentVariables },
        verified,
      ) ||
      verified.stack?.StackId !== stack.StackId
    )
      throw new Error(
        "ตรวจค่าหลังบันทึก Amplify ไม่ตรง; ยังไม่เริ่ม build โปรดตรวจค่าก่อนรันใหม่",
      );
  }
  const started = await deps.aws("amplify", "start-job", {
    appId: target.appId,
    branchName: target.branchName,
    jobType: "RELEASE",
    jobReason: "AZELVORI first admin activation",
  });
  const jobId = z
    .string()
    .regex(/^\d+$/)
    .parse((started.jobSummary as { jobId?: string } | undefined)?.jobId);
  deps.report(`Amplify job ${jobId} เริ่มแล้ว กำลังรอผล build…`);
  for (let attempt = 0; attempt < (deps.pollAttempts ?? 120); attempt++) {
    const result = await deps.aws("amplify", "get-job", {
      appId: target.appId,
      branchName: target.branchName,
      jobId,
    });
    const status = (result.job as { summary?: { status?: string } } | undefined)
      ?.summary?.status;
    if (status === "SUCCEED") {
      deps.report(
        `เผยแพร่สำเร็จ: ${target.origin}/admin/login\nตรวจอีเมลคำเชิญ ตั้งรหัสผ่านและ Authenticator ในหน้า Cognito แล้วลองเข้าหน้าแอดมิน\nยังต้องทดสอบ login และงานจริงด้วยบัญชีของคุณ; การรับบรีฟสาธารณะยังปิดอยู่`,
      );
      return {
        mode: "DEPLOYED",
        jobId,
        adminUrl: `${target.origin}/admin/login`,
      };
    }
    if (
      !["CREATED", "PENDING", "PROVISIONING", "RUNNING"].includes(status ?? "")
    )
      throw new Error(
        `Amplify job ${jobId} ไม่สำเร็จ (${status ?? "UNKNOWN"}); ตรวจ build log ใน Console แล้วรันใหม่ ไม่ลบ backend หรือบัญชีที่สร้างแล้ว`,
      );
    if (attempt + 1 < (deps.pollAttempts ?? 120)) await deps.wait();
  }
  throw new Error(
    `หมดเวลารอ Amplify job ${jobId}; job อาจยังทำงาน ดูสถานะใน Console ก่อนรันใหม่ ยังไม่ยืนยันว่าเว็บเผยแพร่สำเร็จ`,
  );
}

const root = fileURLToPath(new URL("../", import.meta.url));
async function ask(question: string) {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await input.question(question)).trim();
  } finally {
    input.close();
  }
}
export function cdkArguments(plan: ActivationPlan, profile?: string) {
  const shared = [...(profile ? ["--profile", profile] : []), "--no-notices"];
  return {
    bootstrap: ["bootstrap", `aws://${plan.account}/${plan.region}`, ...shared],
    deploy: [
      "deploy",
      target.stack,
      "--app",
      "node --import tsx infrastructure/cdk/app.ts",
      "-c",
      "stage=staging",
      "-c",
      `appOrigin=${target.origin}`,
      "-c",
      "intakeEnabled=false",
      "-c",
      "legalReady=false",
      "-c",
      `lambdaConcurrency=${plan.lambdaConcurrency}`,
      "--require-approval",
      "broadening",
      ...shared,
    ],
  };
}
async function main() {
  if (process.argv.includes("--help")) {
    console.log(
      "npm run activate [-- --region REGION --email OWNER_EMAIL --profile PROFILE]\nnpm run activate -- --check [--region REGION]\nใช้ CloudShell ใน region ของ Amplify app d3uhwi8blbgrci; --check อ่านอย่างเดียว\nเปิด backend staging, บัญชีเจ้าของ, ค่า Amplify main และรอ build; ไม่เปิดรับบรีฟสาธารณะ\nอ่าน docs/19_CLOUDSHELL_QUICKSTART.md ก่อนเริ่ม",
    );
    return;
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 14))
    throw new Error(
      "ต้องใช้ Node.js >=22.14 ตรวจ node --version และคู่มือก่อนเริ่ม",
    );
  const args = process.argv.slice(2);
  let region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region && !args.includes("--region") && process.stdin.isTTY)
    region = await ask(
      "AWS Region ที่เปิด Amplify app นี้ (เช่น ap-southeast-1): ",
    );
  const options = parseActivationOptions(args, region);
  if (!options.check && !process.stdin.isTTY)
    throw new Error(
      "เปิด terminal แบบโต้ตอบเพื่ออ่านแผนและยืนยัน; ใช้ --check สำหรับการตรวจอย่างเดียว",
    );
  if (!options.check && !options.email) {
    const email = z
      .email()
      .max(254)
      .safeParse(await ask("อีเมลเจ้าของสตูดิโอที่จะให้สิทธิ์แอดมินเต็ม: "));
    if (!email.success) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
    options.email = email.data.toLowerCase();
  }
  await activate(options, {
    aws: awsCli(options),
    report: console.log,
    confirm: async (plan) => {
      console.log(
        plan.lambdaConcurrency === "shared"
          ? "Lambda: ใช้โควตาส่วนกลางที่มีอยู่สำหรับ staging ไม่จองเพิ่ม; API ตั้งเป้า 2 คำขอ/วินาทีต่อเส้นทาง burst 5 (best effort ไม่ใช่เพดานค่าใช้จ่าย)\nยังปิดรับบรีฟสาธารณะ ต้องเปลี่ยนเป็น reserved ก่อนเปิดรับงาน"
          : "Lambda: จองได้พร้อมกัน 5 งาน; API ตั้งเป้า 10 คำขอ/วินาทีต่อเส้นทาง burst 20",
      );
      console.log(
        `แผนนี้${plan.backend === "CREATE" ? "สร้าง API, Cognito, DynamoDB 2 ตาราง, logs และ IAM role" : "ใช้ backend เดิม"} และเชื่อมเว็บ main\n${plan.bootstrap ? "จะสร้าง CDKToolkit รวม bucket และ roles สำหรับ deploy ในบัญชีนี้ด้วย\n" : ""}ทรัพยากร AWS มีค่าใช้จ่ายตามการใช้งาน ไม่มีการกำหนดเพดานค่าใช้จ่ายในขั้นนี้\nตรวจ Account, Region และอีเมลด้านบน ห้ามแก้ Amplify พร้อมกันระหว่างรัน`,
      );
      return (
        (await ask("พิมพ์ DEPLOY เพื่อดำเนินการ หรือ Enter เพื่อยกเลิก: ")) ===
        "DEPLOY"
      );
    },
    deploy: async (plan) => {
      const env = {
        ...process.env,
        AWS_REGION: plan.region,
        AWS_DEFAULT_REGION: plan.region,
        CDK_DEFAULT_ACCOUNT: plan.account,
        CDK_DEFAULT_REGION: plan.region,
      };
      const run = (args: string[]) => {
        try {
          execFileSync(process.execPath, args, {
            cwd: root,
            env,
            stdio: "inherit",
          });
        } catch {
          throw new Error(
            "ขั้นตอน build/CDK ไม่สำเร็จ ตรวจข้อความด้านบนและ CloudFormation Events แล้วรันใหม่ ไม่มีการลบ stack อัตโนมัติ",
          );
        }
      };
      run(["scripts/build-api.mjs"]);
      const commands = cdkArguments(plan, options.profile);
      if (plan.bootstrap)
        run(["node_modules/aws-cdk/bin/cdk", ...commands.bootstrap]);
      run(["node_modules/aws-cdk/bin/cdk", ...commands.deploy]);
    },
    health: async (url) => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("status");
        return await response.json();
      } catch {
        throw new Error(
          "เรียก /health ไม่สำเร็จ ตรวจ backend ใน CloudFormation/CloudWatch แล้วรันใหม่",
        );
      }
    },
    wait: () => new Promise((done) => setTimeout(done, 10000)),
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (e) {
    console.error(
      e instanceof z.ZodError
        ? "รูปแบบข้อมูลจาก AWS ไม่ตรงตามที่คาด; หยุดโดยไม่ทำขั้นตอนถัดไป"
        : e instanceof Error
          ? e.message
          : "Activation failed",
    );
    console.error(
      "ดูวิธีแก้ใน docs/19_CLOUDSHELL_QUICKSTART.md; ไม่ต้องส่งรหัสผ่าน, Access Key หรือ OTP",
    );
    process.exitCode = 1;
  }
}
