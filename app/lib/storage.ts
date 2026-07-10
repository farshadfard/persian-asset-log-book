"use client";

import { localDateKey, pruneDateWindow } from "./date";
import {
  emptySnapshot,
  instruments,
  type AssetCategory,
  type AssetRecord,
  type DailyPriceRecord,
  type PortfolioSnapshot,
  type TransactionRecord,
} from "./portfolio";

const DB_NAME = "persian-asset-log";
export const DB_VERSION = 2;
const ACTIVE_STORES = ["assets", "transactions", "dailyPrices", "settings"] as const;
type ActiveStoreName = (typeof ACTIVE_STORES)[number];

type StoreRecord = AssetRecord | TransactionRecord | DailyPriceRecord | { id: string; value: unknown };

type LegacyPriceRecord = {
  instrumentId: string;
  name: string;
  category: AssetCategory;
  priceToman: number;
  source: "tgju" | "manual" | "cache";
  sourceUrl?: string;
  rawValue?: string;
  fetchedAt: string;
  note?: string;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openPortfolioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("transactions")) db.createObjectStore("transactions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("dailyPrices")) {
        const prices = db.createObjectStore("dailyPrices", { keyPath: ["instrumentId", "date"] });
        prices.createIndex("by-date", "date");
        prices.createIndex("by-instrument", "instrumentId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  if (!db.objectStoreNames.contains(storeName)) return [];
  const transaction = db.transaction(storeName, "readonly");
  return requestToPromise<T[]>(transaction.objectStore(storeName).getAll());
}

function legacyToDaily(records: LegacyPriceRecord[]): DailyPriceRecord[] {
  const mapped = new Map<string, DailyPriceRecord>();
  for (const price of records) {
    if (!Number.isFinite(price.priceToman) || price.priceToman <= 0) continue;
    const instrument = instruments.find((item) => item.id === price.instrumentId);
    const date = localDateKey(new Date(price.fetchedAt));
    const record: DailyPriceRecord = {
      instrumentId: price.instrumentId,
      name: price.name || instrument?.name || price.instrumentId,
      category: price.category || instrument?.category || "currency",
      date,
      status: price.source === "manual" ? "manual" : "quoted",
      priceToman: price.priceToman,
      fetchedAt: price.fetchedAt,
      sourceUrl: price.sourceUrl,
      rawValue: price.rawValue,
      note: price.note,
    };
    const key = `${record.instrumentId}:${record.date}`;
    const previous = mapped.get(key);
    if (!previous || record.status === "manual" || record.fetchedAt > previous.fetchedAt) mapped.set(key, record);
  }
  return pruneDateWindow([...mapped.values()]);
}

export async function loadSnapshot(): Promise<PortfolioSnapshot> {
  const db = await openPortfolioDb();
  try {
    const [assets, transactions, dailyPrices, settingsRows] = await Promise.all([
      readAll<AssetRecord>(db, "assets"),
      readAll<TransactionRecord>(db, "transactions"),
      readAll<DailyPriceRecord>(db, "dailyPrices"),
      readAll<{ id: string; value: unknown }>(db, "settings"),
    ]);

    let migratedPrices = dailyPrices;
    if (migratedPrices.length === 0) {
      const [legacyCache, legacyManual] = await Promise.all([
        readAll<LegacyPriceRecord>(db, "priceCache"),
        readAll<LegacyPriceRecord>(db, "manualPrices"),
      ]);
      migratedPrices = legacyToDaily([...legacyCache, ...legacyManual]);
    }

    return {
      assets,
      transactions,
      dailyPrices: pruneDateWindow(migratedPrices),
      settings: Object.fromEntries(settingsRows.map((row) => [row.id, row.value])),
    };
  } finally {
    db.close();
  }
}

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  const db = await openPortfolioDb();
  try {
    const transaction = db.transaction([...ACTIVE_STORES], "readwrite");
    const records: Record<ActiveStoreName, StoreRecord[]> = {
      assets: snapshot.assets,
      transactions: snapshot.transactions,
      dailyPrices: pruneDateWindow(snapshot.dailyPrices),
      settings: Object.entries(snapshot.settings).map(([id, value]) => ({ id, value })),
    };
    for (const storeName of ACTIVE_STORES) {
      const store = transaction.objectStore(storeName);
      store.clear();
      for (const record of records[storeName]) store.put(record);
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function exportSnapshot(snapshot: PortfolioSnapshot): string {
  return JSON.stringify(
    {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      ...snapshot,
      dailyPrices: pruneDateWindow(snapshot.dailyPrices),
    },
    null,
    2,
  );
}

export function parseImportedSnapshot(input: string): PortfolioSnapshot {
  const parsed = JSON.parse(input) as Partial<PortfolioSnapshot> & {
    version?: number;
    priceCache?: LegacyPriceRecord[];
    manualPrices?: LegacyPriceRecord[];
  };
  const dailyPrices = Array.isArray(parsed.dailyPrices)
    ? parsed.dailyPrices
    : legacyToDaily([
        ...(Array.isArray(parsed.priceCache) ? parsed.priceCache : []),
        ...(Array.isArray(parsed.manualPrices) ? parsed.manualPrices : []),
      ]);
  return {
    ...emptySnapshot(),
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    dailyPrices: pruneDateWindow(dailyPrices),
    settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
  };
}
