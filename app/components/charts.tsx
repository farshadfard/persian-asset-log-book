"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateFromLocalKey } from "../lib/date";
import { formatToman, type AssetHistoryPoint } from "../lib/portfolio";

export type HistoryChartMode = "totalProfit" | "dailyProfit" | "currentValue";

function shortDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(dateFromLocalKey(date));
}

function tooltipDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(dateFromLocalKey(date));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")}`;
}

const chartLabels: Record<HistoryChartMode, string> = {
  totalProfit: "سود کل",
  dailyProfit: "سود روزانه",
  currentValue: "ارزش دارایی",
};

export function MiniProfitChart({ points }: { points: AssetHistoryPoint[] }) {
  const usable = points.filter((point) => point.totalProfit !== null);
  if (usable.length < 2) {
    return <div className="grid h-28 place-items-center text-xs text-[var(--muted-foreground)]">داده کافی برای نمودار نیست</div>;
  }
  const latest = usable.at(-1)?.totalProfit ?? 0;
  const color = latest >= 0 ? "#059669" : "#dc2626";
  return (
    <div className="h-32 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
          <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="date" hide />
          <Area type="monotone" dataKey="totalProfit" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2.25} connectNulls={false} isAnimationActive={false} />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            formatter={(value) => [typeof value === "number" ? formatToman(value) : "-", "سود کل"]}
            labelFormatter={(label) => tooltipDate(String(label))}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", direction: "rtl", fontSize: 12 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AssetHistoryChart({ mode, points }: { mode: HistoryChartMode; points: AssetHistoryPoint[] }) {
  const values = points.map((point) => point[mode]).filter((value): value is number => typeof value === "number");
  if (values.length < 2) {
    return <div className="grid h-64 place-items-center text-sm text-[var(--muted-foreground)]">برای این بازه داده کافی وجود ندارد.</div>;
  }
  const latest = values.at(-1) ?? 0;
  const color = mode === "currentValue" ? "#0f766e" : latest >= 0 ? "#059669" : "#dc2626";
  const sparseTick = Math.max(1, Math.ceil(points.length / 5));
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 12, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            interval={sparseTick - 1}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={["auto", "auto"]} />
          {mode !== "currentValue" && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
          {mode === "dailyProfit" ? (
            <Bar dataKey={mode} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          ) : (
            <Area type="monotone" dataKey={mode} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2.5} connectNulls={false} isAnimationActive={false} />
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            formatter={(value) => [typeof value === "number" ? formatToman(value) : "-", chartLabels[mode]]}
            labelFormatter={(label) => tooltipDate(String(label))}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", direction: "rtl", fontSize: 12 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
