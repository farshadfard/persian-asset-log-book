import type { DailyPriceRecord } from "../app/lib/portfolio";
import type { PriceSyncError, PriceSyncRequest, PriceSyncResponse } from "../app/lib/tgju";

export const PRICE_CACHE_TTL_MS = 30 * 60 * 1000;

type CachedPriceRecord = {
  record: DailyPriceRecord;
  cachedAtMs: number;
};

type PriceSyncFetcher = (input: PriceSyncRequest, fetcher: typeof fetch) => Promise<PriceSyncResponse>;

type PriceSyncCacheOptions = {
  ttlMs?: number;
  now?: () => number;
  cache?: Map<string, CachedPriceRecord>;
};

function cacheKey(instrumentId: string, date: string) {
  return `${instrumentId}:${date}`;
}

function isFresh(entry: CachedPriceRecord | undefined, nowMs: number, ttlMs: number) {
  return Boolean(entry && nowMs - entry.cachedAtMs < ttlMs);
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function requestedDayCount(input: PriceSyncRequest) {
  const historyCount = input.requests.reduce((sum, request) => sum + dedupe(request.dates).length, 0);
  return historyCount + dedupe(input.refreshTodayInstrumentIds).length;
}

function cachedUsdReferences(cache: Map<string, CachedPriceRecord>) {
  const references = new Map<string, number>();
  for (const entry of cache.values()) {
    const record = entry.record;
    if (record.instrumentId === "currency_usd" && record.status === "quoted" && record.priceToman) {
      references.set(record.date, record.priceToman);
    }
  }
  return [...references.entries()].map(([date, priceToman]) => ({ date, priceToman }));
}

function mergeUsdReferences(input: PriceSyncRequest, cache: Map<string, CachedPriceRecord>) {
  const references = new Map<string, number>();
  for (const reference of cachedUsdReferences(cache)) references.set(reference.date, reference.priceToman);
  for (const reference of input.usdReferences ?? []) references.set(reference.date, reference.priceToman);
  return [...references.entries()].map(([date, priceToman]) => ({ date, priceToman }));
}

function fallbackErrors(input: PriceSyncRequest, error: unknown): PriceSyncError[] {
  const message = error instanceof Error ? error.message : "TGJU sync failed";
  return input.requests
    .filter((request) => request.dates.length > 0)
    .map((request) => ({
      instrumentId: request.instrumentId,
      dates: request.dates,
      code: "network" as const,
      message,
    }));
}

export function createCachedPriceSync(fetchSync: PriceSyncFetcher, options: PriceSyncCacheOptions = {}) {
  const cache = options.cache ?? new Map<string, CachedPriceRecord>();
  const ttlMs = options.ttlMs ?? PRICE_CACHE_TTL_MS;
  const now = options.now ?? (() => Date.now());

  return async function cachedPriceSync(input: PriceSyncRequest, fetcher: typeof fetch): Promise<PriceSyncResponse> {
    const nowMs = now();
    const cachedRecords: DailyPriceRecord[] = [];
    const staleRecords = new Map<string, DailyPriceRecord>();
    const servedKeys = new Set<string>();
    const missingRequests: PriceSyncRequest["requests"] = [];
    const missingTodayInstrumentIds: string[] = [];

    for (const request of input.requests) {
      const missingDates: string[] = [];
      for (const date of dedupe(request.dates)) {
        const key = cacheKey(request.instrumentId, date);
        const entry = cache.get(key);
        if (isFresh(entry, nowMs, ttlMs)) {
          if (!servedKeys.has(key)) cachedRecords.push(entry!.record);
          servedKeys.add(key);
        } else {
          missingDates.push(date);
          if (entry) staleRecords.set(key, entry.record);
        }
      }
      if (missingDates.length > 0) missingRequests.push({ instrumentId: request.instrumentId, dates: missingDates });
    }

    for (const instrumentId of dedupe(input.refreshTodayInstrumentIds)) {
      const key = cacheKey(instrumentId, input.today);
      const entry = cache.get(key);
      if (isFresh(entry, nowMs, ttlMs)) {
        if (!servedKeys.has(key)) cachedRecords.push(entry!.record);
        servedKeys.add(key);
      } else {
        missingTodayInstrumentIds.push(instrumentId);
        if (entry) staleRecords.set(key, entry.record);
      }
    }

    const needsFetch = missingRequests.some((request) => request.dates.length > 0) || missingTodayInstrumentIds.length > 0;
    const fetchedAt = new Date(nowMs).toISOString();
    if (!needsFetch) {
      return {
        records: cachedRecords,
        errors: [],
        fetchedAt,
        requestedDayCount: requestedDayCount(input),
        successfulDayCount: cachedRecords.length,
      };
    }

    const fetchInput: PriceSyncRequest = {
      ...input,
      requests: missingRequests,
      refreshTodayInstrumentIds: missingTodayInstrumentIds,
      usdReferences: mergeUsdReferences(input, cache),
    };

    try {
      const response = await fetchSync(fetchInput, fetcher);
      const records = [...cachedRecords, ...response.records];
      const returnedKeys = new Set(response.records.map((record) => cacheKey(record.instrumentId, record.date)));
      const failedKeys = new Set(response.errors.flatMap((error) => error.dates.map((date) => cacheKey(error.instrumentId, date))));

      for (const record of response.records) {
        cache.set(cacheKey(record.instrumentId, record.date), { record, cachedAtMs: nowMs });
      }

      for (const [key, record] of staleRecords) {
        if (!returnedKeys.has(key) && failedKeys.has(key) && !servedKeys.has(key)) {
          records.push(record);
          servedKeys.add(key);
        }
      }

      return {
        ...response,
        records,
        requestedDayCount: requestedDayCount(input),
        successfulDayCount: records.length,
      };
    } catch (error) {
      const records = [...cachedRecords];
      for (const [key, record] of staleRecords) {
        if (!servedKeys.has(key)) {
          records.push(record);
          servedKeys.add(key);
        }
      }
      return {
        records,
        errors: fallbackErrors(fetchInput, error),
        fetchedAt,
        requestedDayCount: requestedDayCount(input),
        successfulDayCount: records.length,
      };
    }
  };
}
