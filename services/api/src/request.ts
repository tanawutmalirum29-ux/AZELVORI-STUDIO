import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { HttpError } from "./domain";
export function parseBody(event: APIGatewayProxyEventV2): unknown {
  const contentType = event.headers["content-type"]
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new HttpError(415, "CONTENT_TYPE", "ใช้ application/json เท่านั้น");
  if (!event.body || event.body.length > 40_000)
    throw new HttpError(413, "BODY_TOO_LARGE", "ข้อมูลยาวเกินกำหนด");
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  if (Buffer.byteLength(body) > 24_000)
    throw new HttpError(413, "BODY_TOO_LARGE", "ข้อมูลยาวเกินกำหนด");
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
