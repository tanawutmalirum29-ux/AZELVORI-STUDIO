/**
 * API Gateway validates issuer, client audience, JWT signature, expiration
 * and that a protected route has at least one of these permitted scopes.
 *
 * Cognito Hosted OAuth issues azelvori/access. Cognito USER_PASSWORD_AUTH
 * issues aws.cognito.signin.user.admin without the custom resource scope.
 * Do not trust raw bearer headers: callers must supply validated Gateway claims.
 */
const allowedScopes = new Set([
  "azelvori/access",
  "aws.cognito.signin.user.admin",
]);
export function hasValidatedAccessClaims(
  claims: Record<string, unknown> | undefined,
): claims is Record<string, unknown> & { sub: string; scope: string } {
  return (
    typeof claims?.sub === "string" &&
    claims.sub.length > 0 &&
    claims.token_use === "access" &&
    typeof claims.scope === "string" &&
    claims.scope.split(" ").some((scope) => allowedScopes.has(scope))
  );
}
