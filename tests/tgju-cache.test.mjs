import assert from "node:assert/strict";
import test from "node:test";
import { createCachedPriceSync } from "../server/tgju-cache.ts";

const baseRequest = {
  requests: [{ instrumentId: "gold_melted_18", dates: ["2026-07-09"] }],
  refreshTodayInstrumentIds: ["currency_usd"],
  today: "2026-07-10",
};

function quoted(instrumentId, date, priceToman) {
  return {
    instrumentId,
    name: instrumentId,
    category: instrumentId === "currency_usd" ? "currency" : "gold",
    date,
    status: "quoted",
    priceToman,
    fetchedAt: new Date().toISOString(),
  };
}

function response(records, errors = []) {
  return {
    records,
    errors,
    fetchedAt: new Date().toISOString(),
    requestedDayCount: records.length,
    successfulDayCount: records.length,
  };
}

test("uses cached TGJU records within the TTL", async () => {
  let now = 1_000;
  const calls = [];
  const sync = createCachedPriceSync(
    async (input) => {
      calls.push(input);
      return response([quoted("gold_melted_18", "2026-07-09", 100), quoted("currency_usd", "2026-07-10", 170_000)]);
    },
    { now: () => now },
  );

  const first = await sync(baseRequest, fetch);
  now += 60_000;
  const second = await sync(baseRequest, fetch);

  assert.equal(calls.length, 1);
  assert.deepEqual(first.records.map((record) => record.priceToman), [100, 170_000]);
  assert.deepEqual(second.records.map((record) => record.priceToman), [100, 170_000]);
  assert.equal(second.requestedDayCount, 2);
  assert.equal(second.successfulDayCount, 2);
});

test("refetches stale TGJU records after the TTL", async () => {
  let now = 1_000;
  const calls = [];
  const sync = createCachedPriceSync(
    async (input) => {
      calls.push(input);
      const price = calls.length === 1 ? 100 : 120;
      return response([quoted("gold_melted_18", "2026-07-09", price)]);
    },
    { now: () => now },
  );

  await sync({ ...baseRequest, refreshTodayInstrumentIds: [] }, fetch);
  now += 31 * 60 * 1000;
  const refreshed = await sync({ ...baseRequest, refreshTodayInstrumentIds: [] }, fetch);

  assert.equal(calls.length, 2);
  assert.equal(refreshed.records[0].priceToman, 120);
});

test("keeps stale cached records when TGJU refetch reports an error", async () => {
  let now = 1_000;
  let calls = 0;
  const sync = createCachedPriceSync(
    async () => {
      calls += 1;
      if (calls === 1) return response([quoted("gold_melted_18", "2026-07-09", 100)]);
      return response([], [{ instrumentId: "gold_melted_18", dates: ["2026-07-09"], code: "network", message: "timeout" }]);
    },
    { now: () => now },
  );

  await sync({ ...baseRequest, refreshTodayInstrumentIds: [] }, fetch);
  now += 31 * 60 * 1000;
  const failedRefresh = await sync({ ...baseRequest, refreshTodayInstrumentIds: [] }, fetch);

  assert.equal(failedRefresh.records.length, 1);
  assert.equal(failedRefresh.records[0].priceToman, 100);
  assert.equal(failedRefresh.errors[0].message, "timeout");
});

test("fetches only missing or stale instrument dates", async () => {
  let now = 1_000;
  const calls = [];
  const sync = createCachedPriceSync(
    async (input) => {
      calls.push(input);
      return response(input.requests.flatMap((request) => request.dates.map((date) => quoted(request.instrumentId, date, date.endsWith("09") ? 100 : 200))));
    },
    { now: () => now },
  );

  await sync({ requests: [{ instrumentId: "gold_melted_18", dates: ["2026-07-09"] }], refreshTodayInstrumentIds: [], today: "2026-07-10" }, fetch);
  const mixed = await sync(
    { requests: [{ instrumentId: "gold_melted_18", dates: ["2026-07-09", "2026-07-08"] }], refreshTodayInstrumentIds: [], today: "2026-07-10" },
    fetch,
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].requests, [{ instrumentId: "gold_melted_18", dates: ["2026-07-08"] }]);
  assert.deepEqual(mixed.records.map((record) => record.date).sort(), ["2026-07-08", "2026-07-09"]);
});

test("adds cached USD records as references for crypto conversions", async () => {
  let now = 1_000;
  const calls = [];
  const sync = createCachedPriceSync(
    async (input) => {
      calls.push(input);
      if (input.requests.some((request) => request.instrumentId === "currency_usd")) {
        return response([quoted("currency_usd", "2026-07-09", 170_000)]);
      }
      return response([quoted("crypto_btc", "2026-07-09", 10_000_000)]);
    },
    { now: () => now },
  );

  await sync({ requests: [{ instrumentId: "currency_usd", dates: ["2026-07-09"] }], refreshTodayInstrumentIds: [], today: "2026-07-10" }, fetch);
  await sync({ requests: [{ instrumentId: "crypto_btc", dates: ["2026-07-09"] }], refreshTodayInstrumentIds: [], today: "2026-07-10" }, fetch);

  assert.deepEqual(calls[1].usdReferences, [{ date: "2026-07-09", priceToman: 170_000 }]);
});
