"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/ws";

type Contact = { id: string; name: string | null; phone: string | null; interest: string | null; tags: string[]; messages: { text: string }[] };
type Msg = { id: string; sender: "CONTACT" | "BOT" | "HUMAN"; text: string };

export default function Inbox() {
  const { current } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState<Contact | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [err, setErr] = useState("");

  // Troca de cliente: limpa tudo, para nunca misturar conversas de clientes diferentes
  useEffect(() => {
    setContacts([]); setOpen(null); setMsgs([]); setErr("");
    if (current) api<Contact[]>(`workspaces/${current.id}/contacts`).then(setContacts).catch((e) => setErr(e.message));
  }, [current?.id]);

  useEffect(() => {
    setMsgs([]);
    if (open) api<Msg[]>(`contacts/${open.id}/messages`).then(setMsgs).catch((e) => setErr(e.message));
  }, [open?.id]);

  if (!current) return <p className="p-8 text-sm text-zinc-500">Selecione um cliente no topo para ver as conversas.</p>;

  return (
    <div className="grid h-[calc(100vh-61px)] grid-cols-[320px_1fr_260px]">
      <section className="overflow-y-auto border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4 text-xs text-zinc-500">Conversas de {current.name} · {contacts.length}</div>
        {err && <p className="p-4 text-sm text-red-600">{err}</p>}
        {contacts.map((c) => (
          <button key={c.id} onClick={() => setOpen(c)} className={`block w-full border-b border-zinc-100 p-4 text-left ${open?.id === c.id ? "bg-zinc-50" : ""}`}>
            <div className="text-sm font-medium">{c.name ?? c.phone}</div>
            <div className="mt-1 truncate text-xs text-zinc-500">{c.messages[0]?.text ?? "—"}</div>
          </button>))}
        {!contacts.length && !err && <p className="p-4 text-sm text-zinc-400">Nenhuma conversa ainda.</p>}
      </section>
      <section className="flex flex-col gap-3 overflow-y-auto p-6">
        {open ? msgs.map((m) => (
          <div key={m.id} className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${m.sender === "CONTACT" ? "self-start border border-zinc-200 bg-white" : "self-end bg-zinc-900 text-white"}`}>{m.text}</div>
        )) : <p className="text-sm text-zinc-400">Escolha uma conversa.</p>}
      </section>
      <aside className="space-y-3 border-l border-zinc-200 bg-white p-5 text-sm">
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
