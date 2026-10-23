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
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /api/v1/admin/leads",
      AuthorizationType: "JWT",
      AuthorizationScopes: ["azelvori/access"],
    });
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
});
