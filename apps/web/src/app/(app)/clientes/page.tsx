"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

export default function Clientes() {
  const { list, current, select, reload } = useWorkspace();
  const [f, setF] = useState({ name: "", clientEmail: "", instagram: "", evolutionInstance: "", leadDestination: "" });
  const [msg, setMsg] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function criar(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    try {
      const d = await api("workspaces", { method: "POST", body: JSON.stringify(body) });
      setMsg(d.senhaTemporaria ? `Cliente criado. Senha temporária do cliente (aparece só agora): ${d.senhaTemporaria}` : "Cliente criado.");
      setF({ name: "", clientEmail: "", instagram: "", evolutionInstance: "", leadDestination: "" });
      await reload(); select(d.workspace.id);
    } catch (e: any) { setMsg(e.message); }
  }
  return (
    <div className="grid max-w-5xl gap-6 p-8 lg:grid-cols-2">
      <form onSubmit={criar} className={card + " space-y-3"}>
        <h1 className="text-lg font-semibold">Novo cliente</h1>
        <input className={inp} placeholder="Nome do cliente" required value={f.name} onChange={set("name")} />
        <input className={inp} type="email" placeholder="Email do cliente (cria o acesso dele)" value={f.clientEmail} onChange={set("clientEmail")} />
        <input className={inp} placeholder="Instagram (@usuario)" value={f.instagram} onChange={set("instagram")} />
        <input className={inp} placeholder="Nome da instância na Evolution" value={f.evolutionInstance} onChange={set("evolutionInstance")} />
        <input className={inp} placeholder="Destino dos leads (número ou grupo @g.us)" value={f.leadDestination} onChange={set("leadDestination")} />
        <button className={btn}>Criar cliente</button>
        {msg && <p className="break-all rounded-lg bg-zinc-100 p-3 text-sm">{msg}</p>}
      </form>
      <div className={card + " !p-0"}>
        <div className="border-b border-zinc-100 p-4 text-sm font-medium">Seus clientes · {list.length}</div>
        {list.map((w) => (
          <div key={w.id} className="flex items-center justify-between border-b border-zinc-100 p-4 text-sm">
            <div><div className="font-medium">{w.name}</div><div className="text-xs text-zinc-500">{w.instagram ?? "sem Instagram"} · {w.clientEmail ?? "sem acesso do cliente"}</div></div>
            <button onClick={() => select(w.id)} className={btn2}>{current?.id === w.id ? "Selecionado" : "Selecionar"}</button>
          </div>))}
      </div>
    </div>
  );
}
