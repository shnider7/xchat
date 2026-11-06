"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { card } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

export default function Relatorios() {
  const { current } = useWorkspace();
  const [days, setDays] = useState(30);
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setR(null); setErr("");
    if (current) api(`workspaces/${current.id}/report?days=${days}`).then(setR).catch((e) => setErr(e.message));
  }, [current?.id, days]);

  if (!current) return <p className="p-8 text-sm text-zinc-500">Selecione um cliente no topo para ver o relatório.</p>;
  const stat = (l: string, v: any) => <div className={card}><div className="text-xs text-zinc-500">{l}</div><div className="mt-1 text-2xl font-semibold">{v ?? 0}</div></div>;
  const max = Math.max(1, ...(r?.porDia ?? []).map((d: any) => d.total));
  return (
    <div className="max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Relatório · {current.name}</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="grid grid-cols-5 gap-4">
        {stat("Contatos novos", r?.contatos)}{stat("Leads enviados", r?.leads)}
        {stat("Msgs do contato", r?.mensagens?.CONTACT)}{stat("Msgs do bot", r?.mensagens?.BOT)}{stat("Msgs humanas", r?.mensagens?.HUMAN)}
      </div>
      <div className={card + " space-y-2"}>
        <div className="text-sm font-medium">Mensagens por dia</div>
        {(r?.porDia ?? []).map((d: any) => (
          <div key={d.dia} className="flex items-center gap-3 text-xs"><span className="w-20 text-zinc-500">{d.dia}</span>
            <div className="h-3 rounded bg-zinc-900" style={{ width: `${(d.total / max) * 100}%` }} /><span>{d.total}</span></div>))}
        {r && !r.porDia.length && <p className="text-sm text-zinc-400">Sem mensagens no período.</p>}
      </div>
    </div>
  );
}
