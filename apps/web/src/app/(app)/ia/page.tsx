"use client";
import { useState } from "react";
import { useWorkspace } from "@/lib/ws";
import Canais from "./Canais";
import Chatbots from "./Chatbots";
import Config from "./Config";

const TABS = [["bots", "Chatbots"], ["ia", "IA e API"], ["canais", "Canais"]] as const;

export default function IA() {
  const { current } = useWorkspace();
  const [tab, setTab] = useState<string>("bots");
  if (!current) return <p className="p-8 text-sm text-zinc-500">Selecione um cliente no topo para configurar chatbots, IA e canais.</p>;
  return (
    <div>
      <div className="flex gap-1 border-b border-zinc-200 bg-white px-6">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-3 text-sm ${tab === k ? "border-b-2 border-zinc-900 font-medium" : "text-zinc-500"}`}>{l}</button>))}
      </div>
      {tab === "bots" && <Chatbots ws={current} />}
      {tab === "ia" && <Config />}
      {tab === "canais" && <Canais ws={current} />}
    </div>
  );
}
