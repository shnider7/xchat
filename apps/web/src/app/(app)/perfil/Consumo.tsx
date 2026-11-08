"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/ws";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Consumo() {
  const { current } = useWorkspace();
  const [u, setU] = useState<any>(null);
  useEffect(() => { setU(null); if (current) api(`workspaces/${current.id}/ai-usage`).then(setU).catch(() => {}); }, [current?.id]);
  if (!current || !u) return null;
  const pct = Math.min(100, Math.round(u.orcamentoBrl > 0 ? (u.custoBrl / u.orcamentoBrl) * 100 : (u.respostas / Math.max(1, u.limiteRespostas)) * 100));
  return (
    <section className="space-y-3 border-t border-black/5 py-5 dark:border-white/10">
      <h3 className="text-[11px] font-medium uppercase tracking-wider opacity-50">Consumo de IA no mês (estimativa)</h3>
      <div className="flex items-end justify-between"><div className="text-2xl font-semibold">{brl(u.custoBrl)}</div><div className="text-xs opacity-60">{u.respostas} respostas · {(u.tokensEntrada + u.tokensSaida).toLocaleString("pt-BR")} tokens</div></div>
      <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
      <p className="text-xs opacity-60">{u.orcamentoBrl > 0 ? `Meta mensal: ${brl(u.orcamentoBrl)}.` : `Limite do mês: ${u.limiteRespostas} respostas.`} É uma estimativa pelos tokens usados, com dólar e IOF aproximados. A cobrança real vem do seu provedor de IA, além da mensalidade da plataforma.</p>
    </section>
  );
}
