"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { DonutChart, LineChart, fillDays } from "@/lib/charts";
import { card } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";
import NoWorkspace from "@/lib/NoWorkspace";

// O período (7, 30 ou 90 dias) vem do submenu da barra superior: ?dias=7
function Inner() {
  const { current } = useWorkspace();
  const d = Number(useSearchParams().get("dias") ?? 30);
  const days = [7, 30, 90].includes(d) ? d : 30;
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setR(null); setErr("");
    if (current) api(`workspaces/${current.id}/report?days=${days}`).then(setR).catch((e) => setErr(e.message));
  }, [current?.id, days]);

  if (!current) return <NoWorkspace what="o relatório" />;
  const m = r?.mensagens ?? {};
  const serie = r ? fillDays(r.porDia, days) : { labels: [], data: [] };
  const kpi = (l: string, v: any) => <div className={card + " lift !p-5"}><div className="text-xs opacity-60">{l}</div><div className="mt-1 text-2xl font-semibold">{v ?? 0}</div></div>;
  return (
    <div className="space-y-4 p-8">
      <h1 className="text-lg font-semibold">Relatório · {current.name}</h1>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <div className="kpis">
        {kpi("Contatos novos", r?.contatos)}{kpi("Leads enviados", r?.leads)}{kpi("Msgs do contato", m.CONTACT)}{kpi("Msgs do bot", m.BOT)}
      </div>
      {r && (
        <div className="dash-2">
          <div className={card}><div className="mb-3 text-sm font-medium">Mensagens por dia</div>
            <LineChart labels={serie.labels} series={[{ name: "Mensagens", color: "#f97316", data: serie.data }]} /></div>
          <div className={card}><div className="mb-3 text-sm font-medium">Quem respondeu</div>
            <DonutChart center="mensagens" data={[{ name: "Contato", value: m.CONTACT ?? 0 }, { name: "Bot", value: m.BOT ?? 0 }, { name: "Humano", value: m.HUMAN ?? 0 }]} /></div>
        </div>)}
    </div>
  );
}
export default function Relatorios() { return <Suspense fallback={null}><Inner /></Suspense>; }
