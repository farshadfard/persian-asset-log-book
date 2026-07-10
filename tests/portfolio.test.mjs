import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMissingPriceRequests,
  computeAssetHistory,
  computePortfolio,
  mergeDailyPrices,
  parseLocalizedNumber,
} from "../app/lib/portfolio.ts";
import { exportSnapshot, parseImportedSnapshot } from "../app/lib/storage.ts";

const asset = {
  id: "asset_gold",
  category: "gold",
  instrumentId: "gold_melted_18",
  name: "طلای آب‌شده",
  unit: "گرم",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function snapshot(overrides = {}) {
  return {
    assets: [asset],
    transactions: [],
    dailyPrices: [],
    settings: {},
    ...overrides,
  };
}

test("computes average cost and carried daily price profit for stepped buys", () => {
  const summary = computePortfolio(
    snapshot({
      transactions: [
        { id: "t1", assetId: asset.id, type: "buy", quantity: 100, unitPrice: 6_000_000, fee: 0, date: "2026-01-01T00:00:00.000Z", dateKey: "2026-01-01" },
        { id: "t2", assetId: asset.id, type: "buy", quantity: 50, unitPrice: 8_000_000, fee: 0, date: "2026-02-01T00:00:00.000Z", dateKey: "2026-02-01" },
      ],
      dailyPrices: [
        { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-02-28", status: "quoted", priceToman: 10_000_000, fetchedAt: "2026-03-01T00:00:00.000Z" },
        { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-03-01", status: "no_quote", fetchedAt: "2026-03-01T00:00:00.000Z" },
      ],
    }),
    "2026-03-01",
  );

  assert.equal(summary.holdings[0].quantity, 150);
  assert.equal(summary.holdings[0].averageCost, 6_666_666.666666667);
  assert.equal(summary.totalValue, 1_500_000_000);
  assert.equal(summary.unrealizedProfit, 500_000_000);
  assert.equal(summary.carriedPriceCount, 1);
});

test("computes realized profit for partial sells without artificial daily jump", () => {
  const data = snapshot({
    transactions: [
      { id: "t1", assetId: asset.id, type: "buy", quantity: 10, unitPrice: 100, fee: 0, date: "2026-01-01T00:00:00.000Z", dateKey: "2026-01-01" },
      { id: "t2", assetId: asset.id, type: "sell", quantity: 4, unitPrice: 150, fee: 10, date: "2026-02-02T00:00:00.000Z", dateKey: "2026-02-02" },
    ],
    dailyPrices: [
      { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-02-01", status: "quoted", priceToman: 140, fetchedAt: "2026-02-01T12:00:00.000Z" },
      { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-02-02", status: "quoted", priceToman: 140, fetchedAt: "2026-02-02T12:00:00.000Z" },
    ],
  });

  const summary = computePortfolio(data, "2026-02-02");
  const history = computeAssetHistory(data, asset.id, "2026-02-01", "2026-02-02");

  assert.equal(summary.holdings[0].quantity, 6);
  assert.equal(summary.realizedProfit, 190);
  assert.equal(summary.unrealizedProfit, 240);
  assert.equal(history.at(-1)?.dailyProfit, 30);
  assert.equal(Math.round((history.at(-1)?.dailyProfitPercent ?? 0) * 10) / 10, 2.1);
});

test("requests only missing dates and treats no_quote as stored data", () => {
  const requests = buildMissingPriceRequests(
    [
      { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-07-09", status: "no_quote", fetchedAt: "2026-07-09T12:00:00.000Z" },
      { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-07-10", status: "quoted", priceToman: 10, fetchedAt: "2026-07-10T12:00:00.000Z" },
    ],
    "2026-07-10",
  );
  const gold = requests.find((request) => request.instrumentId === "gold_melted_18");

  assert.ok(gold);
  assert.equal(gold.dates.includes("2026-07-09"), false);
  assert.equal(gold.dates.includes("2026-07-10"), false);
  assert.equal(gold.dates.includes("2026-07-08"), true);
});

test("preserves manual and edited prices during TGJU sync", () => {
  const merged = mergeDailyPrices(
    [
      { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-07-10", status: "edited", priceToman: 12, originalPriceToman: 10, fetchedAt: "2026-07-10T10:00:00.000Z" },
      { instrumentId: "currency_usd", name: "دلار آمریکا", category: "currency", date: "2026-07-10", status: "manual", priceToman: 170_000, fetchedAt: "2026-07-10T10:00:00.000Z" },
    ],
    [
      { instrumentId: "gold_melted_18", name: asset.name, category: "gold", date: "2026-07-10", status: "quoted", priceToman: 20, fetchedAt: "2026-07-10T11:00:00.000Z" },
      { instrumentId: "currency_usd", name: "دلار آمریکا", category: "currency", date: "2026-07-10", status: "quoted", priceToman: 180_000, fetchedAt: "2026-07-10T11:00:00.000Z" },
    ],
    "2026-07-10",
  );

  assert.equal(merged.find((item) => item.instrumentId === "gold_melted_18")?.priceToman, 12);
  assert.equal(merged.find((item) => item.instrumentId === "currency_usd")?.priceToman, 170_000);
});

test("imports legacy backups into daily prices and exports v2 history", () => {
  const imported = parseImportedSnapshot(JSON.stringify({
    assets: [asset],
    transactions: [],
    priceCache: [{ instrumentId: "gold_melted_18", name: asset.name, category: "gold", priceToman: 120, source: "tgju", fetchedAt: "2026-07-10T12:00:00.000Z" }],
    manualPrices: [{ instrumentId: "currency_usd", name: "دلار آمریکا", category: "currency", priceToman: 170_000, source: "manual", fetchedAt: "2026-07-10T12:00:00.000Z" }],
    settings: {},
  }));
  const exported = JSON.parse(exportSnapshot(imported));

  assert.equal(imported.dailyPrices.length, 2);
  assert.equal(imported.dailyPrices.find((item) => item.instrumentId === "currency_usd")?.status, "manual");
  assert.equal(exported.version, 2);
  assert.equal(Array.isArray(exported.dailyPrices), true);
  assert.equal("priceCache" in exported, false);
});

test("parses Persian decimal and thousands separators", () => {
  assert.equal(parseLocalizedNumber("۱۴۷٫۸"), 147.8);
  assert.equal(parseLocalizedNumber("۱٬۰۰۰٬۰۰۰٫۵"), 1_000_000.5);
});
