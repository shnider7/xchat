"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Admin() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("admin/metrics").then(setM).catch((e) => setErr(e.message)); }, []);
  const card = (label: string, v: any) => <div className="rounded-xl border border-zinc-200 bg-white p-5"><div className="text-xs text-zinc-500">{label}</div><div className="mt-1 text-2xl font-semibold">{v ?? "—"}</div></div>;
  return (
    <div className="space-y-4 p-8">
      <h1 className="text-lg font-semibold">Visão geral</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="grid max-w-3xl grid-cols-4 gap-4">
        {card("Clientes", m?.workspaces)}{card("Gestores", m?.gestores)}
        {card("Mensagens no mês", m?.usoMesAtual?._sum?.messages ?? 0)}{card("Chamadas de IA no mês", m?.usoMesAtual?._sum?.aiCalls ?? 0)}
      </div>
      <p className="text-xs text-zinc-500">O admin geral vê apenas números agregados, nunca clientes ou conversas.</p>
    </div>
  );
}
