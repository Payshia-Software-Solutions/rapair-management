"use client";

import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartLegend } from "@/components/dashboard/chart-legend";
import { SERIES, axisTick, compact, gridStroke, tooltipItemStyle, tooltipLabelStyle, tooltipStyle } from "@/components/dashboard/chart-theme";

/** Charts the AI suggests. Bars and lines are one series (one colour); pies get a legend with values. */
export function AiChart({ config, compactHeight = false }: { config: any; compactHeight?: boolean }) {
    const { type, title } = config || {};
    const data: { name: string; value: number }[] = Array.isArray(config?.data)
        ? config.data.map((d: any) => ({ name: String(d.name), value: Number(d.value) || 0 }))
        : [];
    if (!data.length) return null;
    const tip = <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v) => Number(v).toLocaleString()} cursor={{ fill: "hsl(var(--muted))" }} />;
    const pie = data.slice(0, 6);
    const pieTotal = pie.reduce((s, d) => s + d.value, 0) || 1;

    return (
        <figure className="not-prose my-3 rounded-md border bg-card p-3">
            {title && <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>}
            {type === "pie" ? (
                <div className="grid items-center gap-4 sm:grid-cols-2">
                    <div className={compactHeight ? "h-36" : "h-48"}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                                    {pie.map((d, i) => <Cell key={d.name} fill={SERIES[i]} />)}
                                </Pie>
                                {tip}
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <ChartLegend items={pie.map((d, i) => ({ label: d.name, color: SERIES[i], value: `${Math.round((d.value / pieTotal) * 100)}%` }))} />
                </div>
            ) : (
                <div className={compactHeight ? "h-40" : "h-56"}>
                    <ResponsiveContainer width="100%" height="100%">
                        {type === "line" ? (
                            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke={gridStroke} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                                <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} width={44} />
                                {tip}
                                <Line type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </LineChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke={gridStroke} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} interval={0} />
                                <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} width={44} />
                                {tip}
                                <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}
        </figure>
    );
}
