import {
  addLocalDays,
  localDateKey,
  localDateRange,
  pruneDateWindow,
  retentionStart,
  transactionDateKey,
} from "./date";

export type AssetCategory = "gold" | "silver" | "coin" | "currency" | "crypto";
export type TransactionType = "buy" | "sell";
export type DailyPriceStatus = "quoted" | "no_quote" | "manual" | "edited";

export type AssetRecord = {
  id: string;
  category: AssetCategory;
  instrumentId: string;
  name: string;
  unit: string;
  createdAt: string;
};

export type TransactionRecord = {
  id: string;
  assetId: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fee: number;
  date: string;
  dateKey?: string;
  note?: string;
};

export type DailyPriceRecord = {
  instrumentId: string;
  name: string;
  category: AssetCategory;
  date: string;
  status: DailyPriceStatus;
  priceToman?: number;
  fetchedAt: string;
  sourceUrl?: string;
  rawValue?: string;
  originalPriceToman?: number;
  editedAt?: string;
  note?: string;
};

export type PortfolioSnapshot = {
  assets: AssetRecord[];
  transactions: TransactionRecord[];
  dailyPrices: DailyPriceRecord[];
  settings: Record<string, unknown>;
};

export type InstrumentDefinition = {
  id: string;
  name: string;
  category: AssetCategory;
  unit: string;
  tgjuSlug?: string;
  quoteCurrency: "IRR" | "USD";
};

export const instruments: InstrumentDefinition[] = [
  { id: "gold_melted_18", name: "طلای آب‌شده ۱۸ عیار", category: "gold", unit: "گرم", tgjuSlug: "geram18", quoteCurrency: "IRR" },
  { id: "gold_24", name: "طلای ۲۴ عیار", category: "gold", unit: "گرم", tgjuSlug: "geram24", quoteCurrency: "IRR" },
  { id: "silver_999", name: "نقره ۹۹۹", category: "silver", unit: "گرم", tgjuSlug: "silver_999", quoteCurrency: "IRR" },
  { id: "coin_emami", name: "سکه امامی", category: "coin", unit: "عدد", tgjuSlug: "sekee", quoteCurrency: "IRR" },
  { id: "coin_bahar", name: "سکه بهار آزادی", category: "coin", unit: "عدد", tgjuSlug: "sekeb", quoteCurrency: "IRR" },
  { id: "coin_half", name: "نیم‌سکه", category: "coin", unit: "عدد", tgjuSlug: "nim", quoteCurrency: "IRR" },
  { id: "coin_quarter", name: "ربع‌سکه", category: "coin", unit: "عدد", tgjuSlug: "rob", quoteCurrency: "IRR" },
  { id: "coin_gram", name: "سکه گرمی", category: "coin", unit: "عدد", tgjuSlug: "gerami", quoteCurrency: "IRR" },
  { id: "coin_parsian", name: "سکه پارسیان یک گرمی", category: "coin", unit: "عدد", tgjuSlug: "سکه-پارسیان-۱-۰۰۰", quoteCurrency: "IRR" },
  { id: "currency_usd", name: "دلار آمریکا", category: "currency", unit: "دلار", tgjuSlug: "price_dollar_rl", quoteCurrency: "IRR" },
  { id: "currency_eur", name: "یورو", category: "currency", unit: "یورو", tgjuSlug: "price_eur", quoteCurrency: "IRR" },
  { id: "currency_gbp", name: "پوند انگلیس", category: "currency", unit: "پوند", tgjuSlug: "price_gbp", quoteCurrency: "IRR" },
  { id: "currency_aed", name: "درهم امارات", category: "currency", unit: "درهم", tgjuSlug: "price_aed", quoteCurrency: "IRR" },
  { id: "crypto_usdt", name: "تتر", category: "crypto", unit: "USDT", tgjuSlug: "crypto-tether", quoteCurrency: "USD" },
  { id: "crypto_btc", name: "بیت‌کوین", category: "crypto", unit: "BTC", tgjuSlug: "crypto-bitcoin", quoteCurrency: "USD" },
  { id: "crypto_eth", name: "اتریوم", category: "crypto", unit: "ETH", tgjuSlug: "crypto-ethereum", quoteCurrency: "USD" },
];

export type ResolvedDailyPrice = {
  record: DailyPriceRecord;
  priceToman: number;
  date: string;
  carried: boolean;
};

export type HoldingSummary = {
  asset: AssetRecord;
  quantity: number;
  averageCost: number;
  invested: number;
  realizedProfit: number;
  currentPrice?: ResolvedDailyPrice;
  currentValue: number;
  unrealizedProfit: number;
  unrealizedPercent: number;
  totalProfit: number;
  totalProfitPercent: number;
};

export type PortfolioSummary = {
  holdings: HoldingSummary[];
  totalValue: number;
  totalInvested: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  totalProfitPercent: number;
  carriedPriceCount: number;
  missingPriceCount: number;
  hasCompletePrices: boolean;
};

export type AssetHistoryPoint = {
  date: string;
  priceDate?: string;
  priceToman: number | null;
  currentValue: number | null;
  invested: number;
  totalProfit: number | null;
  dailyProfit: number | null;
  dailyProfitPercent: number | null;
  carried: boolean;
  status?: DailyPriceStatus;
};

export type PortfolioHistoryPoint = {
  date: string;
  totalValue: number | null;
  totalProfit: number | null;
  dailyProfit: number | null;
  dailyProfitPercent: number | null;
  hasCompletePrices: boolean;
};

export function normalizeDigits(input: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/٬/g, "")
    .replace(/٫/g, ".")
    .replace(/,/g, "")
    .trim();
}

export function parseLocalizedNumber(input: string): number {
  const normalized = normalizeDigits(input);
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function formatToman(value: number): string {
  return `${Math.round(value).toLocaleString("fa-IR")} تومان`;
}

export function formatNumber(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString("fa-IR", { maximumFractionDigits });
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
}

export function isPricedRecord(record: DailyPriceRecord): boolean {
  return record.status !== "no_quote" && Number.isFinite(record.priceToman) && (record.priceToman ?? 0) > 0;
}

export function resolveDailyPrice(
  instrumentId: string,
  dailyPrices: DailyPriceRecord[],
  targetDate = localDateKey(),
): ResolvedDailyPrice | undefined {
  const candidate = dailyPrices
    .filter((price) => price.instrumentId === instrumentId && price.date <= targetDate && isPricedRecord(price))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!candidate?.priceToman) return undefined;
  return {
    record: candidate,
    priceToman: candidate.priceToman,
    date: candidate.date,
    carried: candidate.date !== targetDate,
  };
}

function computeHolding(snapshot: PortfolioSnapshot, asset: AssetRecord, asOfDate: string): HoldingSummary {
  const assetTransactions = snapshot.transactions
    .filter((transaction) => transaction.assetId === asset.id && transactionDateKey(transaction) <= asOfDate)
    .sort((a, b) => transactionDateKey(a).localeCompare(transactionDateKey(b)) || a.date.localeCompare(b.date));

  let quantity = 0;
  let invested = 0;
  let realizedProfit = 0;

  for (const transaction of assetTransactions) {
    if (transaction.type === "buy") {
      quantity += transaction.quantity;
      invested += transaction.quantity * transaction.unitPrice + transaction.fee;
      continue;
    }
    const soldQuantity = Math.min(transaction.quantity, quantity);
    const averageCost = quantity > 0 ? invested / quantity : 0;
    const soldCost = soldQuantity * averageCost;
    const proceeds = soldQuantity * transaction.unitPrice - transaction.fee;
    realizedProfit += proceeds - soldCost;
    quantity = Math.max(0, quantity - soldQuantity);
    invested = Math.max(0, invested - soldCost);
  }

  const currentPrice = resolveDailyPrice(asset.instrumentId, snapshot.dailyPrices, asOfDate);
  const currentValue = currentPrice ? quantity * currentPrice.priceToman : 0;
  const averageCost = quantity > 0 ? invested / quantity : 0;
  const unrealizedProfit = currentPrice ? currentValue - invested : 0;
  const unrealizedPercent = invested > 0 && currentPrice ? (unrealizedProfit / invested) * 100 : 0;
  const totalProfit = realizedProfit + unrealizedProfit;
  const totalProfitPercent = invested > 0 ? (totalProfit / invested) * 100 : 0;

  return {
    asset,
    quantity,
    averageCost,
    invested,
    realizedProfit,
    currentPrice,
    currentValue,
    unrealizedProfit,
    unrealizedPercent,
    totalProfit,
    totalProfitPercent,
  };
}

export function computePortfolio(snapshot: PortfolioSnapshot, asOfDate = localDateKey()): PortfolioSummary {
  const holdings = snapshot.assets.map((asset) => computeHolding(snapshot, asset, asOfDate));
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalInvested = holdings.reduce((sum, holding) => sum + holding.invested, 0);
  const realizedProfit = holdings.reduce((sum, holding) => sum + holding.realizedProfit, 0);
  const unrealizedProfit = holdings.reduce((sum, holding) => sum + holding.unrealizedProfit, 0);
  const totalProfit = realizedProfit + unrealizedProfit;
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const carriedPriceCount = holdings.filter((holding) => holding.quantity > 0 && holding.currentPrice?.carried).length;
  const missingPriceCount = holdings.filter((holding) => holding.quantity > 0 && !holding.currentPrice).length;

  return {
    holdings,
    totalValue,
    totalInvested,
    realizedProfit,
    unrealizedProfit,
    totalProfit,
    totalProfitPercent,
    carriedPriceCount,
    missingPriceCount,
    hasCompletePrices: missingPriceCount === 0,
  };
}

export function computeAssetHistory(
  snapshot: PortfolioSnapshot,
  assetId: string,
  from: string,
  to: string,
): AssetHistoryPoint[] {
  const asset = snapshot.assets.find((item) => item.id === assetId);
  if (!asset) return [];
  const calculationDates = localDateRange(addLocalDays(from, -1), to);
  const positions = calculationDates.map((date) => ({ date, holding: computeHolding(snapshot, asset, date) }));

  return positions.slice(1).map((item, index) => {
    const previous = positions[index].holding;
    const currentAvailable = item.holding.quantity === 0 || Boolean(item.holding.currentPrice);
    const previousAvailable = previous.quantity === 0 || Boolean(previous.currentPrice);
    const currentProfit = currentAvailable ? item.holding.totalProfit : null;
    const previousProfit = previousAvailable ? previous.totalProfit : null;
    const dailyProfit = currentProfit !== null && previousProfit !== null ? currentProfit - previousProfit : null;
    const previousEndValue = previous.currentValue + previous.realizedProfit;
    const dailyProfitPercent = dailyProfit !== null && previousEndValue > 0 ? (dailyProfit / previousEndValue) * 100 : null;
    return {
      date: item.date,
      priceDate: item.holding.currentPrice?.date,
      priceToman: item.holding.currentPrice?.priceToman ?? null,
      currentValue: currentAvailable ? item.holding.currentValue : null,
      invested: item.holding.invested,
      totalProfit: currentProfit,
      dailyProfit,
      dailyProfitPercent,
      carried: item.holding.currentPrice?.carried ?? false,
      status: item.holding.currentPrice?.record.status,
    };
  });
}

export function computePortfolioHistory(
  snapshot: PortfolioSnapshot,
  from: string,
  to: string,
): PortfolioHistoryPoint[] {
  const calculationDates = localDateRange(addLocalDays(from, -1), to);
  const summaries = calculationDates.map((date) => ({ date, summary: computePortfolio(snapshot, date) }));
  return summaries.slice(1).map((item, index) => {
    const previous = summaries[index].summary;
    const currentProfit = item.summary.hasCompletePrices ? item.summary.totalProfit : null;
    const previousProfit = previous.hasCompletePrices ? previous.totalProfit : null;
    const dailyProfit = currentProfit !== null && previousProfit !== null ? currentProfit - previousProfit : null;
    const previousEndValue = previous.totalValue + previous.realizedProfit;
    const dailyProfitPercent = dailyProfit !== null && previousEndValue > 0 ? (dailyProfit / previousEndValue) * 100 : null;
    return {
      date: item.date,
      totalValue: item.summary.hasCompletePrices ? item.summary.totalValue : null,
      totalProfit: currentProfit,
      dailyProfit,
      dailyProfitPercent,
      hasCompletePrices: item.summary.hasCompletePrices,
    };
  });
}

export function buildMissingPriceRequests(
  dailyPrices: DailyPriceRecord[],
  today = localDateKey(),
): Array<{ instrumentId: string; dates: string[] }> {
  const dates = localDateRange(retentionStart(today), today);
  const existing = new Set(dailyPrices.map((price) => `${price.instrumentId}:${price.date}`));
  return instruments.map((instrument) => ({
    instrumentId: instrument.id,
    dates: dates.filter((date) => !existing.has(`${instrument.id}:${date}`)),
  }));
}

export function mergeDailyPrices(
  current: DailyPriceRecord[],
  incoming: DailyPriceRecord[],
  today = localDateKey(),
): DailyPriceRecord[] {
  const records = new Map(current.map((record) => [`${record.instrumentId}:${record.date}`, record]));
  for (const record of incoming) {
    const key = `${record.instrumentId}:${record.date}`;
    const previous = records.get(key);
    if (previous?.status === "manual" || previous?.status === "edited") continue;
    if (!previous || record.date === today || previous.status === "no_quote") records.set(key, record);
  }
  return pruneDateWindow([...records.values()], today).sort((a, b) => a.date.localeCompare(b.date) || a.instrumentId.localeCompare(b.instrumentId));
}

export function emptySnapshot(): PortfolioSnapshot {
  return {
    assets: [],
    transactions: [],
    dailyPrices: [],
    settings: {},
  };
}
