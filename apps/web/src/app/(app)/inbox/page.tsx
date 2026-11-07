"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { btn, inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

type Msg = { id: string; sender: "CONTACT" | "BOT" | "HUMAN"; direction: "IN" | "OUT"; text: string; createdAt: string };
type Contact = { id: string; name: string | null; phone: string | null; interest: string | null; tags: string[]; channel: string; botPaused: boolean; leadSentAt: string | null; createdAt: string;
  source?: string | null; sourceDetail?: string | null; utm?: any; messages: Msg[] };

const CANAL: Record<string, string> = { INSTAGRAM_DM: "Direct", INSTAGRAM_COMMENT: "Comentário", WHATSAPP: "WhatsApp" };
const ORIGEM: Record<string, string> = { dm: "Direct", comment: "Comentário", story_reply: "Resposta a story", story_mention: "Menção em story", ad: "Anúncio", ref: "Link" };
const nome = (c: Contact) => c.name ?? c.phone ?? "Contato";
const hue = (s: string) => [...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
const hm = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = (d: string) => {
  const x = new Date(d), diff = Math.round((+new Date(new Date().toDateString()) - +new Date(x.toDateString())) / 864e5);
  return diff === 0 ? "Hoje" : diff === 1 ? "Ontem" : x.toLocaleDateString("pt-BR");
};
const Avatar = ({ c, size = 44 }: { c: Contact; size?: number }) => (
  <div className="flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ width: size, height: size, background: `hsl(${hue(nome(c))} 50% 42%)` }}>{nome(c)[0]?.toUpperCase()}</div>);

function Inner() {
  const { current } = useWorkspace();
  const sp = useSearchParams();
  const canal = sp.get("canal") ?? "", soLeads = sp.get("lead") === "1";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState<Contact | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<"tudo" | "leads" | "humano">("tudo");
  const [err, setErr] = useState("");

  useEffect(() => { // troca de cliente ou filtro: recarrega, sem misturar conversas
    setContacts([]); setOpen(null); setMsgs([]); setErr("");
    if (!current) return;
    const qs = new URLSearchParams();
    if (q) qs.set("q", q); if (canal) qs.set("channel", canal); if (soLeads) qs.set("lead", "1");
    const t = setTimeout(() => api<Contact[]>(`workspaces/${current.id}/contacts?${qs}`).then(setContacts).catch((e) => setErr(e.message)), 300);
    return () => clearTimeout(t);
  }, [current?.id, q, canal, soLeads]);

  useEffect(() => { setMsgs([]); if (open) api<Msg[]>(`contacts/${open.id}/messages`).then(setMsgs).catch((e) => setErr(e.message)); }, [open?.id]);

  const shown = useMemo(() => contacts.filter((c) => chip === "tudo" || (chip === "leads" ? !!c.leadSentAt : c.botPaused)), [contacts, chip]);
  async function toggleIA() {
    if (!open) return;
    const botPaused = !open.botPaused;
    try { await api(`contacts/${open.id}`, { method: "PATCH", body: JSON.stringify({ botPaused }) }); setOpen({ ...open, botPaused }); setContacts((l) => l.map((c) => (c.id === open.id ? { ...c, botPaused } : c))); }
    catch (e: any) { setErr(e.message); }
  }

  if (!current) return <p className="p-8 text-sm opacity-60">Selecione um cliente no topo para ver as conversas.</p>;
  return (
    <div className="inbox" data-open={open ? "1" : "0"}>
      {/* lista de conversas */}
      <section className="inbox-list flex flex-col border-r border-black/10 dark:border-white/10">
        <div className="space-y-3 p-4 pb-2">
          <h1 className="text-lg font-semibold">Conversas</h1>
          <input className={inp + " !rounded-full"} placeholder="Pesquisar nome, telefone ou texto" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1.5">
            {([["tudo", "Tudo"], ["leads", "Leads"], ["humano", "Humano"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setChip(k)} className={`rounded-full px-3 py-1 text-xs transition ${chip === k ? "bg-orange-500 text-white" : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"}`}>{l}</button>))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {err && <p className="p-4 text-sm text-red-500">{err}</p>}
          {shown.map((c) => {
            const last = c.messages[0];
            return (
              <button key={c.id} onClick={() => setOpen(c)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5 ${open?.id === c.id ? "bg-black/5 dark:bg-white/10" : ""}`}>
                <Avatar c={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-medium">{nome(c)}</span><span className="shrink-0 text-[11px] opacity-50">{last && hm(last.createdAt)}</span></div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs opacity-60">{last ? `${last.direction === "OUT" ? "Você: " : ""}${last.text}` : "—"}</span>
                    {c.leadSentAt && <span className="chip !px-2 text-[10px]">Lead</span>}{c.botPaused && <span className="chip !px-2 text-[10px]">Humano</span>}
                  </div>
                </div>
              </button>);
          })}
          {!shown.length && !err && <p className="p-6 text-center text-sm opacity-50">Nenhuma conversa ainda.</p>}
        </div>
      </section>

      {/* conversa */}
      <section className="inbox-chat flex flex-col">
        {open ? (<>
          <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
            <button className="back rounded-full border border-black/10 px-2.5 py-1 text-xs dark:border-white/15" onClick={() => setOpen(null)}>←</button>
            <Avatar c={open} size={40} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{nome(open)}</div><div className="truncate text-xs opacity-60">{[CANAL[open.channel], open.phone, open.interest].filter(Boolean).join(" · ")}</div></div>
            <button onClick={toggleIA} role="switch" aria-checked={!open.botPaused} title="Alterna entre o bot/IA responder ou você assumir a conversa"
              className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
              <span className={`relative h-4 w-7 rounded-full transition-colors ${open.botPaused ? "bg-zinc-400/50" : "bg-emerald-500"}`}><i className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${open.botPaused ? "left-0.5" : "left-3.5"}`} /></span>
              {open.botPaused ? "Humano no controle" : "Bot/IA ativo"}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-5 py-4">
            {msgs.map((m, i) => (
              <div key={m.id} className="flex flex-col">
                {(i === 0 || dia(m.createdAt) !== dia(msgs[i - 1].createdAt)) && <span className="chip mx-auto my-3 text-[11px] opacity-70">{dia(m.createdAt)}</span>}
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "IN" ? "self-start rounded-bl-md bg-black/[.06] dark:bg-white/10" : "self-end rounded-br-md bg-orange-500 text-white"}`}>
                  {m.sender === "BOT" && <div className="mb-0.5 text-[10px] opacity-70">Bot</div>}
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  <div className="mt-0.5 text-right text-[10px] opacity-60">{hm(m.createdAt)}</div>
                </div>
              </div>))}
          </div>
          <div className="flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10">
            <input disabled className={inp + " !rounded-full"} placeholder="Envio manual disponível junto com a integração do Instagram" /><button disabled className={btn}>Enviar</button>
          </div>
        </>) : <div className="flex flex-1 items-center justify-center p-8 text-sm opacity-50">Escolha uma conversa ao lado.</div>}
      </section>

      {/* dados do lead */}
      <aside className="inbox-info space-y-4 overflow-y-auto border-l border-black/10 p-5 text-sm dark:border-white/10">
        {open ? (<>
          <div className="flex flex-col items-center gap-2 text-center"><Avatar c={open} size={64} /><div className="font-medium">{nome(open)}</div></div>
          {[["Telefone", open.phone], ["Interesse", open.interest], ["Canal", CANAL[open.channel]], ["Lead captado", open.leadSentAt && `${dia(open.leadSentAt)}, ${hm(open.leadSentAt)}`]].map(([l, v]) => (
            <div key={l as string}><div className="text-[11px] uppercase tracking-wide opacity-50">{l}</div>{v || "—"}</div>))}
          <div className="space-y-1 rounded-2xl border border-black/10 p-3 dark:border-white/10">
            <div className="text-[11px] uppercase tracking-wide opacity-50">Origem</div>
            <div>{open.source ? (ORIGEM[open.source] ?? open.source) : "Não informada"}</div>
            {open.sourceDetail && <div className="text-xs opacity-70">“{open.sourceDetail}”</div>}
            {open.utm && Object.entries(open.utm).map(([k, v]) => <div key={k} className="text-xs opacity-70">{k}: {String(v)}</div>)}
          </div>
          <div><div className="mb-1 text-[11px] uppercase tracking-wide opacity-50">Tags</div><div className="flex flex-wrap gap-1">{open.tags.length ? open.tags.map((t) => <span key={t} className="chip text-xs">{t}</span>) : "—"}</div></div>
        </>) : <p className="opacity-50">—</p>}
      </aside>
    </div>
  );
}
export default function Inbox() { return <Suspense fallback={null}><Inner /></Suspense>; }
