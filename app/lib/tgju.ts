import { compressDateRanges, daysBetween, jalaliApiDate } from "./date";
import { instruments, type DailyPriceRecord, type InstrumentDefinition } from "./portfolio";

const TGJU_ORIGIN = "https://www.tgju.org";
const TGJU_API_ORIGIN = "https://api.tgju.org";
const REQUEST_TIMEOUT_MS = 12_000;

export type PriceSyncRequest = {
  requests: Array<{ instrumentId: string; dates: string[] }>;
  refreshTodayInstrumentIds: string[];
  today: string;
  usdReferences?: Array<{ date: string; priceToman: number }>;
};

export type PriceSyncError = {
  instrumentId: string;
  dates: string[];
  code: "network" | "invalid_response" | "pending" | "missing_reference" | "unsupported";
  message: string;
};

export type PriceSyncResponse = {
  records: DailyPriceRecord[];
  errors: PriceSyncError[];
  fetchedAt: string;
  requestedDayCount: number;
  successfulDayCount: number;
};

type RawHistoryPoint = {
  date: string;
  rawPrice: number;
  rawValue: string;
};

type HistoryPayload = {
  data?: unknown;
  recordsFiltered?: unknown;
  recordsTotal?: unknown;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&rlm;|&lrm;/g, " ")
    .replace(/\s+/g, " ");
}

export function toEnglishDigits(input: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)));
}

export function parseMarketNumber(raw: string): number | undefined {
  const normalized = toEnglishDigits(raw)
    .replace(/[٬,\s]/g, "")
    .replace(/[^\d.]/g, "");
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeApiDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = toEnglishDigits(value).replaceAll("/", "-");
  return isDateKey(normalized) ? normalized : undefined;
}

export function parseHistoryPayload(payload: unknown): RawHistoryPoint[] {
  if (!payload || typeof payload !== "object") throw new Error("TGJU history response is not an object");
  const data = (payload as HistoryPayload).data;
  if (!Array.isArray(data)) throw new Error("TGJU history data is missing");

  const rows: RawHistoryPoint[] = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 7) continue;
    const rawValue = String(row[3] ?? "");
    const rawPrice = parseMarketNumber(rawValue);
    const date = normalizeApiDate(row[6]);
    if (!rawPrice || !date) continue;
    rows.push({ date, rawPrice, rawValue });
  }
  if (data.length > 0 && rows.length === 0) throw new Error("TGJU history rows did not match the expected schema");
  return rows;
}

export function parseCurrentProfileHtml(html: string, instrument: InstrumentDefinition): { priceToman: number; rawValue: string } | undefined {
  const text = stripHtml(html);
  if (instrument.quoteCurrency === "USD") {
    const rialPrice = /قیمت ریالی\s*[:：]?\s*([۰-۹٠-٩\d][۰-۹٠-٩\d,٬.]{3,})/i.exec(text)?.[1];
    const value = rialPrice ? parseMarketNumber(rialPrice) : undefined;
    return value ? { priceToman: Math.round(value / 10), rawValue: rialPrice } : undefined;
  }

  const current = /(?:نرخ فعلی|قیمت فعلی|قیمت زنده|آخرین نرخ)\s*[:：]?\s*([۰-۹٠-٩\d][۰-۹٠-٩\d,٬.]{2,})/i.exec(text)?.[1];
  const value = current ? parseMarketNumber(current) : undefined;
  return value ? { priceToman: Math.round(value / 10), rawValue: current } : undefined;
}

function historyApiUrl(instrument: InstrumentDefinition, from: string, to: string): string {
  const slug = encodeURIComponent(instrument.tgjuSlug ?? "");
  const query = new URLSearchParams({
    lang: "fa",
    length: "100",
    start: "0",
    page: "1",
    search: "",
    order_col: "timestamp",
    order_dir: "desc",
    from: jalaliApiDate(from),
    to: jalaliApiDate(to),
    convert_to_ad: "1",
  });
  return `${TGJU_API_ORIGIN}/v1/market/indicator/summary-table-data/${slug}?${query}`;
}

function profileUrl(instrument: InstrumentDefinition): string {
  return `${TGJU_ORIGIN}/profile/${encodeURIComponent(instrument.tgjuSlug ?? "")}`;
}

async function fetchWithTimeout(fetcher: typeof fetch, url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(url, {
      headers: {
        accept,
        "user-agent": "Mozilla/5.0 persian-asset-log-book price fetcher",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHistoryRange(
  fetcher: typeof fetch,
  instrument: InstrumentDefinition,
  from: string,
  to: string,
): Promise<RawHistoryPoint[]> {
  const response = await fetchWithTimeout(fetcher, historyApiUrl(instrument, from, to), "application/json");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return parseHistoryPayload(await response.json());
}

async function fetchCurrentPrice(fetcher: typeof fetch, instrument: InstrumentDefinition): Promise<{ priceToman: number; rawValue: string }> {
  const response = await fetchWithTimeout(fetcher, profileUrl(instrument), "text/html,application/xhtml+xml");
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const parsed = parseCurrentProfileHtml(await response.text(), instrument);
  if (!parsed) throw new Error("TGJU current price did not match the expected schema");
  return parsed;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function makeQuotedRecord(
  instrument: InstrumentDefinition,
  date: string,
  priceToman: number,
  rawValue: string,
  fetchedAt: string,
  sourceUrl: string,
): DailyPriceRecord {
  return {
    instrumentId: instrument.id,
    name: instrument.name,
    category: instrument.category,
    date,
    status: "quoted",
    priceToman: Math.round(priceToman),
    fetchedAt,
    sourceUrl,
    rawValue,
  };
}

function latestReferenceAtOrBefore(references: Map<string, number>, date: string): number | undefined {
  return [...references.entries()]
    .filter(([referenceDate]) => referenceDate <= date)
    .sort(([a], [b]) => b.localeCompare(a))[0]?.[1];
}

function safeMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "مهلت دریافت از TGJU تمام شد";
  return error instanceof Error ? error.message : "خطای ناشناخته TGJU";
}

export async function fetchTgjuPriceSync(
  input: PriceSyncRequest,
  fetcher: typeof fetch = fetch,
): Promise<PriceSyncResponse> {
  if (!isDateKey(input.today)) throw new Error("Invalid local today date");
  const fetchedAt = new Date().toISOString();
  const errors: PriceSyncError[] = [];
  const records: DailyPriceRecord[] = [];
  const requestByInstrument = new Map<string, string[]>();

  for (const request of input.requests.slice(0, instruments.length)) {
    const instrument = instruments.find((item) => item.id === request.instrumentId && item.tgjuSlug);
    if (!instrument) {
      errors.push({ instrumentId: request.instrumentId, dates: request.dates, code: "unsupported", message: "بازار پشتیبانی نمی‌شود" });
      continue;
    }
    const dates = [...new Set(request.dates.filter(isDateKey))].filter((date) => date <= input.today).sort().slice(-90);
    requestByInstrument.set(instrument.id, dates);
  }

  const tasks = [...requestByInstrument.entries()].flatMap(([instrumentId, dates]) => {
    const instrument = instruments.find((item) => item.id === instrumentId)!;
    return compressDateRanges(dates.filter((date) => date !== input.today)).map((range) => ({ instrument, dates: dates.filter((date) => date >= range.from && date <= range.to && date !== input.today), ...range }));
  });

  const historyByInstrument = new Map<string, Map<string, RawHistoryPoint>>();
  await mapWithConcurrency(tasks, 4, async (task) => {
    try {
      const points = await fetchHistoryRange(fetcher, task.instrument, task.from, task.to);
      const market = historyByInstrument.get(task.instrument.id) ?? new Map<string, RawHistoryPoint>();
      for (const point of points) market.set(point.date, point);
      historyByInstrument.set(task.instrument.id, market);
    } catch (error) {
      errors.push({
        instrumentId: task.instrument.id,
        dates: task.dates,
        code: safeMessage(error).includes("schema") ? "invalid_response" : "network",
        message: safeMessage(error),
      });
    }
  });

  const references = new Map((input.usdReferences ?? []).filter((item) => isDateKey(item.date) && Number.isFinite(item.priceToman) && item.priceToman > 0).map((item) => [item.date, item.priceToman]));
  const usdHistory = historyByInstrument.get("currency_usd");
  if (usdHistory) {
    for (const [date, point] of usdHistory) references.set(date, Math.round(point.rawPrice / 10));
  }

  const failedKeys = new Set(errors.flatMap((error) => error.dates.map((date) => `${error.instrumentId}:${date}`)));
  for (const [instrumentId, dates] of requestByInstrument) {
    const instrument = instruments.find((item) => item.id === instrumentId)!;
    const market = historyByInstrument.get(instrumentId) ?? new Map<string, RawHistoryPoint>();
    for (const date of dates.filter((item) => item !== input.today)) {
      if (failedKeys.has(`${instrumentId}:${date}`)) continue;
      const point = market.get(date);
      if (point) {
        if (instrument.quoteCurrency === "USD") {
          const dollar = latestReferenceAtOrBefore(references, date);
          if (!dollar) {
            errors.push({ instrumentId, dates: [date], code: "missing_reference", message: "قیمت دلار این روز برای تبدیل رمزارز موجود نیست" });
            continue;
          }
          records.push(makeQuotedRecord(instrument, date, point.rawPrice * dollar, point.rawValue, fetchedAt, `${profileUrl(instrument)}/history`));
        } else {
          records.push(makeQuotedRecord(instrument, date, point.rawPrice / 10, point.rawValue, fetchedAt, `${profileUrl(instrument)}/history`));
        }
      } else if (daysBetween(date, input.today) >= 2) {
        records.push({
          instrumentId,
          name: instrument.name,
          category: instrument.category,
          date,
          status: "no_quote",
          fetchedAt,
          sourceUrl: `${profileUrl(instrument)}/history`,
        });
      } else {
        errors.push({ instrumentId, dates: [date], code: "pending", message: "قیمت پایانی این روز هنوز منتشر نشده است" });
      }
    }
  }

  const refreshInstruments = [...new Set(input.refreshTodayInstrumentIds)]
    .map((id) => instruments.find((item) => item.id === id && item.tgjuSlug))
    .filter((item): item is InstrumentDefinition => Boolean(item));
  await mapWithConcurrency(refreshInstruments, 4, async (instrument) => {
    try {
      const current = await fetchCurrentPrice(fetcher, instrument);
      records.push(makeQuotedRecord(instrument, input.today, current.priceToman, current.rawValue, fetchedAt, profileUrl(instrument)));
    } catch (error) {
      errors.push({
        instrumentId: instrument.id,
        dates: [input.today],
        code: safeMessage(error).includes("schema") ? "invalid_response" : "network",
        message: safeMessage(error),
      });
    }
  });

  const requestedDayCount = [...requestByInstrument.values()].reduce((sum, dates) => sum + dates.length, 0) + refreshInstruments.length;
  return {
    records,
    errors,
    fetchedAt,
    requestedDayCount,
    successfulDayCount: records.length,
  };
}
