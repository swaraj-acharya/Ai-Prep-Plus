"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { stroke: "var(--faint)", fontSize: 11, tickLine: false, axisLine: false };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, color: "var(--ink)" }, cursor: { fill: "var(--surface-2)" } };

export function BarSeries({ data, x, y, color = "var(--accent)", height = 200 }: { data: Record<string, unknown>[]; x: string; y: string; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -18, right: 4, top: 6 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey={x} {...axis} interval="preserveStartEnd" minTickGap={18} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} />
        <Bar dataKey={y} fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
export function LineSeries({ data, x, y, height = 200 }: { data: Record<string, unknown>[]; x: string; y: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -18, right: 4, top: 6 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey={x} {...axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} />
        <Line type="monotone" dataKey={y} stroke="var(--good)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
