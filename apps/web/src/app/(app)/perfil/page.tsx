"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/ws";
import Canais from "../ia/Canais";
import Conta from "./Conta";
import Gestao from "./Gestao";

export default function Perfil() {
  const { current } = useWorkspace();
  const [me, setMe] = useState<any>(null);
  const [tab, setTab] = useState("conta");
  useEffect(() => { api("me").then(setMe).catch(() => {}); }, []);
  if (!me) return <p className="p-8 text-sm opacity-60">Carregando…</p>;
  const tabs = [["conta", "Conta"], ...(me.role !== "PLATFORM_ADMIN" ? [["instagram", "Instagram"], ["gestao", "Gestão de usuários"]] : [])];
  return (
    <div>
      <div className="flex gap-1 border-b border-zinc-200 px-6">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-3 text-sm ${tab === k ? "border-b-2 border-zinc-900 font-medium" : "opacity-60"}`}>{l}</button>)}
      </div>
      {tab === "conta" && <Conta />}
      {tab === "instagram" && (current ? <Canais ws={current} /> : <p className="p-8 text-sm opacity-60">Selecione uma conta no topo para conectar o Instagram.</p>)}
      {tab === "gestao" && <Gestao />}
    </div>
  );
}
