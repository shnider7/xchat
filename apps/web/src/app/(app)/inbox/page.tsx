"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

type Contact = { id: string; name: string | null; phone: string | null; interest: string | null; tags: string[]; channel: string; messages: { text: string }[] };
type Msg = { id: string; sender: "CONTACT" | "BOT" | "HUMAN"; text: string };
const CANAIS: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM_DM: "Direct do Instagram", INSTAGRAM_COMMENT: "Comentários do Instagram" };

function InboxInner() {
  const sp = useSearchParams();
  const { current } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState<Contact | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [err, setErr] = useState("");
  const [fl, setFl] = useState({ q: "", channel: "", lead: false, tag: "" });
  useEffect(() => { setFl((f) => ({ ...f, channel: sp.get("canal") ?? "", lead: sp.get("lead") === "1" })); }, [sp]);

  useEffect(() => { // troca de cliente ou de filtro: recarrega, sem misturar conversas
    setContacts([]); setOpen(null); setMsgs([]); setErr("");
    if (!current) return;
    const qs = new URLSearchParams();
    if (fl.q) qs.set("q", fl.q); if (fl.channel) qs.set("channel", fl.channel); if (fl.lead) qs.set("lead", "1"); if (fl.tag) qs.set("tag", fl.tag);
    const t = setTimeout(() => api<Contact[]>(`workspaces/${current.id}/contacts?${qs}`).then(setContacts).catch((e) => setErr(e.message)), 300);
    return () => clearTimeout(t);
  }, [current?.id, fl.q, fl.channel, fl.lead, fl.tag]);

  useEffect(() => { setMsgs([]); if (open) api<Msg[]>(`contacts/${open.id}/messages`).then(setMsgs).catch((e) => setErr(e.message)); }, [open?.id]);

  if (!current) return <p className="p-8 text-sm text-zinc-500">Selecione um cliente no topo para ver as conversas.</p>;
  return (
    <div className="inbox" data-open={open ? "1" : "0"}>
      <section className="inbox-list flex flex-col overflow-hidden border-r border-zinc-200 bg-white">
        <div className="space-y-2 border-b border-zinc-200 p-3">
          <input className={inp} placeholder="Buscar nome, telefone ou texto" value={fl.q} onChange={(e) => setFl({ ...fl, q: e.target.value })} />
          <select className={inp} value={fl.channel} onChange={(e) => setFl({ ...fl, channel: e.target.value })}>
            <option value="">Todos os canais</option>{Object.entries(CANAIS).filter(([v]) => v !== "WHATSAPP").map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className={inp} placeholder="Filtrar por tag" value={fl.tag} onChange={(e) => setFl({ ...fl, tag: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-zinc-600"><input type="checkbox" checked={fl.lead} onChange={(e) => setFl({ ...fl, lead: e.target.checked })} /> Só leads captados</label>
        </div>
        <div className="border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">{current.name} · {contacts.length} resultado(s)</div>
        <div className="flex-1 overflow-y-auto">
          {err && <p className="p-4 text-sm text-red-600">{err}</p>}
          {contacts.map((c) => (
            <button key={c.id} onClick={() => setOpen(c)} className={`block w-full border-b border-zinc-100 p-4 text-left ${open?.id === c.id ? "bg-zinc-50" : ""}`}>
              <div className="flex justify-between text-sm"><b className="font-medium">{c.name ?? c.phone}</b><span className="text-xs text-zinc-400">{CANAIS[c.channel]}</span></div>
              <div className="mt-1 truncate text-xs text-zinc-500">{c.messages[0]?.text ?? "—"}</div>
            </button>))}
          {!contacts.length && !err && <p className="p-4 text-sm text-zinc-400">Nada encontrado.</p>}
        </div>
      </section>
      <section className="inbox-chat flex flex-col gap-3 overflow-y-auto p-6">
        {open && (
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 text-sm">
            <button className="back rounded-lg border border-zinc-300 bg-white/60 px-2.5 py-1 text-xs" onClick={() => setOpen(null)}>← Voltar</button>
            <b className="font-medium">{open.name ?? open.phone}</b>
            <span className="opacity-60">{[open.phone, open.interest].filter(Boolean).join(" · ")}</span>
          </div>)}
        {open ? msgs.map((m) => <div key={m.id} className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${m.sender === "CONTACT" ? "self-start border border-zinc-200 bg-white" : "self-end bg-zinc-900 text-white"}`}>{m.text}</div>)
          : <p className="text-sm text-zinc-400">Escolha uma conversa.</p>}
      </section>
      <aside className="inbox-info space-y-3 border-l border-zinc-200 bg-white p-5 text-sm">
        <b>Contato</b>
        {open ? <>
          <div><div className="text-xs text-zinc-500">Nome</div>{open.name ?? "—"}</div>
          <div><div className="text-xs text-zinc-500">Telefone</div>{open.phone ?? "—"}</div>
          <div><div className="text-xs text-zinc-500">Interesse</div>{open.interest ?? "—"}</div>
          <div className="flex flex-wrap gap-1">{open.tags.map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{t}</span>)}</div>
        </> : <p className="text-zinc-400">—</p>}
      </aside>
    </div>
  );
}

export default function Inbox() { return <Suspense fallback={null}><InboxInner /></Suspense>; }
