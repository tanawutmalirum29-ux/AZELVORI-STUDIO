import { DynamoRepository } from "./dynamo";
import { createHandler } from "./http";
import { DynamoWorkspaceStore } from "./workspace-store";
import { WorkspaceService } from "./workspace";
import { CognitoIdentity } from "./identity";
const table = process.env.DATA_TABLE,
  audit = process.env.AUDIT_TABLE,
  origin = process.env.APP_ORIGIN;
if (!table || !audit || !origin)
  throw new Error("Missing required API configuration");
const pool = process.env.USER_POOL_ID;
if (!pool) throw new Error("Missing user pool configuration");
const repository = new DynamoRepository(table, audit);
export const handler = createHandler(repository, {
  intakeEnabled: process.env.INTAKE_ENABLED === "true",
  allowedOrigin: origin,
  workspace: new WorkspaceService(
    new DynamoWorkspaceStore(table, audit),
    repository,
    new CognitoIdentity(pool),
  ),
});
