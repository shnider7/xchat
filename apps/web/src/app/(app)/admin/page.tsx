"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DonutChart, LineChart, PillBars, fillDays } from "@/lib/charts";
import { card } from "@/lib/ui";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Admin() {
  const [o, setO] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("admin/overview").then(setO).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="p-8 text-sm text-red-500">{err}</p>;
  if (!o) return <p className="p-8 text-sm opacity-60">Carregando…</p>;

  const ativos = fillDays(o.ativos, 30), novos = fillDays(o.novos, 30), msgs = fillDays(o.mensagens, 14);
  const kpi = (label: string, value: string | number, hint: string) => (
    <div className={card + " lift !p-5"}><div className="text-xs opacity-60">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div><div className="mt-1 text-[11px] opacity-50">{hint}</div></div>);

  return (
    <div className="space-y-4 p-8">
      <div><h1 className="text-lg font-semibold">Visão geral</h1><p className="text-xs opacity-60">Só números agregados. O admin da plataforma não vê clientes nem conversas.</p></div>
      {o.kpis.aVencer > 0 && <a href="/usuarios?s=expiring" className={card + " lift block !border-amber-400/60 !p-4 text-sm"}>⚠ {o.kpis.aVencer} conta(s) vencem em até 7 dias. Nada é desativado sozinho: veja a lista e decida.</a>}
      <div className="kpis">
        {kpi("Contas", o.kpis.contas, `${o.kpis.workspaces} espaços de trabalho`)}
        {kpi("Aguardando ativação", o.kpis.inativas, "contas novas ou desativadas")}
        {kpi("Ativos em 7 dias", o.kpis.ativos7d, "contas que entraram")}
        {kpi("Receita estimada/mês", brl(o.kpis.mrr), `contas ativas × ${brl(o.kpis.precoPlano)} (ainda sem cobrança)`)}
      </div>
      <div className="dash-2">
        <div className={card}><div className="mb-3 text-sm font-medium">Usuários ativos por dia</div>
          <LineChart labels={ativos.labels} series={[{ name: "Ativos", color: "#f97316", data: ativos.data }, { name: "Novos cadastros", color: "#60a5fa", data: novos.data }]} /></div>
        <div className={card}><div className="mb-3 text-sm font-medium">Contas por situação</div><DonutChart data={o.porStatus} center="contas" /></div>
      </div>
      <div className="dash-2">
        <div className={card}><div className="mb-3 text-sm font-medium">Mensagens por dia (14 dias)</div><PillBars labels={msgs.labels} data={msgs.data} /></div>
        <div className={card}><div className="mb-3 text-sm font-medium">Assinaturas</div><DonutChart data={o.assinaturas} center="contas" />
          <p className="mt-3 text-[11px] opacity-50">IA este mês: {o.ia.chamadas} respostas · {o.ia.mensagens} mensagens · IA estimada ≈ {brl(o.ia.custoBrl)}</p></div>
      </div>
    </div>
  );
}
