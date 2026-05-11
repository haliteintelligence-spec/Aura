"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PLUM_PALETTE = [
  "#6B2D8D", "#9B4DCA", "#C084FC", "#E9D5FF", "#7E22CE",
  "#A855F7", "#D8B4FE", "#4A1F6A", "#F3E8FF", "#2D0F45",
];

interface BarData {
  name: string;
  value: number;
}

interface PieData {
  name: string;
  value: number;
}

export function MostWornChart({ data }: { data: BarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
        <Tooltip
          formatter={(v) => [`${v} days`, "Worn"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" fill="#6B2D8D" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OccasionPieChart({ data }: { data: PieData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={40}
          label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
          labelLine={false}
          fontSize={9}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PLUM_PALETTE[i % PLUM_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MoodBarChart({ data }: { data: BarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PLUM_PALETTE[i % PLUM_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BrandRatingChart({ data }: { data: BarData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
        <Tooltip
          formatter={(v) => [`${v}/10`, "Avg Rating"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" fill="#9B4DCA" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
