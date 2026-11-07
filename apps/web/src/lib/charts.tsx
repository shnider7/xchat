"use client";
import { useId, useRef, useState } from "react";

export const COLORS = ["#f97316", "#60a5fa", "#a78bfa", "#34d399", "#fb7185"];
export const fmt = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);

// completa os dias sem registro com zero
export function fillDays(rows: { dia: string; total: number }[], days: number) {
  const m = new Map(rows.map((r) => [r.dia, r.total]));
  const labels: string[] = [], data: number[] = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); labels.push(d); data.push(m.get(d) ?? 0); }
  return { labels, data };
}

export function LineChart({ labels, series }: { labels: string[]; series: { name: string; color: string; data: number[] }[] }) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [hi, setHi] = useState<number | null>(null);
  const W = 600, H = 220, pad = { l: 8, r: 8, t: 14, b: 24 }, n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (d: number[]) => d.map((v, i) => { if (i === 0) return `M${x(0)},${y(v)}`; const cx = (x(i - 1) + x(i)) / 2; return `C${cx},${y(d[i - 1])} ${cx},${y(v)} ${x(i)},${y(v)}`; }).join(" ");
  function move(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
    setHi(Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1)))));
  }
  return (
    <div>
      <div ref={ref} className="relative" onMouseMove={move} onMouseLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          <defs>{series.map((s, k) => (
            <linearGradient key={k} id={`${uid}${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".32" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>))}</defs>
          {[0, 0.5, 1].map((f) => <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" opacity=".1" strokeDasharray="3 5" />)}
          <text x={pad.l} y={y(max) - 4} fontSize="10" fill="currentColor" opacity=".45">{max}</text>
          {series.map((s, k) => (
            <g key={k}>
              <path d={`${path(s.data)} L${x(n - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`} fill={`url(#${uid}${k})`} className="fadein" />
              <path d={path(s.data)} pathLength={1} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" className="draw" />
            </g>))}
          {hi !== null && <>
            <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={H - pad.b} stroke="currentColor" opacity=".25" />
            {series.map((s, k) => <circle key={k} cx={x(hi)} cy={y(s.data[hi])} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />)}</>}
          {[0, Math.floor((n - 1) / 2), n - 1].map((i, k) => labels[i] && <text key={k} x={x(i)} y={H - 6} fontSize="10" fill="currentColor" opacity=".5" textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>{fmt(labels[i])}</text>)}
        </svg>
        {hi !== null && (
          <div className="pop pointer-events-none absolute top-0 z-10 rounded-xl px-3 py-2 text-xs" style={{ left: `${Math.min(86, Math.max(14, (x(hi) / W) * 100))}%`, transform: "translateX(-50%)" }}>
            <div className="mb-1 opacity-60">{fmt(labels[hi])}</div>
            {series.map((s) => <div key={s.name} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}: <b>{s.data[hi]}</b></div>)}
          </div>)}
      </div>
      <div className="mt-2 flex gap-4 text-xs opacity-70">{series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}

export function DonutChart({ data, center }: { data: { name: string; value: number; color?: string }[]; center?: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  let acc = 0;
  const segs = data.map((d, i) => { const pct = total ? (d.value / total) * 100 : 0; const o = acc; acc += pct; return { ...d, color: d.color ?? COLORS[i % COLORS.length], pct, o }; });
  const cur = hi !== null ? segs[hi] : null;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" opacity=".08" strokeWidth="12" />
          {segs.map((s, i) => s.pct > 0 && (
            <circle key={s.name} cx="50" cy="50" r="40" fill="none" stroke={s.color} pathLength={100} className="seg" strokeDashoffset={-s.o}
              style={{ ["--d" as any]: `${Math.max(s.pct - 0.8, 0.2)} 100`, strokeWidth: hi === i ? 15 : 12, opacity: hi === null || hi === i ? 1 : 0.35, transition: "stroke-width .2s, opacity .2s", cursor: "default" }}
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} />))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold">{cur ? cur.value : total}</span>
          <span className="px-3 text-[11px] opacity-60">{cur ? `${cur.name} · ${Math.round(cur.pct)}%` : center ?? "total"}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {segs.map((s, i) => (
          <li key={s.name} className="flex cursor-default items-center gap-2 transition-opacity" style={{ opacity: hi === null || hi === i ? 1 : 0.5 }} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}<span className="ml-auto pl-4 opacity-60">{s.value}</span></li>))}
      </ul>
    </div>
  );
}

export function PillBars({ labels, data, height = 160 }: { labels: string[]; data: number[]; height?: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1, ...data);
  const on = hi ?? data.indexOf(Math.max(...data));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((v, i) => {
          const pct = Math.max(5, (v / max) * 88);
          return (
            <div key={i} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
              {on === i && <span className="absolute text-[11px] font-medium" style={{ bottom: `calc(${pct}% + 6px)` }}>{v}</span>}
              <div className="grow w-full max-w-[26px] rounded-full transition-colors" style={{ height: `${pct}%`, animationDelay: `${i * 25}ms`, background: on === i ? "linear-gradient(#f97316,#fb923c)" : "rgba(127,127,127,.28)" }} />
            </div>);
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] opacity-50"><span>{labels[0] && fmt(labels[0])}</span><span>{labels[on] && fmt(labels[on])}</span><span>{labels.length > 0 && fmt(labels[labels.length - 1])}</span></div>
    </div>
  );
}
