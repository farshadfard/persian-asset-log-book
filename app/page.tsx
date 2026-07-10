"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Tabs from "@radix-ui/react-tabs";
import * as Toast from "@radix-ui/react-toast";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import {
  computePortfolio,
  emptySnapshot,
  formatNumber,
  formatPercent,
  formatToman,
  instruments,
  parseLocalizedNumber,
  type AssetCategory,
  type AssetRecord,
  type ManualPriceRecord,
  type PortfolioSnapshot,
  type PriceRecord,
  type TransactionRecord,
  type TransactionType,
} from "./lib/portfolio";
import { exportSnapshot, loadSnapshot, parseImportedSnapshot, saveSnapshot } from "./lib/storage";

const categoryLabels: Record<AssetCategory, string> = {
  gold: "طلا",
  silver: "نقره",
  coin: "سکه",
  currency: "ارز کاغذی",
  crypto: "رمزارز",
};

type View = "dashboard" | "assets" | "add" | "prices" | "settings";
type ThemePreference = "auto" | "light" | "dark";
type PriceTab = "online" | "manual";
const NEW_ASSET_VALUE = "__new_asset__";
const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: "خودکار", value: "auto" },
  { label: "روشن", value: "light" },
  { label: "تیره", value: "dark" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}

type IconName =
  | "activity"
  | "archive"
  | "banknote"
  | "chart"
  | "check"
  | "chevron"
  | "coins"
  | "download"
  | "edit"
  | "gem"
  | "home"
  | "plus"
  | "refresh"
  | "settings"
  | "upload"
  | "wallet"
  | "x";

type IconProps = { className?: string; name: IconName; size?: number };

function Icon({ className, name, size = 18 }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  const paths: Record<IconName, React.ReactNode> = {
    activity: <path {...common} d="M3 12h4l2-6 4 12 2-6h6" />,
    archive: (
      <>
        <path {...common} d="M4 7h16" />
        <path {...common} d="M6 7v12h12V7" />
        <path {...common} d="M9 11h6" />
      </>
    ),
    banknote: (
      <>
        <rect {...common} x="3" y="6" width="18" height="12" rx="2" />
        <circle {...common} cx="12" cy="12" r="2.5" />
        <path {...common} d="M6 9h1M17 15h1" />
      </>
    ),
    chart: (
      <>
        <path {...common} d="M4 19V5" />
        <path {...common} d="M4 19h16" />
        <path {...common} d="M8 16v-5M12 16V8M16 16v-8" />
      </>
    ),
    check: <path {...common} d="m5 12 4 4L19 6" />,
    chevron: <path {...common} d="m6 9 6 6 6-6" />,
    coins: (
      <>
        <ellipse {...common} cx="12" cy="7" rx="6" ry="3" />
        <path {...common} d="M6 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
        <path {...common} d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
      </>
    ),
    download: (
      <>
        <path {...common} d="M12 4v10" />
        <path {...common} d="m8 10 4 4 4-4" />
        <path {...common} d="M5 20h14" />
      </>
    ),
    edit: (
      <>
        <path {...common} d="M12 20h9" />
        <path {...common} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    gem: (
      <>
        <path {...common} d="M6 4h12l4 6-10 10L2 10z" />
        <path {...common} d="M2 10h20M8 4l-2 6 6 10 6-10-2-6" />
      </>
    ),
    home: (
      <>
        <path {...common} d="M3 11 12 4l9 7" />
        <path {...common} d="M6 10v10h12V10" />
        <path {...common} d="M10 20v-6h4v6" />
      </>
    ),
    plus: <path {...common} d="M12 5v14M5 12h14" />,
    refresh: (
      <>
        <path {...common} d="M20 6v6h-6" />
        <path {...common} d="M4 18v-6h6" />
        <path {...common} d="M18 9a7 7 0 0 0-11.5-2.5L4 9" />
        <path {...common} d="M6 15a7 7 0 0 0 11.5 2.5L20 15" />
      </>
    ),
    settings: (
      <>
        <circle {...common} cx="12" cy="12" r="3" />
        <path {...common} d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
      </>
    ),
    upload: (
      <>
        <path {...common} d="M12 20V10" />
        <path {...common} d="m8 14 4-4 4 4" />
        <path {...common} d="M5 4h14" />
      </>
    ),
    wallet: (
      <>
        <path {...common} d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" />
        <path {...common} d="M16 13h5" />
      </>
    ),
    x: <path {...common} d="M6 6l12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      className={cn("inline-block shrink-0", className)}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

function makeIcon(name: IconName) {
  return function LocalIcon({ className, size = 18 }: Omit<IconProps, "name">) {
    return (
      <Icon className={className} name={name} size={size} />
    );
  };
}

const IconActivity = makeIcon("activity");
const IconArchiveRestore = makeIcon("archive");
const IconBanknote = makeIcon("banknote");
const IconBarChart = makeIcon("chart");
const IconCheck = makeIcon("check");
const IconChevronDown = makeIcon("chevron");
const IconCoins = makeIcon("coins");
const IconDownload = makeIcon("download");
const IconEdit = makeIcon("edit");
const IconGem = makeIcon("gem");
const IconHome = makeIcon("home");
const IconPlus = makeIcon("plus");
const IconRefresh = makeIcon("refresh");
const IconSettings = makeIcon("settings");
const IconUpload = makeIcon("upload");
const IconWallet = makeIcon("wallet");
const IconX = makeIcon("x");

const categoryIcons: Record<AssetCategory, ReturnType<typeof makeIcon>> = {
  gold: IconGem,
  silver: IconActivity,
  coin: IconCoins,
  currency: IconBanknote,
  crypto: IconWallet,
};

const onboardingItems: Array<{ description: string; imageSrc: string; title: string }> = [
  {
    description: "ثبت و پیگیری دارایی‌ها همیشه بدون پرداخت و اشتراک می‌ماند.",
    imageSrc: "/onboarding-free.webp",
    title: "همیشه رایگان",
  },
  {
    description: "داده‌های مالی شما فقط روی همین دستگاه ذخیره می‌شود.",
    imageSrc: "/onboarding-privacy.webp",
    title: "حریم خصوصی داده‌ها",
  },
  {
    description: "دارایی را سریع ثبت کنید و سود امروز را بی‌دردسر ببینید.",
    imageSrc: "/onboarding-easy.webp",
    title: "استفاده آسان",
  },
];

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type JalaliDate = { jd: number; jm: number; jy: number };

const jalaliMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const jalaliWeekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + gDaysInMonth[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jd, jm, jy };
}

function isGregorianLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const monthDays = [0, 31, isGregorianLeap(gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  while (gm <= 12 && gd > monthDays[gm]) {
    gd -= monthDays[gm];
    gm++;
  }
  return { gd, gm, gy };
}

function isoToJalali(iso: string): JalaliDate {
  const [gy, gm, gd] = iso.split("-").map(Number);
  return gregorianToJalali(gy, gm, gd);
}

function jalaliToIso(jy: number, jm: number, jd: number) {
  const { gd, gm, gy } = jalaliToGregorian(jy, jm, jd);
  return `${gy.toString().padStart(4, "0")}-${gm.toString().padStart(2, "0")}-${gd.toString().padStart(2, "0")}`;
}

function isJalaliLeap(jy: number) {
  const start = new Date(`${jalaliToIso(jy, 1, 1)}T00:00:00Z`).getTime();
  const next = new Date(`${jalaliToIso(jy + 1, 1, 1)}T00:00:00Z`).getTime();
  return Math.round((next - start) / 86_400_000) === 366;
}

function daysInJalaliMonth(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

function firstDayOffset(jy: number, jm: number) {
  const date = new Date(`${jalaliToIso(jy, jm, 1)}T00:00:00Z`);
  return (date.getUTCDay() + 1) % 7;
}

function formatJalaliDate(iso: string) {
  const { jd, jm, jy } = isoToJalali(iso);
  return `${jy.toLocaleString("fa-IR", { useGrouping: false })}/${jm.toLocaleString("fa-IR", { minimumIntegerDigits: 2, useGrouping: false })}/${jd.toLocaleString("fa-IR", { minimumIntegerDigits: 2, useGrouping: false })}`;
}

function faDate(value?: string) {
  if (!value) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(value));
}

function faDateTime(value?: string) {
  if (!value) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}

function getBooleanSetting(value: unknown): boolean {
  return value === true;
}

function formatPriceInput(value: string) {
  const digits = value.replace(/[^\d۰-۹٠-٩]/g, "");
  if (!digits) return "";
  const parsed = parseLocalizedNumber(digits);
  return Number.isFinite(parsed) ? Math.trunc(parsed).toLocaleString("fa-IR") : "";
}

function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-[var(--primary)] text-white shadow-sm shadow-emerald-950/10 hover:bg-[var(--primary-strong)]",
        variant === "secondary" && "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "ghost" && "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm", className)}>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-[var(--foreground)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-11 min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
      {...props}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="min-h-24 min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
      {...props}
    />
  );
}

function SelectBox({
  value,
  onValueChange,
  items,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} dir="rtl">
      <Select.Trigger className="flex h-11 min-w-0 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]">
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <IconChevronDown size={18} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 max-h-72 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <Select.Viewport className="p-1">
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className="relative flex cursor-pointer select-none items-center rounded-md py-2 pr-8 pl-3 text-sm outline-none data-[highlighted]:bg-[var(--muted)]"
              >
                <Select.ItemIndicator className="absolute right-2">
                  <IconCheck size={15} />
                </Select.ItemIndicator>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function PersianDatePicker({ value, onChange }: { onChange: (iso: string) => void; value: string }) {
  const selected = isoToJalali(value);
  const [view, setView] = useState({ jm: selected.jm, jy: selected.jy });
  const dayCount = daysInJalaliMonth(view.jy, view.jm);
  const offset = firstDayOffset(view.jy, view.jm);
  const days = Array.from({ length: offset + dayCount }, (_, index) => (index < offset ? null : index - offset + 1));

  function moveMonth(delta: number) {
    setView((current) => {
      const monthIndex = current.jm - 1 + delta;
      return {
        jm: ((monthIndex % 12) + 12) % 12 + 1,
        jy: current.jy + Math.floor(monthIndex / 12),
      };
    });
  }

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) setView({ jm: selected.jm, jy: selected.jy });
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="flex h-11 min-w-0 w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)]"
          type="button"
        >
          <span>{formatJalaliDate(value)}</span>
          <IconChevronDown size={18} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35" />
        <Dialog.Content className="fixed right-4 left-4 top-20 z-50 mx-auto max-w-sm rounded-lg bg-[var(--surface)] p-4 shadow-2xl">
          <Dialog.Title className="sr-only">انتخاب تاریخ شمسی</Dialog.Title>
          <div className="flex items-center justify-between gap-2">
            <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold" onClick={() => moveMonth(-1)} type="button">
              ماه قبل
            </button>
            <div className="text-center">
              <p className="font-black">{jalaliMonths[view.jm - 1]}</p>
              <p className="text-sm text-[var(--muted-foreground)]">{view.jy.toLocaleString("fa-IR", { useGrouping: false })}</p>
            </div>
            <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold" onClick={() => moveMonth(1)} type="button">
              ماه بعد
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-[var(--muted-foreground)]">
            {jalaliWeekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day, index) =>
              day ? (
                <Dialog.Close asChild key={`${view.jy}-${view.jm}-${day}`}>
                  <button
                    className={cn(
                      "grid h-10 place-items-center rounded-lg text-sm font-bold",
                      selected.jy === view.jy && selected.jm === view.jm && selected.jd === day
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--muted)] text-[var(--foreground)]",
                    )}
                    onClick={() => onChange(jalaliToIso(view.jy, view.jm, day))}
                    type="button"
                  >
                    {day.toLocaleString("fa-IR")}
                  </button>
                </Dialog.Close>
              ) : (
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={cn("money-value mt-1 font-bold", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700")}>{value}</p>
    </div>
  );
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot>(() => emptySnapshot());
  const [loaded, setLoaded] = useState(false);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [toast, setToast] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [priceTab, setPriceTab] = useState<PriceTab>("online");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoRefreshStartedRef = useRef(false);

  const [entryMode, setEntryMode] = useState<"quick" | "transaction">("quick");
  const [category, setCategory] = useState<AssetCategory>("gold");
  const [instrumentId, setInstrumentId] = useState("gold_melted_18");
  const [existingAssetId, setExistingAssetId] = useState("");
  const [customName, setCustomName] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");

  const [manualInstrumentId, setManualInstrumentId] = useState("gold_melted_18");
  const [manualPrice, setManualPrice] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [editingAssetId, setEditingAssetId] = useState("");
  const [editCategory, setEditCategory] = useState<AssetCategory>("gold");
  const [editInstrumentId, setEditInstrumentId] = useState("gold_melted_18");
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editFee, setEditFee] = useState("");
  const [editDate, setEditDate] = useState(todayIso());
  const [editNote, setEditNote] = useState("");

  const summary = useMemo(() => computePortfolio(snapshot), [snapshot]);
  const filteredInstruments = instruments.filter((instrument) => instrument.category === category);
  const filteredEditInstruments = instruments.filter((instrument) => instrument.category === editCategory);
  const themePreference = getThemePreference(snapshot.settings.theme);
  const autoUpdatePrices = getBooleanSetting(snapshot.settings.autoUpdatePrices);
  const onboardingSeen = getBooleanSetting(snapshot.settings.onboardingSeen);
  const latestOnlineUpdate = [...snapshot.priceCache].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0]?.fetchedAt;
  const editingAsset = snapshot.assets.find((asset) => asset.id === editingAssetId);
  const editingTransaction = snapshot.transactions
    .filter((transaction) => transaction.assetId === editingAssetId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((transaction) => transaction.type === "buy");
  const navItems: Array<{ id: View; label: string; icon: ReturnType<typeof makeIcon> }> = [
    { id: "dashboard", label: "داشبورد", icon: IconHome },
    { id: "assets", label: "دارایی‌ها", icon: IconBarChart },
    { id: "add", label: "افزودن", icon: IconPlus },
    { id: "prices", label: "قیمت‌ها", icon: IconRefresh },
    { id: "settings", label: "تنظیمات", icon: IconSettings },
  ];

  useEffect(() => {
    loadSnapshot()
      .then((stored) => setSnapshot(stored))
      .finally(() => setLoaded(true));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveSnapshot(snapshot).catch(() => setToast("ذخیره محلی با خطا روبه‌رو شد."));
  }, [loaded, snapshot]);

  useEffect(() => {
    document.documentElement.dataset.theme = themePreference;
  }, [themePreference]);

  function showToast(message: string) {
    setToast(message);
  }

  function setThemePreference(preference: ThemePreference) {
    setSnapshot((current) => ({
      ...current,
      settings: {
        ...current.settings,
        theme: preference,
      },
    }));
  }

  function setAutoUpdatePrices(enabled: boolean) {
    setSnapshot((current) => ({
      ...current,
      settings: {
        ...current.settings,
        autoUpdatePrices: enabled,
      },
    }));
  }

  function completeOnboarding() {
    setSnapshot((current) => ({
      ...current,
      settings: {
        ...current.settings,
        onboardingSeen: true,
      },
    }));
    setOnboardingStep(0);
  }

  function openEditAsset(assetId: string) {
    const asset = snapshot.assets.find((item) => item.id === assetId);
    const transaction = snapshot.transactions
      .filter((item) => item.assetId === assetId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((item) => item.type === "buy");
    if (!asset) return;
    setEditingAssetId(asset.id);
    setEditCategory(asset.category);
    setEditInstrumentId(asset.instrumentId);
    setEditName(asset.name);
    setEditQuantity(transaction ? formatNumber(transaction.quantity) : "");
    setEditUnitPrice(transaction ? formatPriceInput(String(transaction.unitPrice)) : "");
    setEditFee(transaction ? formatPriceInput(String(transaction.fee)) : "");
    setEditDate(transaction ? new Date(transaction.date).toISOString().slice(0, 10) : todayIso());
    setEditNote(transaction?.note ?? "");
  }

  function closeEditAsset() {
    setEditingAssetId("");
  }

  const refreshPrices = useCallback(async (options: { auto?: boolean } = {}) => {
    setIsRefreshing(true);
    if (options.auto) setIsAutoRefreshing(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/prices", { headers: { accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error("bad response");
      const data = (await response.json()) as { prices?: PriceRecord[]; errors?: string[] };
      const fresh = data.prices ?? [];
      setSnapshot((current) => {
        const freshIds = new Set(fresh.map((price) => price.instrumentId));
        const stale = current.priceCache
          .filter((price) => !freshIds.has(price.instrumentId))
          .map((price) => ({ ...price, source: "cache" as const, stale: true }));
        return { ...current, manualPrices: [], priceCache: [...fresh, ...stale] };
      });
      setToast(fresh.length ? "قیمت‌های آنلاین به‌روزرسانی شد و قیمت‌های دستی پاک شد." : "قیمتی خوانده نشد؛ قیمت‌های دستی پاک شد و آخرین داده‌ها باقی ماند.");
    } catch {
      setSnapshot((current) => ({
        ...current,
        manualPrices: [],
        priceCache: current.priceCache.map((price) => ({ ...price, source: "cache", stale: true })),
      }));
      setToast("TGJU در دسترس نبود؛ قیمت‌های دستی پاک شد و داده‌های ذخیره‌شده نمایش داده می‌شود.");
    } finally {
      window.clearTimeout(timeoutId);
      setIsRefreshing(false);
      if (options.auto) setIsAutoRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded || !autoUpdatePrices || autoRefreshStartedRef.current) return;
    autoRefreshStartedRef.current = true;
    refreshPrices({ auto: true });
  }, [autoUpdatePrices, loaded, refreshPrices]);

  function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedInstrument = instruments.find((instrument) => instrument.id === instrumentId);
    if (!selectedInstrument) return;

    const qty = parseLocalizedNumber(quantity);
    const price = parseLocalizedNumber(unitPrice);
    const feeValue = parseLocalizedNumber(fee);
    if (qty <= 0 || price <= 0) {
      showToast("مقدار و قیمت باید بزرگ‌تر از صفر باشد.");
      return;
    }

    setSnapshot((current) => {
      const existing = current.assets.find((asset) => asset.id === existingAssetId);
      const asset: AssetRecord =
        existing ??
        {
          id: makeId("asset"),
          category,
          instrumentId,
          name: customName.trim() || selectedInstrument.name,
          unit: selectedInstrument.unit,
          createdAt: new Date().toISOString(),
        };

      const transaction: TransactionRecord = {
        id: makeId("txn"),
        assetId: asset.id,
        type: entryMode === "quick" ? "buy" : transactionType,
        quantity: qty,
        unitPrice: price,
        fee: feeValue,
        date: new Date(date).toISOString(),
        note: note.trim() || undefined,
      };

      return {
        ...current,
        assets: existing ? current.assets : [...current.assets, asset],
        transactions: [...current.transactions, transaction],
      };
    });

    setQuantity("");
    setUnitPrice("");
    setFee("");
    setNote("");
    setCustomName("");
    setExistingAssetId("");
    showToast("ثبت شد.");
    setActiveView("dashboard");
  }

  function saveManualPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const instrument = instruments.find((item) => item.id === manualInstrumentId);
    const value = parseLocalizedNumber(manualPrice);
    if (!instrument || value <= 0) {
      showToast("قیمت دستی معتبر نیست.");
      return;
    }
    const record: ManualPriceRecord = {
      instrumentId: instrument.id,
      name: instrument.name,
      category: instrument.category,
      priceToman: value,
      source: "manual",
      fetchedAt: new Date().toISOString(),
      note: manualNote.trim() || undefined,
    };
    setSnapshot((current) => ({
      ...current,
      manualPrices: [record, ...current.manualPrices.filter((price) => price.instrumentId !== record.instrumentId)],
    }));
    setManualPrice("");
    setManualNote("");
    showToast("قیمت دستی ذخیره شد.");
  }

  function saveEditedAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset) return;

    const instrument = instruments.find((item) => item.id === editInstrumentId);
    const qty = parseLocalizedNumber(editQuantity);
    const price = parseLocalizedNumber(editUnitPrice);
    const feeValue = parseLocalizedNumber(editFee);
    if (!instrument || qty <= 0 || price <= 0) {
      showToast("مقدار و قیمت باید بزرگ‌تر از صفر باشد.");
      return;
    }

    const transactionId = editingTransaction?.id ?? makeId("txn");
    const updatedTransaction: TransactionRecord = {
      id: transactionId,
      assetId: editingAsset.id,
      type: "buy",
      quantity: qty,
      unitPrice: price,
      fee: feeValue,
      date: new Date(editDate).toISOString(),
      note: editNote.trim() || undefined,
    };

    setSnapshot((current) => {
      const hasTransaction = current.transactions.some((transaction) => transaction.id === transactionId);
      return {
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === editingAsset.id
            ? {
                ...asset,
                category: instrument.category,
                instrumentId: instrument.id,
                name: editName.trim() || instrument.name,
                unit: instrument.unit,
              }
            : asset,
        ),
        transactions: hasTransaction
          ? current.transactions.map((transaction) => (transaction.id === transactionId ? updatedTransaction : transaction))
          : [...current.transactions, updatedTransaction],
      };
    });

    closeEditAsset();
    showToast("دارایی ویرایش شد.");
  }

  function removeAsset(assetId: string) {
    setSnapshot((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== assetId),
      transactions: current.transactions.filter((transaction) => transaction.assetId !== assetId),
    }));
    showToast("دارایی حذف شد.");
  }

  function downloadBackup() {
    const blob = new Blob([exportSnapshot(snapshot)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asset-log-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      setSnapshot(parseImportedSnapshot(text));
      showToast("بکاپ وارد شد.");
    } catch {
      showToast("فایل بکاپ خوانده نشد.");
    }
  }

  const mainContent = (
    <>
      {activeView === "dashboard" && (
        <div className="grid gap-4">
          <Card className="hero-card text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">ارزش کل دارایی‌ها</p>
                <h1 className="money-hero mt-2 font-black">{formatToman(summary.totalValue)}</h1>
              </div>
              <IconWallet className="mt-1 shrink-0 text-white/75" size={30} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <div className="rounded-lg bg-white/12 p-3">
                <p className="text-xs text-white/70">سود کل</p>
                <p className="mt-1 font-bold">{formatToman(summary.totalProfit)}</p>
              </div>
              <div className="rounded-lg bg-white/12 p-3">
                <p className="text-xs text-white/70">بازده</p>
                <p className="mt-1 font-bold">{formatPercent(summary.totalProfitPercent)}</p>
              </div>
            </div>
          </Card>

          {summary.stalePriceCount > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {formatNumber(summary.stalePriceCount, 0)} دارایی با قیمت ذخیره‌شده نمایش داده می‌شود.
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setActiveView("add")}>
              <IconPlus size={18} />
              ثبت دارایی
            </Button>
            <Button variant="secondary" onClick={refreshPrices} disabled={isRefreshing}>
              <IconRefresh className={cn(isRefreshing && "animate-spin")} size={18} />
            </Button>
          </div>

          <section className="grid gap-3">
            <h2 className="text-base font-extrabold">دارایی‌های فعال</h2>
            {summary.holdings.length === 0 ? (
              <Card className="text-center text-sm text-[var(--muted-foreground)]">هنوز دارایی ثبت نشده است.</Card>
            ) : (
              summary.holdings.slice(0, 4).map((holding) => <HoldingCard key={holding.asset.id} holding={holding} onEdit={openEditAsset} onRemove={removeAsset} />)
            )}
          </section>
        </div>
      )}

      {activeView === "assets" && (
        <div className="grid gap-3">
          <PageTitle title="دارایی‌ها" subtitle={`${formatNumber(summary.holdings.length, 0)} مورد ثبت‌شده`} />
          {summary.holdings.map((holding) => (
            <HoldingCard key={holding.asset.id} holding={holding} onEdit={openEditAsset} onRemove={removeAsset} expanded />
          ))}
          {summary.holdings.length === 0 && <Card className="text-sm text-[var(--muted-foreground)]">از تب افزودن، اولین خرید یا موجودی فعلی را ثبت کنید.</Card>}
        </div>
      )}

      {activeView === "add" && (
        <form className="grid gap-4" onSubmit={addEntry}>
          <PageTitle title="ثبت دارایی" subtitle="خرید سریع، موجودی فعلی یا تراکنش دقیق" />
          <Tabs.Root value={entryMode} onValueChange={(value) => setEntryMode(value as "quick" | "transaction")} dir="rtl">
            <Tabs.List className="grid grid-cols-2 rounded-lg bg-[var(--muted)] p-1">
              <Tabs.Trigger className="rounded-md px-3 py-2 text-sm font-bold data-[state=active]:bg-[var(--surface)] data-[state=active]:shadow-sm" value="quick">
                موجودی فعلی
              </Tabs.Trigger>
              <Tabs.Trigger className="rounded-md px-3 py-2 text-sm font-bold data-[state=active]:bg-[var(--surface)] data-[state=active]:shadow-sm" value="transaction">
                خرید/فروش
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          <Card className="grid gap-4">
            <Field label="نوع دارایی">
              <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:grid-cols-5">
                {(Object.keys(categoryLabels) as AssetCategory[]).map((item) => {
                  const Icon = categoryIcons[item];
                  return (
                    <button
                      key={item}
                      type="button"
                      className={cn("grid min-h-16 place-items-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-bold leading-tight", category === item ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)]")}
                      onClick={() => {
                        setCategory(item);
                        setInstrumentId(instruments.find((instrument) => instrument.category === item)?.id ?? instrumentId);
                        setExistingAssetId("");
                      }}
                    >
                      <Icon size={18} />
                      <span>{categoryLabels[item]}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {entryMode === "transaction" && snapshot.assets.length > 0 && (
              <Field label="ثبت روی دارایی موجود">
                <SelectBox
                  value={existingAssetId || NEW_ASSET_VALUE}
                  onValueChange={(value) => setExistingAssetId(value === NEW_ASSET_VALUE ? "" : value)}
                  placeholder="دارایی جدید"
                  items={[{ value: NEW_ASSET_VALUE, label: "دارایی جدید" }, ...snapshot.assets.map((asset) => ({ value: asset.id, label: asset.name }))]}
                />
              </Field>
            )}

            {!existingAssetId && (
              <>
                <Field label="نماد/بازار">
                  <SelectBox value={instrumentId} onValueChange={setInstrumentId} items={filteredInstruments.map((item) => ({ value: item.id, label: item.name }))} />
                </Field>
                <Field label="نام دلخواه">
                  <TextInput value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="مثلاً آب‌شده صندوق شخصی" />
                </Field>
              </>
            )}

            {entryMode === "transaction" && (
              <Field label="نوع تراکنش">
                <div className="grid grid-cols-2 rounded-lg bg-[var(--muted)] p-1">
                  <button type="button" className={cn("rounded-md py-2 text-sm font-bold", transactionType === "buy" && "bg-[var(--surface)] shadow-sm")} onClick={() => setTransactionType("buy")}>
                    خرید
                  </button>
                  <button type="button" className={cn("rounded-md py-2 text-sm font-bold", transactionType === "sell" && "bg-[var(--surface)] shadow-sm")} onClick={() => setTransactionType("sell")}>
                    فروش
                  </button>
                </div>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <Field label="مقدار">
                <TextInput inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="۱۴۷.۸" />
              </Field>
              <Field label="قیمت واحد (تومان)">
                <TextInput inputMode="numeric" value={unitPrice} onChange={(event) => setUnitPrice(formatPriceInput(event.target.value))} placeholder="۶٬۷۶۲٬۲۰۰" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <Field label="کارمزد (تومان)">
                <TextInput inputMode="numeric" value={fee} onChange={(event) => setFee(formatPriceInput(event.target.value))} placeholder="۰" />
              </Field>
              <Field label="تاریخ">
                <PersianDatePicker value={date} onChange={setDate} />
              </Field>
            </div>
            <Field label="یادداشت">
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} placeholder="اختیاری" />
            </Field>
          </Card>
          <Button type="submit">
            <IconCheck size={18} />
            ذخیره
          </Button>
        </form>
      )}

      {activeView === "prices" && (
        <div className="grid gap-4">
          <PageTitle title="قیمت‌ها" subtitle="قیمت آنلاین TGJU یا قیمت دستی خودتان" />
          <div className="grid grid-cols-2 rounded-lg bg-[var(--muted)] p-1">
            {[
              { label: "قیمت آنلاین", value: "online" as const },
              { label: "قیمت دستی", value: "manual" as const },
            ].map((item) => (
              <button
                key={item.value}
                aria-pressed={priceTab === item.value}
                className={cn(
                  "rounded-md px-2 py-2 text-sm font-bold transition",
                  priceTab === item.value ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted-foreground)]",
                )}
                onClick={() => setPriceTab(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          {priceTab === "online" && (
            <>
              <Card className="grid gap-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-extrabold">قیمت آنلاین</h2>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">آخرین به‌روزرسانی: {latestOnlineUpdate ? faDateTime(latestOnlineUpdate) : "هنوز دریافت نشده"}</p>
                  </div>
                  <IconRefresh className={cn("mt-1 shrink-0 text-[var(--primary)]", isRefreshing && "animate-spin")} size={20} />
                </div>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-sm font-bold">
                  <span>به‌روزرسانی خودکار در شروع برنامه</span>
                  <input
                    checked={autoUpdatePrices}
                    className="h-5 w-5 accent-[var(--primary)]"
                    onChange={(event) => setAutoUpdatePrices(event.target.checked)}
                    type="checkbox"
                  />
                </label>
                <Button onClick={() => refreshPrices()} disabled={isRefreshing}>
                  <IconRefresh className={cn(isRefreshing && "animate-spin")} size={18} />
                  به‌روزرسانی از TGJU
                </Button>
                <p className="text-xs leading-6 text-[var(--muted-foreground)]">با به‌روزرسانی آنلاین، همه قیمت‌های دستی پاک می‌شوند.</p>
              </Card>
              <div className="grid gap-2">
                {snapshot.priceCache.length === 0 && (
                  <Card className="text-sm text-[var(--muted-foreground)]">هنوز قیمت آنلاینی ذخیره نشده است.</Card>
                )}
                {[...snapshot.priceCache]
                  .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
                  .slice(0, 20)
                  .map((price) => (
                    <Card key={`${price.source}-${price.instrumentId}`} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{price.name}</p>
                        <p className="inline-flex flex-row items-center gap-1 text-right text-xs text-[var(--muted-foreground)]" dir="rtl">
                          <span dir="ltr">{price.stale ? "ذخیره‌شده" : "TGJU"}</span>
                          <span> · </span>
                          <span>{faDate(price.fetchedAt)}</span>
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-extrabold">{formatToman(price.priceToman)}</p>
                    </Card>
                  ))}
              </div>
            </>
          )}

          {priceTab === "manual" && (
            <>
              <form onSubmit={saveManualPrice}>
                <Card className="grid gap-3">
                  <h2 className="font-extrabold">قیمت دستی</h2>
                  <Field label="بازار">
                    <SelectBox value={manualInstrumentId} onValueChange={setManualInstrumentId} items={instruments.map((item) => ({ value: item.id, label: item.name }))} />
                  </Field>
                  <Field label="قیمت دستی (تومان)">
                    <TextInput inputMode="numeric" value={manualPrice} onChange={(event) => setManualPrice(formatPriceInput(event.target.value))} placeholder="۲۳٬۹۱۵٬۶۰۰" />
                  </Field>
                  <Field label="یادداشت">
                    <TextInput value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="مثلاً قیمت صرافی/طلافروش" />
                  </Field>
                  <Button type="submit" variant="secondary">ذخیره قیمت دستی</Button>
                </Card>
              </form>
              <div className="grid gap-2">
                {snapshot.manualPrices.length === 0 && (
                  <Card className="text-sm text-[var(--muted-foreground)]">هنوز قیمت دستی ثبت نشده است.</Card>
                )}
                {[...snapshot.manualPrices]
                  .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
                  .slice(0, 20)
                  .map((price) => (
                    <Card key={`${price.source}-${price.instrumentId}`} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{price.name}</p>
                        <p className="inline-flex flex-row items-center gap-1 text-right text-xs text-[var(--muted-foreground)]" dir="rtl">
                          <span>دستی</span>
                          <span> · </span>
                          <span>{faDate(price.fetchedAt)}</span>
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-extrabold">{formatToman(price.priceToman)}</p>
                    </Card>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeView === "settings" && (
        <div className="grid gap-4">
          <PageTitle title="تنظیمات" subtitle="داده‌ها فقط روی همین دستگاه می‌مانند" />
          <Card className="grid gap-3">
            <div>
              <h2 className="font-extrabold">حالت نمایش</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">پیش‌فرض روی حالت سیستم است.</p>
            </div>
            <div className="grid grid-cols-3 rounded-lg bg-[var(--muted)] p-1">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  aria-pressed={themePreference === option.value}
                  className={cn(
                    "rounded-md px-2 py-2 text-sm font-bold transition",
                    themePreference === option.value ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--muted-foreground)]",
                  )}
                  onClick={() => setThemePreference(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Card>
          <Card className="grid gap-3">
            <Button variant="secondary" onClick={downloadBackup}>
              <IconDownload size={18} />
              خروجی JSON
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <IconUpload size={18} />
              ورود بکاپ
            </Button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importBackup(file);
                event.currentTarget.value = "";
              }}
            />
          </Card>
          <Card className="grid gap-2 text-sm text-[var(--muted-foreground)]">
            <p>ذخیره اصلی با IndexedDB انجام می‌شود.</p>
            <p>برای قیمت زنده فقط درخواست به TGJU ارسال می‌شود و اطلاعات دارایی شما از دستگاه خارج نمی‌شود.</p>
          </Card>
        </div>
      )}
    </>
  );

  return (
    <Toast.Provider swipeDirection="right">
      <main className="min-h-screen bg-[var(--background)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[var(--foreground)]">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/92 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">سرمایه من</p>
              <p className="text-lg font-black">سرمایه من</p>
            </div>
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <Button variant="secondary" className="h-10 min-h-10 px-3">
                  <IconArchiveRestore size={18} />
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35" />
                <Dialog.Content className="fixed right-4 left-4 top-24 z-50 mx-auto max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Dialog.Title className="text-lg font-extrabold">بکاپ سریع</Dialog.Title>
                      <Dialog.Description className="mt-1 text-sm text-[var(--muted-foreground)]">خروجی و ورود فایل JSON برای انتقال بین دستگاه‌ها.</Dialog.Description>
                    </div>
                    <Dialog.Close className="rounded-md p-1 hover:bg-[var(--muted)]">
                      <IconX size={18} />
                    </Dialog.Close>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <Button onClick={downloadBackup}>
                      <IconDownload size={18} />
                      دریافت فایل
                    </Button>
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                      <IconUpload size={18} />
                      ورود فایل
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </header>

        {isAutoRefreshing && (
          <div className="fixed left-4 right-4 top-20 z-50 mx-auto max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <IconRefresh className="animate-spin" size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold">در حال به‌روزرسانی قیمت‌ها</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">آخرین قیمت‌های آنلاین از TGJU دریافت می‌شود.</p>
              </div>
            </div>
          </div>
        )}

        <Dialog.Root
          open={loaded && !onboardingSeen}
          onOpenChange={(open) => {
            if (!open) completeOnboarding();
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
            <Dialog.Content className="onboarding-dialog fixed z-50 overflow-hidden rounded-lg bg-[var(--surface)] shadow-2xl">
              <div className="onboarding-image-wrap">
                <div
                  aria-hidden="true"
                  className="onboarding-image"
                  style={{ backgroundImage: `url("${onboardingItems[onboardingStep].imageSrc}")` }}
                />
              </div>
              <div className="onboarding-copy">
                <Dialog.Title className="text-2xl font-black">{onboardingItems[onboardingStep].title}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  {onboardingItems[onboardingStep].description}
                </Dialog.Description>
              </div>
              <div className="onboarding-footer p-4">
                <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
                  {onboardingItems.map((item, index) => (
                    <span className={cn("onboarding-dot", index === onboardingStep && "is-active")} key={item.title} />
                  ))}
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={() => {
                    if (onboardingStep < onboardingItems.length - 1) {
                      setOnboardingStep((current) => current + 1);
                    } else {
                      completeOnboarding();
                    }
                  }}
                >
                  {onboardingStep < onboardingItems.length - 1 ? "بعدی" : "شروع استفاده"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="mx-auto grid max-w-3xl gap-4 px-4 py-4">{mainContent}</div>

        <Dialog.Root open={Boolean(editingAssetId)} onOpenChange={(open) => !open && closeEditAsset()}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45" />
            <Dialog.Content
              className="edit-dialog fixed z-50 flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title className="text-lg font-extrabold">ویرایش دارایی</Dialog.Title>
                <Dialog.Close className="rounded-md p-1 hover:bg-[var(--muted)]">
                  <IconX size={18} />
                </Dialog.Close>
              </div>

              <form className="edit-form mt-4 flex min-h-0 flex-col gap-4" onSubmit={saveEditedAsset}>
                <div className="edit-scroll grid min-h-0 gap-4 overflow-y-auto">
                  <Field label="نوع دارایی">
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(categoryLabels) as AssetCategory[]).map((item) => {
                        const Icon = categoryIcons[item];
                        return (
                          <button
                            key={item}
                            type="button"
                            className={cn("grid min-h-14 place-items-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-bold leading-tight", editCategory === item ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)]")}
                            onClick={() => {
                              const nextInstrument = instruments.find((instrument) => instrument.category === item);
                              setEditCategory(item);
                              setEditInstrumentId(nextInstrument?.id ?? editInstrumentId);
                            }}
                          >
                            <Icon size={18} />
                            <span>{categoryLabels[item]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="نماد/بازار">
                    <SelectBox value={editInstrumentId} onValueChange={setEditInstrumentId} items={filteredEditInstruments.map((item) => ({ value: item.id, label: item.name }))} />
                  </Field>
                  <Field label="نام دارایی">
                    <TextInput value={editName} onChange={(event) => setEditName(event.target.value)} />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
                    <Field label="مقدار">
                      <TextInput inputMode="decimal" value={editQuantity} onChange={(event) => setEditQuantity(event.target.value)} />
                    </Field>
                    <Field label="قیمت واحد (تومان)">
                      <TextInput inputMode="numeric" value={editUnitPrice} onChange={(event) => setEditUnitPrice(formatPriceInput(event.target.value))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
                    <Field label="کارمزد (تومان)">
                      <TextInput inputMode="numeric" value={editFee} onChange={(event) => setEditFee(formatPriceInput(event.target.value))} />
                    </Field>
                    <Field label="تاریخ">
                      <PersianDatePicker value={editDate} onChange={setEditDate} />
                    </Field>
                  </div>
                  <Field label="یادداشت">
                    <TextArea value={editNote} onChange={(event) => setEditNote(event.target.value)} />
                  </Field>
                </div>
                <div className="edit-footer grid grid-cols-2 gap-2 border-t border-[var(--border)]">
                  <Button type="submit">
                    <IconCheck size={18} />
                    ذخیره
                  </Button>
                  <Dialog.Close asChild>
                    <Button type="button" variant="secondary">
                      انصراف
                    </Button>
                  </Dialog.Close>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <nav className="oneui-tabbar fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2" aria-label="ناوبری اصلی">
          <div className="oneui-tabbar-shell mx-auto grid max-w-md grid-cols-5 gap-1.5 p-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={active ? "page" : undefined}
                  className={cn("oneui-tabbar-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 font-extrabold transition", active && "is-active")}
                  onClick={() => setActiveView(item.id)}
                  type="button"
                >
                  <span className="oneui-tabbar-icon">
                    <Icon size={20} />
                  </span>
                  <span className="oneui-tabbar-label truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </main>
      <Toast.Root open={Boolean(toast)} onOpenChange={(open) => !open && setToast("")} duration={3200} className="fixed bottom-24 right-4 left-4 z-50 mx-auto max-w-md rounded-lg bg-[var(--foreground)] px-4 py-3 text-sm font-bold text-[var(--background)] shadow-xl">
        <Toast.Title>{toast}</Toast.Title>
      </Toast.Root>
      <Toast.Viewport />
    </Toast.Provider>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{subtitle}</p>
    </div>
  );
}

function HoldingCard({
  holding,
  expanded,
  onEdit,
  onRemove,
}: {
  expanded?: boolean;
  holding: ReturnType<typeof computePortfolio>["holdings"][number];
  onEdit: (assetId: string) => void;
  onRemove: (assetId: string) => void;
}) {
  const Icon = categoryIcons[holding.asset.category];
  const profitTone = holding.unrealizedProfit >= 0 ? "text-emerald-700" : "text-red-700";
  if (!expanded) {
    return (
      <Card className="p-3">
        <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
          <div className="grid h-10 w-10 min-w-10 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon className="h-5 w-5" size={20} />
          </div>
            <div className="min-w-0">
              <p className="truncate font-extrabold">{holding.asset.name}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {categoryLabels[holding.asset.category]} · {formatNumber(holding.quantity)} {holding.asset.unit}
              </p>
            </div>
          <p className={cn("shrink-0 text-left text-sm font-black", profitTone)}>{formatPercent(holding.unrealizedPercent)}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-3 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon size={21} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-extrabold">{holding.asset.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {categoryLabels[holding.asset.category]} · {formatNumber(holding.quantity)} {holding.asset.unit}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
        <Metric label="قیمت کل در زمان خرید" value={formatToman(holding.invested)} />
        <Metric label="قیمت کل بر اساس قیمت امروز" value={formatToman(holding.currentValue)} />
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted-foreground)]">میزان سود تا امروز</p>
          <div className={cn("mt-1 flex items-baseline justify-between gap-3", profitTone)}>
            <span className="money-value font-bold">{formatToman(holding.unrealizedProfit)}</span>
            <span className="shrink-0 text-sm font-extrabold">{formatPercent(holding.unrealizedPercent)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <div className="grid grid-cols-2 gap-2 min-[430px]:flex min-[430px]:justify-end">
          <Button variant="secondary" className="min-h-9 px-3" onClick={() => onEdit(holding.asset.id)}>
            <IconEdit size={16} />
            ویرایش
          </Button>
          <Button variant="ghost" className="min-h-9 px-3 text-red-700" onClick={() => onRemove(holding.asset.id)}>
            حذف
          </Button>
        </div>
      </div>
    </Card>
  );
}
