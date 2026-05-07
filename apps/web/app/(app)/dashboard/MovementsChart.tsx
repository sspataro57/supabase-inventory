"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Point = { day: string; check_ins: number; check_outs: number };

export function MovementsChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          labelFormatter={(l) => `Day: ${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="check_ins" stroke="#6366f1" strokeWidth={2} dot={false} name="Check-ins" />
        <Line type="monotone" dataKey="check_outs" stroke="#f97316" strokeWidth={2} dot={false} name="Check-outs" />
      </LineChart>
    </ResponsiveContainer>
  );
}
