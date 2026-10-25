import { describe, expect, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { FoundationStack, validateOptions } from "../../infrastructure/cdk/app";
const options = {
  stage: "dev" as const,
  appOrigin: "http://localhost:4173",
  intakeEnabled: false,
  legalReady: false,
};
describe("AWS foundation safeguards", () => {
  it("requires reviewed notices before intake and budget settings before production", () => {
    expect(() =>
      validateOptions({ ...options, intakeEnabled: true }),
    ).toThrow();
    expect(() => validateOptions({ ...options, stage: "prod" })).toThrow();
    expect(() =>
      validateOptions({ ...options, appOrigin: "https://studio.example/path" }),
    ).toThrow();
    expect(() =>
      validateOptions({
        ...options,
        stage: "staging",
        appOrigin: "http://studio.example",
      }),
    ).toThrow();
    expect(() =>
      validateOptions({
        ...options,
        appOrigin: "https://studio.example",
        stage: "prod",
        budgetEmail: "ops@example.com",
        budgetUsd: 25,
        legalReady: true,
      }),
    ).not.toThrow();
  });
  it("allows explicit founder-only staging pilot but never prod/dev or public intake", () => {
    const privateStaging = {
      ...options,
      stage: "staging" as const,
      appOrigin: "https://studio.example",
      pilotEnabled: true,
      lambdaConcurrency: "shared" as const,
    };
    expect(() => validateOptions(privateStaging)).not.toThrow();
    expect(() => validateOptions({ ...privateStaging, stage: "prod", legalReady: true,
      budgetEmail: "ops@example.com", budgetUsd: 25 })).toThrow("Founder-only pilot");
    expect(() => validateOptions({ ...privateStaging, stage: "dev" })).toThrow("Founder-only pilot");
    expect(() => validateOptions({ ...privateStaging, intakeEnabled: true, legalReady: true })).toThrow();
    const template = Template.fromStack(new FoundationStack(new App(), "PrivatePilot", privateStaging));
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({
        INTAKE_ENABLED: "false", PILOT_ENABLED: "true",
      }) },
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /api/v1/admin/pilot/leads",
      AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    template.hasOutput("PilotEnabled", { Value: "true" });
  });
  it("opens public beta in staging only after legal approval and verified privacy contact", () => {
    const beta = {
      ...options,
      stage: "staging" as const,
      appOrigin: "https://studio.example",
      intakeEnabled: true,
      publicBetaMode: true,
      pilotEnabled: false,
      legalReady: true,
      privacyContactEmail: "privacy@example.test",
      lambdaConcurrency: "shared" as const,
    };
    expect(() => validateOptions(beta)).not.toThrow();
    for (const invalid of [
      { ...beta, legalReady: false },
      { ...beta, privacyContactEmail: "" },
      { ...beta, privacyContactEmail: "not-an-email" },
      { ...beta, pilotEnabled: true },
      { ...beta, stage: "prod" as const, budgetUsd: 10, budgetEmail: "ops@example.test" },
      { ...beta, stage: "dev" as const },
    ]) expect(() => validateOptions(invalid)).toThrow();
    expect(() => validateOptions({ ...beta, publicBetaMode: false })).toThrow("Shared Lambda");
    const t = Template.fromStack(new FoundationStack(new App(), "PublicBeta", beta));
    t.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({
        INTAKE_ENABLED: "true", PILOT_ENABLED: "false",
      }) },
    });
    t.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      DefaultRouteSettings: { ThrottlingBurstLimit: 2, ThrottlingRateLimit: 1 },
    });
    t.hasOutput("IntakeEnabled", { Value: "true" });
    t.hasOutput("PublicBetaMode", { Value: "true" });
    t.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /api/v1/leads",
      AuthorizationType: "NONE",
    });
  });
  it("MFA, private identity, scoped JWT routes, retention and disabled intake are synthesized", () => {
    const template = Template.fromStack(
      new FoundationStack(new App(), "Test", options),
    );
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      MfaConfiguration: "ON",
      EnabledMfas: ["SOFTWARE_TOKEN_MFA"],
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      DeletionProtection: "ACTIVE",
      Policies: {
        PasswordPolicy: {
          MinimumLength: 12,
          RequireNumbers: false,
          RequireLowercase: false,
          RequireUppercase: false,
          RequireSymbols: false,
        },
      },
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
      AllowedOAuthFlows: ["code"],
      EnableTokenRevocation: true,
      ExplicitAuthFlows: Match.arrayWith(["ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH"]),
      AllowedOAuthScopes: Match.arrayWith(["aws.cognito.signin.user.admin"]),
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/admin/leads",
      AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/admin/leads/{id}",
      AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    template.hasOutput("AuditTable", { Value: Match.anyValue() });
    template.hasOutput("AppOrigin", { Value: options.appOrigin });
    template.hasOutput("IntakeEnabled", { Value: "false" });
    template.hasOutput("LambdaConcurrencyMode", { Value: "reserved" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /api/v1/leads",
      AuthorizationType: "NONE",
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      ReservedConcurrentExecutions: 5,
      Environment: { Variables: Match.objectLike({ INTAKE_ENABLED: "false" }) },
    });
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      DeletionProtectionEnabled: true,
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain("dynamodb:DeleteItem");
    expect(json).not.toContain("dynamodb:Scan");
    expect(json).not.toContain("dynamodb:*");
    expect(json).not.toContain("AWS::S3::Bucket"); // Uploads are intentionally unavailable.
  });
  it("protects every workspace route and scopes account provisioning to its own pool", () => {
    const template = Template.fromStack(
      new FoundationStack(new App(), "Workspace", options),
    );
    const routes = Object.values(
      template.findResources("AWS::ApiGatewayV2::Route"),
    ) as {
      Properties: {
        RouteKey: string;
        AuthorizationType: string;
        AuthorizationScopes?: string[];
      };
    }[];
    const privateRoutes = routes.filter(
      (r) =>
        !["POST /api/v1/leads", "GET /health", "GET /api/v1/employee/config"].includes(r.Properties.RouteKey),
    );
    expect(privateRoutes.length).toBeGreaterThanOrEqual(16);
    for (const { Properties: p } of privateRoutes) {
      expect(p.AuthorizationType).toBe("JWT");
      expect(p.AuthorizationScopes).toEqual(
        p.RouteKey.includes("/api/v1/employee/")
          ? ["aws.cognito.signin.user.admin"]
          : ["azelvori/access", "aws.cognito.signin.user.admin"],
      );
    }
    const policies = Object.values(
      template.findResources("AWS::IAM::Policy"),
    ) as {
      Properties: {
        PolicyDocument: {
          Statement: { Action: string | string[]; Resource: unknown }[];
        };
      };
    }[];
    const provision = policies
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .filter((s) =>
        JSON.stringify(s.Action).includes("cognito-idp:AdminCreateUser"),
      );
    expect(provision).toHaveLength(2);
    expect(provision.map(p=>p.Action)).toEqual(expect.arrayContaining([
      ["cognito-idp:AdminCreateUser", "cognito-idp:AdminGetUser"],
      ["cognito-idp:AdminCreateUser", "cognito-idp:AdminSetUserPassword", "cognito-idp:AdminDisableUser"],
    ]));
    for (const policy of provision) {
      expect(JSON.stringify(policy.Resource)).toContain("Fn::GetAtt");
      expect(JSON.stringify(policy.Resource)).not.toContain("*");
    }
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/employee/config", AuthorizationType: "NONE",
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/employee/projects", AuthorizationType: "JWT",
      AuthorizationScopes: ["aws.cognito.signin.user.admin"],
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /api/v1/admin/employees", AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /api/v1/admin/employees/{key}/reissue", AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    template.hasOutput("EmployeePoolId", { Value: Match.anyValue() });
    template.hasOutput("EmployeeClientId", { Value: Match.anyValue() });
  });
  it("keeps existing API Lambda integration logical ID stable when adding employee routes", () => {
    const template = Template.fromStack(
      new FoundationStack(new App(), "StableIntegration", options),
    );
    const integrations = template.findResources("AWS::ApiGatewayV2::Integration");
    const stableId = Object.keys(integrations).find((id) =>
      id.startsWith("HttpApiGEThealthApiHandler"),
    );
    expect(stableId).toBeDefined();
    expect(Object.keys(integrations)).toHaveLength(1);
    const routes = Object.values(
      template.findResources("AWS::ApiGatewayV2::Route"),
    ) as { Properties: { Target?: unknown } }[];
    for (const route of routes) {
      expect(JSON.stringify(route.Properties.Target)).toContain(stableId!);
    }
  });
  it("supports low-quota private staging without a Lambda reservation and with lower route throttles", () => {
    const template = Template.fromStack(
      new FoundationStack(new App(), "SharedStaging", {
        ...options,
        stage: "staging",
        appOrigin: "https://studio.example",
        lambdaConcurrency: "shared",
      }),
    );
    template.hasResourceProperties("AWS::Lambda::Function", {
      ReservedConcurrentExecutions: Match.absent(),
      Environment: { Variables: Match.objectLike({ INTAKE_ENABLED: "false" }) },
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      DefaultRouteSettings: { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 },
    });
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      MfaConfiguration: "ON",
      EnabledMfas: ["SOFTWARE_TOKEN_MFA"],
      Policies: {
        PasswordPolicy: {
          MinimumLength: 12,
          RequireNumbers: false,
          RequireLowercase: false,
          RequireUppercase: false,
          RequireSymbols: false,
        },
      },
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/admin/leads",
      AuthorizationType: "JWT",
    });
    template.hasOutput("LambdaConcurrencyMode", { Value: "shared" });
  });
  it("keeps shared capacity out of production, public intake and dev", () => {
    const shared = {
      ...options,
      appOrigin: "https://studio.example",
      lambdaConcurrency: "shared" as const,
    };
    expect(() => validateOptions(shared)).toThrow("only supported for staging");
    expect(() =>
      validateOptions({
        ...shared,
        stage: "staging",
        intakeEnabled: true,
        legalReady: true,
      }),
    ).toThrow("only supported for staging");
    expect(() =>
      validateOptions({
        ...shared,
        stage: "prod",
        legalReady: true,
        budgetEmail: "ops@example.test",
        budgetUsd: 25,
      }),
    ).toThrow("only supported for staging");
  });
});
