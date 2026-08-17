import assert from "node:assert/strict";
import test from "node:test";
import { classifyForExpiry } from "../src/lifecycle_policy.js";

test("expires an old receipt but retains a future volunteer reminder", () => {
  const now = new Date("2026-08-17T04:00:00.000Z");
  const receipt = classifyForExpiry(
    "throwaway/donor-receipt/2026-08-16T04:00:00.000Z/receipt-104.json",
    now,
  );
  const reminder = classifyForExpiry(
    "throwaway/volunteer-reminder/2026-08-18T04:00:00.000Z/shift-22.json",
    now,
  );

  assert.equal(receipt?.expired, true);
  assert.equal(receipt?.kind, "donor-receipt");
  assert.equal(reminder?.expired, false);
});

test("ignores permanent and unrelated keys", () => {
  assert.equal(
    classifyForExpiry("archive/campaign-report/annual.json", new Date("2026-08-17T04:00:00Z")),
    null,
  );
});
