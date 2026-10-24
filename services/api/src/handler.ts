import { DynamoRepository } from "./dynamo";
import { createHandler } from "./http";
import { DynamoWorkspaceStore } from "./workspace-store";
import { WorkspaceService } from "./workspace";
import { CognitoIdentity } from "./identity";
import { EmployeeService } from "./employees";
const table = process.env.DATA_TABLE,
  audit = process.env.AUDIT_TABLE,
  origin = process.env.APP_ORIGIN;
if (!table || !audit || !origin)
  throw new Error("Missing required API configuration");
const pool = process.env.USER_POOL_ID;
if (!pool) throw new Error("Missing user pool configuration");
const repository = new DynamoRepository(table, audit);
const staffPool = process.env.EMPLOYEE_POOL_ID;
const staffClient = process.env.EMPLOYEE_CLIENT_ID;
if (!staffPool || !staffClient) throw new Error("Missing employee configuration");
const workspaceStore = new DynamoWorkspaceStore(table, audit);
export const handler = createHandler(repository, {
  intakeEnabled: process.env.INTAKE_ENABLED === "true",
  allowedOrigin: origin,
  employees: new EmployeeService(workspaceStore, repository, table, staffPool),
  employeeConfig: { poolId: staffPool, clientId: staffClient, region: process.env.AWS_REGION ?? "ap-southeast-2" },
  workspace: new WorkspaceService(
    workspaceStore,
    repository,
    new CognitoIdentity(pool),
  ),
});
