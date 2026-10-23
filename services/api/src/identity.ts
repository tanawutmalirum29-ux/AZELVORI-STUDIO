import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  GetUserCommand,
  GetUserAttributeVerificationCodeCommand,
  VerifyUserAttributeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { HttpError } from "./domain";
export type Actor = { sub: string; token: string };
export type VerifiedIdentity = {
  userId: string;
  email: string;
  emailVerified: boolean;
};
export interface IdentityProvider {
  current(actor: Actor): Promise<VerifiedIdentity>;
  ensureAccount(email: string): Promise<"CREATED" | "EXISTING">;
  requestVerification(actor: Actor): Promise<void>;
  verify(actor: Actor, code: string): Promise<void>;
}
export class CognitoIdentity implements IdentityProvider {
  constructor(
    private pool: string,
    private client = new CognitoIdentityProviderClient({}),
  ) {}
  async current(actor: Actor) {
    const user = await this.client
      .send(new GetUserCommand({ AccessToken: actor.token }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "NotAuthorizedException")
          throw new HttpError(
            401,
            "SESSION_EXPIRED",
            "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
          );
        throw error;
      });
    const attrs = Object.fromEntries(
      (user.UserAttributes ?? []).map((a) => [a.Name, a.Value]),
    );
    if (attrs.sub !== actor.sub || !attrs.email)
      throw new HttpError(401, "IDENTITY_MISMATCH", "กรุณาเข้าสู่ระบบใหม่");
    return {
      userId: actor.sub,
      email: attrs.email.toLowerCase(),
      emailVerified: attrs.email_verified === "true",
    };
  }
  async ensureAccount(email: string): Promise<"CREATED" | "EXISTING"> {
    try {
      await this.client.send(
        new AdminGetUserCommand({ UserPoolId: this.pool, Username: email }),
      );
      return "EXISTING";
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "UserNotFoundException")
        throw error;
    }
    try {
      await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.pool,
          Username: email,
          DesiredDeliveryMediums: ["EMAIL"],
          UserAttributes: [{ Name: "email", Value: email }],
          ForceAliasCreation: false,
        }),
      );
      return "CREATED";
    } catch (error) {
      if (error instanceof Error && error.name === "UsernameExistsException")
        return "EXISTING";
      throw error;
    }
  }
  async requestVerification(actor: Actor) {
    await this.client.send(
      new GetUserAttributeVerificationCodeCommand({
        AccessToken: actor.token,
        AttributeName: "email",
      }),
    );
  }
  async verify(actor: Actor, code: string) {
    try {
      await this.client.send(
        new VerifyUserAttributeCommand({
          AccessToken: actor.token,
          AttributeName: "email",
          Code: code,
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        ["CodeMismatchException", "ExpiredCodeException"].includes(error.name)
      )
        throw new HttpError(
          422,
          "INVALID_CODE",
          "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบหรือขอรหัสใหม่",
        );
      throw error;
    }
  }
}
