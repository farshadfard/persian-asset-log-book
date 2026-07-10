import assert from "node:assert/strict";
import test from "node:test";
import { instruments } from "../app/lib/portfolio.ts";
import {
  fetchTgjuPriceSync,
  parseCurrentProfileHtml,
  parseHistoryPayload,
  parseMarketNumber,
  toEnglishDigits,
} from "../app/lib/tgju.ts";

test("normalizes Persian and Arabic digits", () => {
  assert.equal(toEnglishDigits("۱,۲۳۴ ٥٦"), "1,234 56");
  assert.equal(parseMarketNumber("۱۸۱٬۵۰۰٬۰۰۰"), 181_500_000);
});

test("parses TGJU history rows by Gregorian local date", () => {
  const rows = parseHistoryPayload({
    data: [
      ["", "", "", "۲۳۹٬۱۵۶٬۰۰۰", "", "", "2026/07/10", "1405/04/19"],
      ["", "", "", "238,000,000", "", "", "2026/07/09", "1405/04/18"],
    ],
  });

  assert.deepEqual(rows.map((row) => row.date), ["2026-07-10", "2026-07-09"]);
  assert.equal(rows[0].rawPrice, 239_156_000);
});

test("parses TGJU profile current price snippets as toman", () => {
  const gold = instruments.find((instrument) => instrument.id === "gold_melted_18");
  const btc = instruments.find((instrument) => instrument.id === "crypto_btc");
  assert.ok(gold);
  assert.ok(btc);

  const goldPrice = parseCurrentProfileHtml("<div>نرخ فعلی ۱۷٬۹۲۴٬۰۰۰</div>", gold);
  const btcPrice = parseCurrentProfileHtml("<div>قیمت ریالی: ۲٬۵۰۰٬۰۰۰٬۰۰۰</div>", btc);

  assert.equal(goldPrice?.priceToman, 1_792_400);
  assert.equal(btcPrice?.priceToman, 250_000_000);
});

test("sync converts IRR to toman, handles silver_999, and converts crypto USD by daily dollar", async () => {
  const seenUrls = [];
  const fetcher = async (url) => {
    seenUrls.push(String(url));
    if (String(url).includes("crypto-bitcoin")) {
      return Response.json({ data: [["", "", "", "63,269.04", "", "", "2026/07/09"]] });
    }
    if (String(url).includes("silver_999")) {
      return Response.json({ data: [["", "", "", "2,391,560", "", "", "2026/07/09"]] });
    }
    return Response.json({ data: [["", "", "", "1,700,000", "", "", "2026/07/09"]] });
  };

  const synced = await fetchTgjuPriceSync(
    {
      requests: [
        { instrumentId: "silver_999", dates: ["2026-07-09"] },
        { instrumentId: "crypto_btc", dates: ["2026-07-09"] },
      ],
      refreshTodayInstrumentIds: [],
      today: "2026-07-10",
      usdReferences: [{ date: "2026-07-09", priceToman: 170_000 }],
    },
    fetcher,
  );
  const silver = synced.records.find((record) => record.instrumentId === "silver_999");
  const btc = synced.records.find((record) => record.instrumentId === "crypto_btc");

  assert.ok(seenUrls.some((url) => url.includes("silver_999")));
  assert.equal(silver?.priceToman, 239_156);
  assert.equal(btc?.priceToman, Math.round(63_269.04 * 170_000));
  assert.equal(synced.errors.length, 0);
});

