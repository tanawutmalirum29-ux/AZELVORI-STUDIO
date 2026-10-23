import { DynamoRepository } from "./dynamo";
import { createHandler } from "./http";
const table = process.env.DATA_TABLE,
  audit = process.env.AUDIT_TABLE,
  origin = process.env.APP_ORIGIN;
if (!table || !audit || !origin)
  throw new Error("Missing required API configuration");
export const handler = createHandler(new DynamoRepository(table, audit), {
  intakeEnabled: process.env.INTAKE_ENABLED === "true",
  allowedOrigin: origin,
});
