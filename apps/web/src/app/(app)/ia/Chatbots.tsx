"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { Workspace } from "@/lib/ws";

type N = { id: string; type: "message" | "question" | "options" | "ai" | "lead"; text?: string; save?: string; options?: { label: string; goto?: string }[]; prompt?: string; turns?: number };
type Bot = { id?: string; name: string; trigger?: string | null; active: boolean; nodes: N[] };
const TIPOS: Record<string, string> = { message: "Mensagem", question: "Pergunta (guarda a resposta)", options: "Menu de opções", ai: "IA responde", lead: "Enviar lead ao grupo" };
const uid = () => "s" + Math.random().toString(36).slice(2, 8);
const novo = (): Bot => ({ name: "Novo chatbot", trigger: "", active: true, nodes: [{ id: uid(), type: "message", text: "Olá! Como posso ajudar?" }] });

export default function Chatbots({ ws }: { ws: Workspace }) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [bot, setBot] = useState<Bot | null>(null);
  const [msg, setMsg] = useState("");
  const [sim, setSim] = useState<any>({ state: { idx: 0, vars: {} }, log: [], history: [], input: "" });
  const load = useCallback(() => api<Bot[]>(`workspaces/${ws.id}/chatbots`).then(setBots).catch((e) => setMsg(e.message)), [ws.id]);
  useEffect(() => { setBot(null); load(); }, [load]);

  const upd = (i: number, p: Partial<N>) => setBot((b) => b && { ...b, nodes: b.nodes.map((n, k) => (k === i ? { ...n, ...p } : n)) });
  const move = (i: number, d: number) => setBot((b) => { if (!b) return b; const a = [...b.nodes]; const j = i + d; if (j < 0 || j >= a.length) return b; [a[i], a[j]] = [a[j], a[i]]; return { ...b, nodes: a }; });

  async function salvar() {
    if (!bot) return; setMsg("");
    try {
      const body = JSON.stringify({ name: bot.name, trigger: bot.trigger || null, active: bot.active, nodes: bot.nodes });
      const r = bot.id ? await api(`chatbots/${bot.id}`, { method: "PATCH", body }) : await api(`workspaces/${ws.id}/chatbots`, { method: "POST", body });
      setBot({ ...bot, id: r.id }); setMsg("Salvo."); load();
    } catch (e: any) { setMsg(e.message); }
  }
  async function testar(message: string | null, reset = false) {
    if (!bot) return;
    const st = reset ? { idx: 0, vars: {} } : sim.state, hist = reset ? [] : sim.history;
    const log = reset ? [] : [...sim.log, ...(message ? [{ me: true, text: message }] : [])];
    try {
      const d = await api(`workspaces/${ws.id}/chatbot-simulate`, { method: "POST", body: JSON.stringify({ nodes: bot.nodes, state: st, message, history: hist }) });
      setSim({ state: d.state, input: "", log: [...log, ...d.replies.map((t: string) => ({ me: false, text: t }))],
        history: [...hist, ...(message ? [{ role: "user", content: message }] : []), ...d.replies.map((t: string) => ({ role: "assistant", content: t }))] });
    } catch (e: any) { setMsg(e.message); }
  }

  return (
    <div className="grid gap-6 p-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {bots.map((b) => <button key={b.id} className={b.id === bot?.id ? btn : btn2} onClick={() => { setBot(b); setSim({ state: { idx: 0, vars: {} }, log: [], history: [], input: "" }); }}>{b.name}{b.active ? "" : " (pausado)"}</button>)}
          <button className={btn2} onClick={() => setBot(novo())}>+ Novo chatbot</button>
        </div>
        {!bot && <p className="text-sm text-zinc-500">Crie um chatbot ou escolha um. Não precisa de canal conectado: teste ao lado.</p>}
        {bot && <>
          <div className={card + " grid grid-cols-[1fr_1fr_auto] items-end gap-3"}>
            <label className="text-sm text-zinc-600">Nome<input className={inp} value={bot.name} onChange={(e) => setBot({ ...bot, name: e.target.value })} /></label>
            <label className="text-sm text-zinc-600">Palavra que inicia (vazio = padrão)<input className={inp} value={bot.trigger ?? ""} onChange={(e) => setBot({ ...bot, trigger: e.target.value })} /></label>
            <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={bot.active} onChange={(e) => setBot({ ...bot, active: e.target.checked })} /> Ativo</label>
          </div>
          {bot.nodes.map((n, i) => (
            <div key={n.id} className={card + " space-y-3"}>
              <div className="flex items-center gap-2">
                <b className="text-sm">Passo {i + 1}</b>
                <select className={inp + " !w-auto"} value={n.type} onChange={(e) => upd(i, { type: e.target.value as N["type"] })}>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <span className="ml-auto flex gap-1"><button className={btn2} onClick={() => move(i, -1)}>↑</button><button className={btn2} onClick={() => move(i, 1)}>↓</button>
                  <button className={btn2} onClick={() => setBot({ ...bot, nodes: bot.nodes.filter((_, k) => k !== i) })}>Remover</button></span>
              </div>
              {n.type !== "lead" && <textarea rows={2} className={inp} placeholder={n.type === "ai" ? "Mensagem inicial (opcional)" : "Texto enviado. Use {nome} para variáveis."} value={n.text ?? ""} onChange={(e) => upd(i, { text: e.target.value })} />}
              {(n.type === "question" || n.type === "options") && <input className={inp} placeholder="Guardar resposta como (ex.: nome, telefone, interesse)" value={n.save ?? ""} onChange={(e) => upd(i, { save: e.target.value.replace(/\W/g, "") })} />}
              {n.type === "options" && <div className="space-y-2">
                {(n.options ?? []).map((o, k) => (
                  <div key={k} className="grid grid-cols-[1fr_180px_auto] gap-2">
                    <input className={inp} placeholder={`Opção ${k + 1}`} value={o.label} onChange={(e) => upd(i, { options: n.options!.map((x, y) => (y === k ? { ...x, label: e.target.value } : x)) })} />
                    <select className={inp} value={o.goto ?? ""} onChange={(e) => upd(i, { options: n.options!.map((x, y) => (y === k ? { ...x, goto: e.target.value || undefined } : x)) })}>
                      <option value="">Segue para o próximo</option>{bot.nodes.map((m, j) => j !== i && <option key={m.id} value={m.id}>Ir ao passo {j + 1}</option>)}</select>
                    <button className={btn2} onClick={() => upd(i, { options: n.options!.filter((_, y) => y !== k) })}>×</button>
                  </div>))}
                <button className={btn2} onClick={() => upd(i, { options: [...(n.options ?? []), { label: "" }] })}>+ Opção</button>
              </div>}
              {n.type === "ai" && <>
                <textarea rows={3} className={inp} placeholder="Como a IA deve responder neste passo (ex.: responda com base no interesse {interesse}, em até 2 frases)" value={n.prompt ?? ""} onChange={(e) => upd(i, { prompt: e.target.value })} />
                <label className="text-sm text-zinc-600">A IA responde por quantas mensagens do contato? <input type="number" min={1} max={10} className={inp + " !w-20"} value={n.turns ?? 1} onChange={(e) => upd(i, { turns: Number(e.target.value) || 1 })} /></label>
              </>}
              {n.type === "lead" && <p className="text-xs text-zinc-500">Envia o cartão ao destino configurado, usando as variáveis <b>nome</b>, <b>telefone</b> e <b>interesse</b> guardadas nos passos anteriores.</p>}
            </div>))}
          <div className="flex items-center gap-3">
            <button className={btn2} onClick={() => setBot({ ...bot, nodes: [...bot.nodes, { id: uid(), type: "message", text: "" }] })}>+ Adicionar passo</button>
            <button className={btn} onClick={salvar}>Salvar</button>
            {bot.id && <button className={btn2} onClick={async () => { await api(`chatbots/${bot.id}`, { method: "DELETE" }); setBot(null); load(); }}>Excluir</button>}
            {msg && <span className="text-sm text-zinc-600">{msg}</span>}
          </div>
        </>}
      </div>
      {bot && <div className={card + " flex h-fit flex-col gap-3"}>
        <div className="flex items-center justify-between"><b className="text-sm">Testar</b><button className={btn2} onClick={() => testar(null, true)}>Iniciar / reiniciar</button></div>
        <p className="text-xs text-zinc-500">Testa o que está na tela (mesmo sem salvar). Passos de IA usam a chave cadastrada em "IA e API".</p>
        <div className="flex max-h-96 min-h-40 flex-col gap-2 overflow-y-auto rounded-lg bg-zinc-50 p-3">
          {sim.log.map((l: any, i: number) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${l.me ? "self-end bg-zinc-900 text-white" : "border border-zinc-200 bg-white"}`}>{l.text}</div>)}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (sim.input.trim()) testar(sim.input.trim()); }}>
          <input className={inp} placeholder="Responder…" value={sim.input} onChange={(e) => setSim({ ...sim, input: e.target.value })} /><button className={btn}>Enviar</button>
        </form>
      </div>}
    </div>
  );
}
