# AZELVORI first-party login — staging rollout

**Status:** implemented in source, not active in AWS until the existing stack and Amplify deployment are updated and tested.

## Features
- /admin/login and /login are fully branded first-party forms.
- Direct password verification by Amazon Cognito, TOTP challenge and enrollment, required new password and email password reset.
- OAuth hosted login remains as an explicit fallback.
- Passwords and MFA codes are not saved to browser storage or sent to AZELVORI's app API. Access, ID and refresh tokens are stored per-tab in sessionStorage.
- The app refreshes its short-lived access token on demand; logout revokes the Cognito refresh token where possible.
- Accounts remain invite-only. The user pool continues to require MFA.

## Important scope contract
Cognito InitiateAuth issues only the aws.cognito.signin.user.admin scope, not azelvori/access. The CDK stack now authorizes either scope at API Gateway **only for signed Cognito access tokens from the configured user pool and public client**, retaining required server-side founder, tenant and project membership checks. The OAuth redirect fallback retains its custom scope.

## Existing staging AWS stack upgrade — operator steps
The CloudShell activation wizard is intentionally a create/reuse tool and does not update an existing stack. Do not assume that re-running it updates authentication routes.

1. Open AWS CloudShell in the same AWS account and region as the existing Azelvori-staging stack: Sydney ap-southeast-2.
2. After the verified code is merged to main, update the existing repository checkout and inspect the current stack and account.
3. Reuse the existing LambdaConcurrencyMode=shared context and keep intake disabled. First run **cdk diff**, checking that only intended changes to Cognito client authorization flows and API Gateway JWT route scopes are made. Do not replace the Cognito user pool or DynamoDB.
4. If correct, deploy the same stack and contexts. Example commands below.
5. Verify the Amplify main deployment succeeded and that the new login page is served.
6. Test real first-party email/password, MFA setup/code, password recovery, refresh/logout and founder permission. Test customer A cannot read customer B's project. Until the live test passes, use the visible hosted-Cognito fallback.

Commands for the operator, after inspecting the correct AWS identity and existing configuration:

    cd ~/AZELVORI-STUDIO
    git pull --ff-only origin main
    npm ci --ignore-scripts
    npm run build:api
    export AWS_REGION=ap-southeast-2
    export AWS_DEFAULT_REGION=ap-southeast-2
    aws sts get-caller-identity
    aws cloudformation describe-stacks --stack-name Azelvori-staging --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}'
    npx cdk diff Azelvori-staging --app 'node --import tsx infrastructure/cdk/app.ts' -c stage=staging -c appOrigin=https://main.d3uhwi8blbgrci.amplifyapp.com -c intakeEnabled=false -c legalReady=false -c lambdaConcurrency=shared
    # ONLY AFTER approving the diff:
    npx cdk deploy Azelvori-staging --app 'node --import tsx infrastructure/cdk/app.ts' -c stage=staging -c appOrigin=https://main.d3uhwi8blbgrci.amplifyapp.com -c intakeEnabled=false -c legalReady=false -c lambdaConcurrency=shared

Do not copy commands verbatim if the actual stack has different context values. Staging continues with IntakeEnabled=false, no public customer onboarding, and no assumption of production readiness.

The current stack uses nonrotating refresh tokens; changing refresh-token rotation requires adapting and retesting the direct token refresh flow. Token-refresh issues or an unupgraded scope gateway are reasons to use the OAuth fallback until resolved.

CI exercises source, IaC and synthetic Cognito responses only, **not a real AWS sign-in**.
