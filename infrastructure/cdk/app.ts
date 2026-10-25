import {
  App,
  Stack,
  Duration,
  RemovalPolicy,
  CfnOutput,
  Tags,
  aws_dynamodb as dynamodb,
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_logs as logs,
  aws_apigatewayv2 as apigateway,
  aws_apigatewayv2_authorizers as authorizers,
  aws_apigatewayv2_integrations as integrations,
  aws_cloudwatch as cloudwatch,
  aws_budgets as budgets,
} from "aws-cdk-lib";
import { fileURLToPath } from "node:url";
import { Construct } from "constructs";

export type LambdaConcurrencyMode = "reserved" | "shared";
export type FoundationOptions = {
  stage: "dev" | "staging" | "prod";
  appOrigin: string;
  intakeEnabled: boolean;
  legalReady: boolean;
  budgetEmail?: string;
  budgetUsd?: number;
  lambdaConcurrency?: LambdaConcurrencyMode;
};
export function validateOptions(o: FoundationOptions) {
  if (!["dev", "staging", "prod"].includes(o.stage))
    throw new Error("stage must be dev, staging or prod");
  if (!["reserved", "shared"].includes(o.lambdaConcurrency ?? "reserved"))
    throw new Error("lambdaConcurrency must be reserved or shared");
  if (
    o.lambdaConcurrency === "shared" &&
    (o.stage !== "staging" || o.intakeEnabled)
  )
    throw new Error(
      "Shared Lambda concurrency is only supported for staging with public intake disabled; use reserved before opening intake",
    );
  const url = new URL(o.appOrigin);
  if (
    url.origin !== o.appOrigin ||
    (url.protocol !== "https:" &&
      !(
        o.stage === "dev" &&
        url.hostname === "localhost" &&
        url.protocol === "http:"
      ))
  )
    throw new Error(
      "appOrigin must be an HTTPS origin without a trailing slash (localhost HTTP allowed only in dev)",
    );
  if (o.intakeEnabled && !o.legalReady)
    throw new Error(
      "Intake requires legalReady after publishing reviewed identity and privacy notices",
    );
  if (o.stage === "prod" && (!o.budgetEmail || !o.budgetUsd || !o.legalReady))
    throw new Error(
      "Production requires legalReady, budgetEmail and budgetUsd",
    );
  if (o.budgetEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.budgetEmail))
    throw new Error("Invalid budget email");
  if (
    o.budgetUsd !== undefined &&
    (!Number.isFinite(o.budgetUsd) || o.budgetUsd <= 0)
  )
    throw new Error("Budget must be positive");
}
export class FoundationStack extends Stack {
  constructor(scope: Construct, id: string, options: FoundationOptions) {
    super(scope, id);
    validateOptions(options);
    const concurrencyMode = options.lambdaConcurrency ?? "reserved";
    Tags.of(this).add("Project", "AZELVORI-STUDIO");
    Tags.of(this).add("Environment", options.stage);
    const data = new dynamodb.Table(this, "Operations", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: "expiresAt",
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    data.addGlobalSecondaryIndex({
      indexName: "gsi1",
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    const audit = new dynamodb.Table(this, "Audit", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const pool = new cognito.UserPool(this, "Identity", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        // Allow memorable passphrases without character-class requirements.
        // This pool requires a separate TOTP factor for every sign-in.
        minLength: 12,
        requireDigits: false,
        requireLowercase: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    // Completely separate employee identity boundary. Existing founder/customer pool unchanged.
    const employeePool = new cognito.UserPool(this, "EmployeeIdentity", {
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      mfa: cognito.Mfa.OFF,
      passwordPolicy: { minLength: 12, requireDigits: true, requireLowercase: true,
        requireUppercase: true, requireSymbols: false },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const employeeClient = employeePool.addClient("EmployeeWebClient", {
      generateSecret: false,
      authFlows: { userPassword: true },
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.hours(8),
    });
    const scopeAccess = new cognito.ResourceServerScope({
      scopeName: "access",
      scopeDescription:
        "Authenticated studio API access; staff grants are checked separately",
    });
    const resource = pool.addResourceServer("StudioApiScope", {
      identifier: "azelvori",
      scopes: [scopeAccess],
    });
    const client = pool.addClient("WebClient", {
      generateSecret: false,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      // A first-party form uses USER_PASSWORD_AUTH; retain SRP and OAuth redirect as fallback.
      authFlows: { userSrp: true, userPassword: true },
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.hours(8),
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.COGNITO_ADMIN,
          cognito.OAuthScope.resourceServer(resource, scopeAccess),
        ],
        callbackUrls: [`${options.appOrigin}/auth/callback`],
        logoutUrls: [`${options.appOrigin}/login`],
      },
    });
    const domain = pool.addDomain("ManagedLogin", {
      cognitoDomain: {
        domainPrefix: `azelvori-${options.stage}-${this.account}`,
      },
    });
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const fn = new lambda.Function(this, "Api", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        fileURLToPath(new URL("../../services/api/dist", import.meta.url)),
      ),
      timeout: Duration.seconds(15),
      memorySize: 256,
      reservedConcurrentExecutions:
        concurrencyMode === "reserved" ? 5 : undefined,
      logGroup,
      environment: {
        DATA_TABLE: data.tableName,
        AUDIT_TABLE: audit.tableName,
        APP_ORIGIN: options.appOrigin,
        INTAKE_ENABLED: String(options.intakeEnabled),
        USER_POOL_ID: pool.userPoolId,
        EMPLOYEE_POOL_ID: employeePool.userPoolId,
        EMPLOYEE_CLIENT_ID: employeeClient.userPoolClientId,
      },
    });
    // Audit: PutItem only. The runtime cannot alter or delete historical audit events.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:ConditionCheckItem",
        ],
        resources: [data.tableArn, `${data.tableArn}/index/gsi1`],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [audit.tableArn],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminCreateUser", "cognito-idp:AdminGetUser"],
        resources: [pool.userPoolArn],
      }),
    );
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:AdminCreateUser", "cognito-idp:AdminSetUserPassword", "cognito-idp:AdminDisableUser"],
      resources: [employeePool.userPoolArn],
    }));
    const api = new apigateway.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowOrigins: [options.appOrigin],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PATCH,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: [
          "content-type",
          "authorization",
          "idempotency-key",
          "if-match",
        ],
        maxAge: Duration.hours(1),
      },
    });
    const integration = new integrations.HttpLambdaIntegration(
      "ApiHandler",
      fn,
    );
    const issuer = `https://cognito-idp.${this.region}.${this.urlSuffix}/${pool.userPoolId}`;
    const jwt = new authorizers.HttpJwtAuthorizer("CognitoJwt", issuer, {
      jwtAudience: [client.userPoolClientId],
    });
    // Bind the shared HttpLambdaIntegration to the original first route
    // before registering additional employee endpoints. CDK derives its logical
    // ID from the first binding: changing that would replace the integration
    // and unnecessarily re-point every existing customer/admin API route.
    api.addRoutes({
      path: "/health",
      methods: [apigateway.HttpMethod.GET],
      integration,
    });
    const employeeJwt = new authorizers.HttpJwtAuthorizer("EmployeeCognitoJwt",
      "https://cognito-idp." + this.region + "." + this.urlSuffix + "/" + employeePool.userPoolId, {
        jwtAudience: [employeeClient.userPoolClientId],
      });
    api.addRoutes({
      path: "/api/v1/employee/config",
      methods: [apigateway.HttpMethod.GET],
      integration,
    });
    api.addRoutes({
      path: "/api/v1/admin/employees",
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      integration, authorizer: jwt,
      authorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    api.addRoutes({
      path: "/api/v1/admin/employees/{key}/reissue",
      methods: [apigateway.HttpMethod.POST],
      integration, authorizer: jwt,
      authorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    api.addRoutes({
      path: "/api/v1/admin/employees/{key}/revoke",
      methods: [apigateway.HttpMethod.POST],
      integration, authorizer: jwt,
      authorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    for (const [staffPath, methods] of [
      ["/api/v1/employee/me", [apigateway.HttpMethod.GET]],
      ["/api/v1/employee/projects", [apigateway.HttpMethod.GET]],
      ["/api/v1/employee/leads", [apigateway.HttpMethod.GET]],
      ["/api/v1/employee/leads/{id}/acknowledge", [apigateway.HttpMethod.POST]],
      ["/api/v1/employee/projects/{id}/messages",
        [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST]],
    ] as [string, apigateway.HttpMethod[]][]) {
      api.addRoutes({
        path: staffPath, methods, integration, authorizer: employeeJwt,
        authorizationScopes: ["aws.cognito.signin.user.admin"],
      });
    }
    api.addRoutes({
      path: "/api/v1/leads",
      methods: [apigateway.HttpMethod.POST],
      integration,
    });
    api.addRoutes({
      path: "/api/v1/admin/leads",
      methods: [apigateway.HttpMethod.GET],
      integration,
      authorizer: jwt,
      // OAuth hosted sign-in supplies azelvori/access. Native Cognito
      // InitiateAuth supplies only aws.cognito.signin.user.admin; both are
      // JWT-authorized here, with staff/project permissions enforced in Lambda.
      authorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    api.addRoutes({
      path: "/api/v1/admin/leads/{id}",
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.PATCH],
      integration,
      authorizer: jwt,
      // OAuth hosted sign-in supplies azelvori/access. Native Cognito
      // InitiateAuth supplies only aws.cognito.signin.user.admin; both are
      // JWT-authorized here, with staff/project permissions enforced in Lambda.
      authorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
    });
    for (const [path, methods] of [
      ["/api/v1/me", [apigateway.HttpMethod.GET]],
      ["/api/v1/me/email/request", [apigateway.HttpMethod.POST]],
      ["/api/v1/me/email/verify", [apigateway.HttpMethod.POST]],
      ["/api/v1/projects", [apigateway.HttpMethod.GET]],
      ["/api/v1/projects/{id}", [apigateway.HttpMethod.GET]],
      [
        "/api/v1/projects/{id}/messages",
        [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      ],
      [
        "/api/v1/projects/{id}/milestones/{milestone}/accept",
        [apigateway.HttpMethod.POST],
      ],
      ["/api/v1/invitations/accept", [apigateway.HttpMethod.POST]],
      ["/api/v1/admin/projects", [apigateway.HttpMethod.POST]],
      ["/api/v1/admin/projects/{id}", [apigateway.HttpMethod.PATCH]],
      ["/api/v1/admin/projects/{id}/invitations", [apigateway.HttpMethod.POST]],
      [
        "/api/v1/admin/projects/{id}/invitations/{invite}/revoke",
        [apigateway.HttpMethod.POST],
      ],
      ["/api/v1/admin/projects/{id}/members", [apigateway.HttpMethod.GET]],
      [
        "/api/v1/admin/projects/{id}/members/{user}/revoke",
        [apigateway.HttpMethod.POST],
      ],
    ] as [string, apigateway.HttpMethod[]][])
      api.addRoutes({
        path,
        methods,
        integration,
        authorizer: jwt,
        // OAuth hosted sign-in supplies azelvori/access. Native Cognito
      // InitiateAuth supplies only aws.cognito.signin.user.admin; both are
      // JWT-authorized here, with staff/project permissions enforced in Lambda.
      authorizationScopes: ["azelvori/access", "aws.cognito.signin.user.admin"],
      });
    const accessLogs = new logs.LogGroup(this, "AccessLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const stage = api.defaultStage?.node.defaultChild as apigateway.CfnStage;
    stage.defaultRouteSettings = {
      // Shared capacity is for private staging tests. API Gateway targets are
      // best-effort per route, not a hard concurrency or spending ceiling.
      throttlingBurstLimit: concurrencyMode === "shared" ? 5 : 20,
      throttlingRateLimit: concurrencyMode === "shared" ? 2 : 10,
    };
    stage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format:
        '{"requestId":"$context.requestId","route":"$context.routeKey","status":"$context.status","latency":"$context.responseLatency"}',
    };
    new cloudwatch.Alarm(this, "ApiErrors", {
      metric: fn.metricErrors({ period: Duration.minutes(5) }),
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription:
        "Connect an operational notification action before opening intake",
    });
    if (options.budgetEmail && options.budgetUsd)
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: `azelvori-${options.stage}-account-monthly`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: options.budgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: [50, 80, 100].map((threshold) => ({
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            thresholdType: "PERCENTAGE",
            threshold,
          },
          subscribers: [
            { subscriptionType: "EMAIL", address: options.budgetEmail! },
          ],
        })),
      });
    new CfnOutput(this, "ApiBaseUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "CognitoAuthority", { value: issuer });
    new CfnOutput(this, "CognitoClientId", { value: client.userPoolClientId });
    new CfnOutput(this, "CognitoDomain", { value: domain.baseUrl() });
    new CfnOutput(this, "OperationsTable", { value: data.tableName });
    new CfnOutput(this, "AuditTable", { value: audit.tableName });
    new CfnOutput(this, "AppOrigin", { value: options.appOrigin });
    new CfnOutput(this, "UserPoolId", { value: pool.userPoolId });
    new CfnOutput(this, "EmployeePoolId", { value: employeePool.userPoolId });
    new CfnOutput(this, "EmployeeClientId", { value: employeeClient.userPoolClientId });
    new CfnOutput(this, "IntakeEnabled", {
      value: String(options.intakeEnabled),
    });
    new CfnOutput(this, "LambdaConcurrencyMode", { value: concurrencyMode });
  }
}
// Importing the stack for assertions must not synthesize a second app.
if (process.argv[1]?.endsWith("/app.ts")) {
  const app = new App();
  const stage = app.node.tryGetContext("stage") ?? "dev";
  new FoundationStack(app, `Azelvori-${stage}`, {
    stage,
    appOrigin: app.node.tryGetContext("appOrigin") ?? "http://localhost:4173",
    intakeEnabled: app.node.tryGetContext("intakeEnabled") === "true",
    legalReady: app.node.tryGetContext("legalReady") === "true",
    lambdaConcurrency:
      app.node.tryGetContext("lambdaConcurrency") ?? "reserved",
    budgetEmail: app.node.tryGetContext("budgetEmail"),
    budgetUsd: app.node.tryGetContext("budgetUsd")
      ? Number(app.node.tryGetContext("budgetUsd"))
      : undefined,
  });
}
