/** Operator-only CLI. Never imported by the browser or Lambda. No default AWS target. */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { z } from "zod";

const OptionsSchema = z
  .object({
    account: z.string().regex(/^\d{12}$/),
    region: z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d$/),
    stack: z.enum(["Azelvori-dev", "Azelvori-staging", "Azelvori-prod"]),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    profile: z
      .string()
      .regex(/^[\w.@-]+$/)
      .optional(),
    apply: z.boolean().default(false),
  })
  .strict();
export type SetupOptions = z.infer<typeof OptionsSchema>;
export function parseOptions(args: string[]): SetupOptions {
  const values: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || key in values)
      throw new Error("Invalid or repeated option");
    if (key === "apply") values[key] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw new Error(`Missing value for --${key}`);
      values[key] = args[++i];
    }
  }
  const result = OptionsSchema.safeParse(values);
  if (!result.success)
    throw new Error(
      "Required: --account (12 digits) --region --stack Azelvori-staging --email; optional --profile and --apply",
    );
  return result.data;
}
type Attribute = { Name?: string; Value?: string };
type CognitoUser = {
  Username?: string;
  Enabled?: boolean;
  UserStatus?: string;
  UserAttributes?: Attribute[];
};
type AwsResult = Record<string, unknown>;
export type AwsCall = (
  service: string,
  operation: string,
  input: Record<string, unknown>,
) => Promise<AwsResult>;
export class AwsFailure extends Error {
  constructor(
    public code: string,
    operation?: string,
  ) {
    super(`AWS operation failed: ${code}${operation ? ` (${operation})` : ""}`);
  }
}
export function awsCli(
  options: Pick<SetupOptions, "region" | "profile">,
): AwsCall {
  return async (service, operation, input) => {
    // Amplify inputs may contain existing private environment variables. Keep them
    // out of process arguments and logs, and remove the owner-only file on exit.
    const directory = mkdtempSync(join(tmpdir(), "azelvori-aws-"));
    try {
      const request = join(directory, "request.json");
      writeFileSync(request, JSON.stringify(input), { mode: 0o600 });
      const result = execFileSync(
        "aws",
        [
          service,
          operation,
          "--region",
          options.region,
          ...(options.profile ? ["--profile", options.profile] : []),
          "--output",
          "json",
          "--no-cli-pager",
          "--cli-connect-timeout",
          "10",
          "--cli-read-timeout",
          "30",
          "--cli-input-json",
          `file://${request}`,
        ],
        {
          encoding: "utf8",
          timeout: 45000,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, AWS_CLI_AUTO_PROMPT: "off" },
        },
      );
      return result.trim() ? JSON.parse(result) : {};
    } catch (e) {
      const stderr = (e as { stderr?: string }).stderr ?? "";
      // Print only the machine error code, never provider output or credentials.
      const code = /An error occurred \(([A-Za-z][A-Za-z0-9]+)\)/.exec(
        String(stderr),
      )?.[1];
      if (
        service === "cloudformation" &&
        operation === "describe-stacks" &&
        code === "ValidationError" &&
        typeof input.StackName === "string" &&
        String(stderr).includes(
          `Stack with id ${input.StackName} does not exist`,
        )
      )
        throw new AwsFailure("StackNotFound");
      throw new AwsFailure(
        code ?? "CHECK_AWS_CLI_PROFILE_AND_PERMISSIONS",
        `${service}/${operation}`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
}
function principal(user: CognitoUser, email: string) {
  const attributes = user.UserAttributes ?? [];
  const sub = attributes.find((a) => a.Name === "sub")?.Value;
  const address = attributes.find((a) => a.Name === "email")?.Value;
  // Cognito explicitly does not guarantee RFC UUIDs. Treat its authenticated
  // AdminGetUser sub as an opaque, case-sensitive identifier and preserve it.
  // https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html
  if (typeof sub !== "string" || !sub.trim())
    throw new Error(
      "COGNITO_SUB_MISSING: Cognito returned no usable sub; no grant written",
    );
  if (typeof address !== "string" || address.toLowerCase() !== email)
    throw new Error(
      "COGNITO_EMAIL_MISMATCH: Cognito email does not exactly match the requested email; no grant written",
    );
  if (user.Enabled !== true)
    throw new Error(
      "COGNITO_NOT_ENABLED: Cognito did not confirm that the account is enabled; no grant written",
    );
  if (!["CONFIRMED", "FORCE_CHANGE_PASSWORD"].includes(user.UserStatus ?? ""))
    throw new Error(
      "COGNITO_STATUS_NOT_READY: Cognito account must be CONFIRMED or FORCE_CHANGE_PASSWORD; no grant written",
    );
  return sub;
}
type Grant = {
  data?: {
    M?: {
      userId?: { S?: string };
      role?: { S?: string };
      active?: { BOOL?: boolean };
    };
  };
};
function activeGrant(item: Grant | undefined, sub: string) {
  if (!item) return false;
  const g = item.data?.M;
  if (
    g?.userId?.S === sub &&
    g.role?.S === "FOUNDER_ADMIN" &&
    g.active?.BOOL === true
  )
    return true;
  throw new Error(
    "A different or revoked staff grant already exists; refusing to overwrite or reactivate it",
  );
}
export async function setupAdmin(options: SetupOptions, aws: AwsCall) {
  const caller = await aws("sts", "get-caller-identity", {});
  if (caller.Account !== options.account || typeof caller.Arn !== "string")
    throw new Error("AWS account does not match --account; no changes made");
  const stackResult = await aws("cloudformation", "describe-stacks", {
    StackName: options.stack,
  });
  const stack = (
    stackResult.Stacks as
      | {
          StackId?: string;
          StackStatus?: string;
          Outputs?: { OutputKey: string; OutputValue: string }[];
        }[]
      | undefined
  )?.[0];
  if (
    !stack?.StackId?.includes(
      `:${options.region}:${options.account}:stack/${options.stack}/`,
    ) ||
    ![
      "CREATE_COMPLETE",
      "UPDATE_COMPLETE",
      "UPDATE_ROLLBACK_COMPLETE",
    ].includes(stack.StackStatus ?? "")
  )
    throw new Error(
      "Stack target or deployment status does not match; no changes made",
    );
  const outputs = Object.fromEntries(
    (stack.Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]),
  );
  for (const key of [
    "UserPoolId",
    "OperationsTable",
    "AuditTable",
    "AppOrigin",
    "ApiBaseUrl",
    "CognitoAuthority",
    "CognitoClientId",
    "CognitoDomain",
  ])
    if (!outputs[key])
      throw new Error(
        `Stack output ${key} is missing; deploy the current backend first`,
      );
  const origin = new URL(outputs.AppOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== outputs.AppOrigin ||
    !outputs.UserPoolId.startsWith(`${options.region}_`)
  )
    throw new Error("Stack origin or Cognito region is invalid");
  const frontend = {
    VITE_API_BASE_URL: outputs.ApiBaseUrl,
    VITE_COGNITO_AUTHORITY: outputs.CognitoAuthority,
    VITE_COGNITO_CLIENT_ID: outputs.CognitoClientId,
    VITE_COGNITO_DOMAIN: outputs.CognitoDomain,
    VITE_SITE_URL: outputs.AppOrigin,
    VITE_PUBLIC_INTAKE_ENABLED: "false",
  };
  let user: CognitoUser | undefined;
  try {
    user = await aws("cognito-idp", "admin-get-user", {
      UserPoolId: outputs.UserPoolId,
      Username: options.email,
    });
  } catch (e) {
    if (
      !(e instanceof Error) ||
      !("code" in e) ||
      e.code !== "UserNotFoundException"
    )
      throw e;
  }
  let sub = user ? principal(user, options.email) : undefined;
  const readGrant = async (id: string) => {
    const result = await aws("dynamodb", "get-item", {
      TableName: outputs.OperationsTable,
      Key: { pk: { S: `STAFF#${id}` }, sk: { S: "META" } },
      ConsistentRead: true,
    });
    return activeGrant(result.Item as Grant | undefined, id);
  };
  let granted = sub ? await readGrant(sub) : false;
  const plan = {
    account: options.account,
    region: options.region,
    stack: options.stack,
    email: options.email,
    user: user ? "EXISTING" : "CREATE_AND_EMAIL_INVITATION",
    grant: granted ? "ALREADY_ACTIVE" : "CREATE_FOUNDER_ADMIN",
    adminUrl: `${outputs.AppOrigin}/admin/login`,
    frontend,
  };
  if (!options.apply) return { mode: "PLAN_ONLY", ...plan };
  if (!user) {
    await aws("cognito-idp", "admin-create-user", {
      UserPoolId: outputs.UserPoolId,
      Username: options.email,
      UserAttributes: [{ Name: "email", Value: options.email }],
      DesiredDeliveryMediums: ["EMAIL"],
      ForceAliasCreation: false,
      // Cognito generates and delivers the temporary password. Never expose or set it here.
    });
    // Read the actual account from the same pool/email before granting access.
    // AdminCreateUser's summary is not the source of identity for the grant.
    // If this read fails, a rerun resumes with the existing account, no resend.
    user = await aws("cognito-idp", "admin-get-user", {
      UserPoolId: outputs.UserPoolId,
      Username: options.email,
    });
    sub = principal(user, options.email);
    granted = await readGrant(sub);
  }
  if (!sub) throw new Error("No verified target principal");
  if (!granted) {
    const at = new Date().toISOString(),
      requestId = randomUUID();
    await aws("dynamodb", "transact-write-items", {
      ClientRequestToken: requestId,
      TransactItems: [
        {
          Put: {
            TableName: outputs.OperationsTable,
            Item: {
              pk: { S: `STAFF#${sub}` },
              sk: { S: "META" },
              data: {
                M: {
                  userId: { S: sub },
                  role: { S: "FOUNDER_ADMIN" },
                  active: { BOOL: true },
                },
              },
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: outputs.AuditTable,
            Item: {
              pk: { S: `STAFF#${sub}` },
              sk: { S: `${at}#${requestId}` },
              action: { S: "staff.founder.provisioned" },
              actor: { S: caller.Arn },
              target: { S: sub },
              at: { S: at },
              requestId: { S: requestId },
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
    });
    if (!(await readGrant(sub)))
      throw new Error(
        "Grant verification did not succeed; inspect the deployment before retrying",
      );
  }
  return { mode: "APPLIED", ...plan, grant: "ACTIVE_VERIFIED" };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes("--help")) {
    console.log(
      "npm run admin:setup -- --account 123456789012 --region ap-southeast-1 --stack Azelvori-staging --email owner@example.com [--profile PROFILE] [--apply]\nDefault: read-only plan. --apply creates the requested founder account (with Cognito email invitation), grant and audit. Never supplies a password. See docs/17_ADMIN_ACTIVATION.md.",
    );
  } else {
    try {
      const options = parseOptions(process.argv.slice(2));
      console.log(
        JSON.stringify(await setupAdmin(options, awsCli(options)), null, 2),
      );
    } catch (e) {
      console.error(e instanceof Error ? e.message : "Setup failed");
      process.exitCode = 1;
    }
  }
}
