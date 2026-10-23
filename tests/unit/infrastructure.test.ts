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
  it("MFA, private identity, scoped JWT routes, retention and disabled intake are synthesized", () => {
    const template = Template.fromStack(
      new FoundationStack(new App(), "Test", options),
    );
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      MfaConfiguration: "ON",
      EnabledMfas: ["SOFTWARE_TOKEN_MFA"],
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      DeletionProtection: "ACTIVE",
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
      AllowedOAuthFlows: ["code"],
      EnableTokenRevocation: true,
      AllowedOAuthScopes: Match.arrayWith(["aws.cognito.signin.user.admin"]),
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/admin/leads",
      AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access"],
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/admin/leads/{id}",
      AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access"],
    });
    template.hasOutput("AuditTable", { Value: Match.anyValue() });
    template.hasOutput("AppOrigin", { Value: options.appOrigin });
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
        !["POST /api/v1/leads", "GET /health"].includes(r.Properties.RouteKey),
    );
    expect(privateRoutes.length).toBeGreaterThanOrEqual(16);
    for (const { Properties: p } of privateRoutes) {
      expect(p.AuthorizationType).toBe("JWT");
      expect(p.AuthorizationScopes).toEqual(["azelvori/access"]);
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
    expect(provision).toHaveLength(1);
    expect(provision[0].Action).toEqual([
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminGetUser",
    ]);
    expect(JSON.stringify(provision[0].Resource)).toContain("Fn::GetAtt");
    expect(JSON.stringify(provision[0].Resource)).not.toContain("*");
  });
});
