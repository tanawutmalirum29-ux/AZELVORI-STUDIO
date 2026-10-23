import { expect, it } from "vitest";
import { newRequestId } from "../../apps/web/src/lib/id";
import { IdempotencyKeySchema } from "@azelvori/contracts";
it("fallback produces valid unique UUIDs without Math.random", () => {
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const ids = Array.from({ length: 100 }, () => newRequestId(source));
  expect(new Set(ids).size).toBe(100);
  expect(ids.every((id) => IdempotencyKeySchema.safeParse(id).success)).toBe(
    true,
  );
});
