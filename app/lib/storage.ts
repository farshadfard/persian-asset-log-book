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

export type ImportedBackup = {
  exportedAt?: string;
  snapshot: PortfolioSnapshot;
  version?: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAssetCategory(value: unknown): value is AssetCategory {
  return value === "gold" || value === "silver" || value === "coin" || value === "currency" || value === "crypto";
}

function isAssetRecord(value: unknown): value is AssetRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isAssetCategory(value.category) &&
    typeof value.instrumentId === "string" &&
    typeof value.name === "string" &&
    typeof value.unit === "string" &&
    typeof value.createdAt === "string"
  );
}

function isTransactionRecord(value: unknown): value is TransactionRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.assetId === "string" &&
    (value.type === "buy" || value.type === "sell") &&
    typeof value.quantity === "number" &&
    Number.isFinite(value.quantity) &&
    typeof value.unitPrice === "number" &&
    Number.isFinite(value.unitPrice) &&
    typeof value.fee === "number" &&
    Number.isFinite(value.fee) &&
    typeof value.date === "string" &&
    (value.dateKey === undefined || typeof value.dateKey === "string") &&
    (value.note === undefined || typeof value.note === "string")
  );
}

function isDailyPriceRecord(value: unknown): value is DailyPriceRecord {
  return (
    isRecord(value) &&
    typeof value.instrumentId === "string" &&
    typeof value.name === "string" &&
    isAssetCategory(value.category) &&
    typeof value.date === "string" &&
    (value.status === "quoted" || value.status === "no_quote" || value.status === "manual" || value.status === "edited") &&
    (value.priceToman === undefined || (typeof value.priceToman === "number" && Number.isFinite(value.priceToman))) &&
    typeof value.fetchedAt === "string" &&
    (value.sourceUrl === undefined || typeof value.sourceUrl === "string") &&
    (value.rawValue === undefined || typeof value.rawValue === "string") &&
    (value.originalPriceToman === undefined || (typeof value.originalPriceToman === "number" && Number.isFinite(value.originalPriceToman))) &&
    (value.editedAt === undefined || typeof value.editedAt === "string") &&
    (value.note === undefined || typeof value.note === "string")
  );
}

function isLegacyPriceRecord(value: unknown): value is LegacyPriceRecord {
  return (
    isRecord(value) &&
    typeof value.instrumentId === "string" &&
    typeof value.name === "string" &&
    isAssetCategory(value.category) &&
    typeof value.priceToman === "number" &&
    Number.isFinite(value.priceToman) &&
    (value.source === "tgju" || value.source === "manual" || value.source === "cache") &&
    typeof value.fetchedAt === "string" &&
    (value.sourceUrl === undefined || typeof value.sourceUrl === "string") &&
    (value.rawValue === undefined || typeof value.rawValue === "string") &&
    (value.note === undefined || typeof value.note === "string")
  );
}

function requireRecordArray<T>(value: unknown, validator: (item: unknown) => item is T, name: string): T[] {
  if (!Array.isArray(value) || !value.every(validator)) throw new Error(`Invalid backup ${name}`);
  return value;
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

export function parseImportedBackup(input: string): ImportedBackup {
  const parsed = JSON.parse(input) as unknown;
  if (!isRecord(parsed)) throw new Error("Invalid backup file");

  const version = typeof parsed.version === "number" ? parsed.version : undefined;
  const exportedAt = typeof parsed.exportedAt === "string" ? parsed.exportedAt : undefined;
  const hasCurrentMarker = version !== undefined && exportedAt !== undefined;
  const hasLegacyMarker = Array.isArray(parsed.priceCache) || Array.isArray(parsed.manualPrices);
  if (!hasCurrentMarker && !hasLegacyMarker) throw new Error("Invalid backup file");

  const assets = requireRecordArray(parsed.assets, isAssetRecord, "assets");
  const transactions = requireRecordArray(parsed.transactions, isTransactionRecord, "transactions");
  const settings = isRecord(parsed.settings) ? parsed.settings : {};
  const dailyPrices = hasCurrentMarker
    ? requireRecordArray(parsed.dailyPrices, isDailyPriceRecord, "dailyPrices")
    : legacyToDaily([
        ...requireRecordArray(parsed.priceCache ?? [], isLegacyPriceRecord, "priceCache"),
        ...requireRecordArray(parsed.manualPrices ?? [], isLegacyPriceRecord, "manualPrices"),
      ]);

  return {
    exportedAt,
    snapshot: {
      ...emptySnapshot(),
      assets,
      transactions,
      dailyPrices: pruneDateWindow(dailyPrices),
      settings,
    },
    version,
  };
}

export function parseImportedSnapshot(input: string): PortfolioSnapshot {
  return parseImportedBackup(input).snapshot;
}
