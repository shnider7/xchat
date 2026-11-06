"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, card, inp } from "@/lib/ui";

export default function Gestores() {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api("admin/managers").then(setList).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function criar(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try { await api("admin/managers", { method: "POST", body: JSON.stringify(f) }); setF({ name: "", email: "", password: "" }); setMsg("Gestor criado. No primeiro login ele ativa o 2FA."); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h1 className="text-lg font-semibold">Gestores</h1>
      <form onSubmit={criar} className={card + " space-y-3"}>
        <input className={inp} placeholder="Nome" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={inp} type="password" placeholder="Senha (mínimo 12 caracteres)" minLength={12} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button className={btn}>Criar gestor</button>
        {msg && <p className="text-sm text-zinc-600">{msg}</p>}
      </form>
      <div className={card + " divide-y divide-zinc-100 !p-0"}>
        {list.map((u) => <div key={u.id} className="flex justify-between p-4 text-sm"><span>{u.name} · {u.email}</span><span className="text-zinc-500">2FA {u.totpEnabled ? "ativo" : "pendente"}</span></div>)}
        {!list.length && <p className="p-4 text-sm text-zinc-400">Nenhum gestor ainda.</p>}
      </div>
    </div>
  );
}
