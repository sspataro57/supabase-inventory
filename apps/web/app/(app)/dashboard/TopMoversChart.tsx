"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Item = { name: string; movements: number };

export function TopMoversChart({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10 }}
          width={110}
          tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + "…" : v}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="movements" fill="#6366f1" radius={[0, 3, 3, 0]} name="Movements" />
      </BarChart>
    </ResponsiveContainer>
  );
}
