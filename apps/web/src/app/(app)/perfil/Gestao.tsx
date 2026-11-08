"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

const ST: Record<string, string> = { PENDING: "Aguardando aceite", ACCEPTED: "Vinculada", DECLINED: "Recusada" };

// Qualquer conta pode: (1) convidar outras contas para gerenciar; (2) aceitar, recusar ou revogar quem gerencia a sua
export default function Gestao() {
  const { reload } = useWorkspace();
  const [me, setMe] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { setMe(await api("me")); setLinks(await api("managers/links")); setInvites(await api("me/invites")); }, []);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);
  async function run(fn: () => Promise<any>, ok?: string) { setMsg(""); try { await fn(); if (ok) setMsg(ok); await load(); await reload(); } catch (e: any) { setMsg(e.message); } }
  if (!me) return null;
  const pend = invites.filter((i) => i.status === "PENDING");

  return (
    <div className="max-w-3xl space-y-6 p-8">
      {pend.length > 0 && (
        <div className={card + " space-y-3 !border-blue-400/60"}>
          <div className="text-sm font-medium">Convites recebidos ({pend.length})</div>
          {pend.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
              <div><div className="font-medium">{i.gestor}</div><div className="text-xs opacity-60">{i.email} quer gerenciar a sua conta</div></div>
              <div className="flex gap-2"><button className={btn} onClick={() => run(() => api(`me/invites/${i.id}/accept`, { method: "POST" }), "Convite aceito.")}>Aceitar</button>
                <button className={btn2} onClick={() => run(() => api(`me/invites/${i.id}/decline`, { method: "POST" }), "Convite recusado.")}>Recusar</button></div>
            </div>))}
        </div>)}

      <div className={card + " space-y-4"}>
        <div className="text-sm font-medium">Contas que eu gerencio</div>
        <p className="text-xs opacity-60">Digite o email de uma conta que já existe na plataforma e tem o Instagram conectado. A pessoa recebe o convite no Perfil dela e decide se aceita. Depois de aceito, a conta aparece no seletor do topo.</p>
        {!me.totpEnabled && <p className="rounded-xl bg-amber-500/10 p-3 text-xs">Para gerenciar outras contas é preciso ativar o 2FA. <a href="/2fa" className="font-medium underline">Ativar agora</a></p>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api("managers/links", { method: "POST", body: JSON.stringify({ email }) }).then(() => setEmail("")), "Convite enviado. A conta precisa aceitar."); }}>
          <input className={inp} type="email" required placeholder="Email da conta" value={email} onChange={(e) => setEmail(e.target.value)} /><button className={btn}>Convidar</button>
        </form>
        <div className="divide-y divide-black/5 dark:divide-white/10">
          {links.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-3 text-sm">
              <div><div className="font-medium">{l.nome}</div><div className="text-xs opacity-60">{l.email} · {l.instagram ?? "sem Instagram"} · {ST[l.status] ?? l.status}</div></div>
              <button className={btn2} onClick={() => run(() => api(`managers/links/${l.id}`, { method: "DELETE" }))}>Remover</button>
            </div>))}
          {!links.length && <p className="py-3 text-sm opacity-50">Você ainda não gerencia outras contas.</p>}
        </div>
      </div>

      <div className={card + " space-y-3"}>
        <div className="text-sm font-medium">Quem gerencia a minha conta</div>
        {invites.filter((i) => i.status === "ACCEPTED").map((i) => (
          <div key={i.id} className="flex items-center justify-between text-sm">
            <div><div className="font-medium">{i.gestor}</div><div className="text-xs opacity-60">{i.email}</div></div>
            <button className={btn2} onClick={() => run(() => api(`me/invites/${i.id}/decline`, { method: "POST" }), "Acesso revogado.")}>Revogar acesso</button>
          </div>))}
        {!invites.some((i) => i.status === "ACCEPTED") && <p className="text-sm opacity-50">Ninguém gerencia a sua conta.</p>}
      </div>
      {msg && <p className="text-sm opacity-80">{msg}</p>}
    </div>
  );
}
