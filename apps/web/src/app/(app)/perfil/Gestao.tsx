"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

const ST: Record<string, string> = { PENDING: "Aguardando aceite", ACCEPTED: "Vinculada", DECLINED: "Recusada" };

export default function Gestao() {
  const { reload } = useWorkspace();
  const [me, setMe] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const u = await api("me"); setMe(u);
    if (u.role === "MANAGER") setLinks(await api("managers/links"));
    if (u.role === "CLIENT") setInvites(await api("me/invites"));
  }, []);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  async function run(fn: () => Promise<any>, ok?: string) {
    setMsg("");
    try { await fn(); if (ok) setMsg(ok); await load(); await reload(); } catch (e: any) { setMsg(e.message); }
  }
  if (!me) return <p className="p-8 text-sm text-zinc-500">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className={card + " space-y-1 text-sm"}>
        <div><span className="text-zinc-500">Nome:</span> {me.name}</div>
        <div><span className="text-zinc-500">Email:</span> {me.email}</div>
        <div><span className="text-zinc-500">Tipo:</span> {me.role === "MANAGER" ? "Gestor" : "Conta"}</div>
      </div>

      {me.role === "MANAGER" && (
        <div className={card + " space-y-4"}>
          <div className="text-sm font-medium">Gestão de usuários</div>
          <p className="text-xs text-zinc-500">Só dá para adicionar contas que já estão cadastradas na plataforma e têm o Instagram conectado (1 por conta). A pessoa precisa aceitar o convite no Perfil dela.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api("managers/links", { method: "POST", body: JSON.stringify({ email }) }).then(() => setEmail("")), "Convite enviado. A conta precisa aceitar."); }}>
            <input className={inp} type="email" required placeholder="Email da conta na plataforma" value={email} onChange={(e) => setEmail(e.target.value)} /><button className={btn}>Adicionar</button>
          </form>
          <div className="divide-y divide-zinc-100">
            {links.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-3 text-sm">
                <div><div className="font-medium">{l.nome}</div><div className="text-xs text-zinc-500">{l.email} · {l.instagram ?? "sem Instagram"} · {ST[l.status] ?? l.status}</div></div>
                <button className={btn2} onClick={() => run(() => api(`managers/links/${l.id}`, { method: "DELETE" }))}>Remover</button>
              </div>))}
            {!links.length && <p className="py-3 text-sm text-zinc-400">Nenhuma conta vinculada ainda.</p>}
          </div>
        </div>
      )}

      {me.role === "CLIENT" && (
        <div className={card + " space-y-3"}>
          <div className="text-sm font-medium">Gestores com acesso à sua conta</div>
          {invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-sm">
              <div><div className="font-medium">{i.gestor}</div><div className="text-xs text-zinc-500">{i.email} · {ST[i.status]}</div></div>
              <div className="flex gap-2">
                {i.status === "PENDING" && <button className={btn} onClick={() => run(() => api(`me/invites/${i.id}/accept`, { method: "POST" }))}>Aceitar</button>}
                <button className={btn2} onClick={() => run(() => api(`me/invites/${i.id}/decline`, { method: "POST" }))}>{i.status === "PENDING" ? "Recusar" : "Revogar acesso"}</button>
              </div>
            </div>))}
          {!invites.length && <p className="text-sm text-zinc-400">Nenhum gestor tem acesso à sua conta.</p>}
        </div>
      )}
      {msg && <p className="text-sm text-zinc-600">{msg}</p>}
    </div>
  );
}
