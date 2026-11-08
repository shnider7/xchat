"use client";
import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, Panel, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { Workspace } from "@/lib/ws";
import { nodeTypes } from "./FlowNodes";

type Bot = { id?: string; name: string; active: boolean; flow: any };
const uid = () => Math.random().toString(36).slice(2, 8);
const e = (source: string, sourceHandle: string, target: string) => ({ id: source + sourceHandle + target, source, sourceHandle, target });
const blank = () => ({ v: 2, nodes: [
  { id: "start", type: "start", position: { x: 0, y: 120 }, data: {} },
  { id: "m1", type: "message", position: { x: 380, y: 100 }, data: { text: "Olá! Como posso ajudar?" } }], edges: [e("start", "out", "m1")] });
const captacao = () => ({ v: 2, nodes: [
  { id: "start", type: "start", position: { x: 0, y: 140 }, data: {} },
  { id: "q1", type: "question", position: { x: 380, y: 0 }, data: { text: "Olá! Qual é o seu nome?", save: "nome", kind: "text" } },
  { id: "q2", type: "question", position: { x: 780, y: 0 }, data: { text: "Prazer, {nome}! Qual o seu telefone com DDD?", save: "telefone", kind: "phone" } },
  { id: "m1", type: "message", position: { x: 1180, y: 0 }, data: { text: "O que você procura?", save: "interesse", buttons: [{ id: "a", label: "Orçamento" }, { id: "b", label: "Dúvidas" }] } },
  { id: "ai", type: "ai", position: { x: 1600, y: 0 }, data: { prompt: "Responda sobre {interesse} em até 2 frases e convide para agendar.", turns: 2 } },
  { id: "ac", type: "action", position: { x: 2000, y: 0 }, data: { tag: "lead", lead: true } }],
  edges: [e("start", "out", "q1"), e("q1", "out", "q2"), e("q2", "out", "m1"), e("m1", "b_a", "ai"), e("m1", "b_b", "ai"), e("ai", "out", "ac")] });
const fresh = () => ({ state: { cur: null, vars: {}, tags: [] }, log: [] as any[], history: [] as any[], input: "" });
const ADD: [string, string][] = [["message", "+ Mensagem"], ["question", "+ Pergunta"], ["condition", "+ Condição"], ["action", "+ Ação"], ["ai", "+ IA"]];

function Editor({ ws, bot, onClose }: { ws: Workspace; bot: Bot; onClose: (changed: boolean) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>(bot.flow.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>(bot.flow.edges.map((x: any) => ({ id: x.id ?? uid(), source: x.source, sourceHandle: x.sourceHandle ?? undefined, target: x.target, animated: true })));
  const [name, setName] = useState(bot.name);
  const [active, setActive] = useState(bot.active);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState(false);
  const [sim, setSim] = useState<any>(fresh());
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const snap = useRef("");

  const flow = () => ({ v: 2, nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges: edges.map((x) => ({ id: x.id, source: x.source, sourceHandle: x.sourceHandle ?? null, target: x.target })) });
  const dirty = () => JSON.stringify({ name, active, flow: flow() }) !== snap.current;
  function cancel() { if (dirty() && !confirm("Descartar as alterações feitas neste chatbot?")) return; onClose(false); }

  useEffect(() => { setMounted(true); setDark(document.documentElement.classList.contains("dark")); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { if (mounted && !snap.current) snap.current = JSON.stringify({ name, active, flow: flow() }); }, [mounted]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); });

  // um botão/saída tem só 1 destino: ligar de novo troca a conexão
  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge(c, es.filter((x) => !(x.source === c.source && x.sourceHandle === c.sourceHandle))).map((x) => ({ ...x, animated: true }))), [setEdges]);
  const add = (type: string) => setNodes((ns) => [...ns, { id: uid(), type, position: { x: 200 + ns.length * 24, y: 80 + ns.length * 24 }, data: {} }]);

  async function salvar() {
    setSaving(true); setMsg("");
    try {
      const body = JSON.stringify({ name, active, flow: flow() });
      if (bot.id) await api(`chatbots/${bot.id}`, { method: "PATCH", body }); else await api(`workspaces/${ws.id}/chatbots`, { method: "POST", body });
      onClose(true);
    } catch (er: any) { setMsg(er.message); setSaving(false); }
  }
  async function excluir() {
    if (!bot.id || !confirm("Excluir este chatbot de vez?")) return;
    try { await api(`chatbots/${bot.id}`, { method: "DELETE" }); onClose(true); } catch (er: any) { setMsg(er.message); }
  }
  async function testar(message: string | null, reset = false) {
    const st = reset ? fresh().state : sim.state, hist = reset ? [] : sim.history;
    const log = reset ? [] : [...sim.log, ...(message ? [{ me: true, text: message }] : [])];
    try {
      const d = await api(`workspaces/${ws.id}/chatbot-simulate`, { method: "POST", body: JSON.stringify({ flow: flow(), message, state: st, history: hist }) });
      setNodes((ns) => ns.map((n) => ({ ...n, className: n.id === d.state.cur ? "rounded-2xl ring-2 ring-blue-400" : "" })));
      setSim({ state: d.state, input: "", log: [...log, ...d.replies.map((t: string) => ({ me: false, text: t }))],
        history: [...hist, ...(message ? [{ role: "user", content: message }] : []), ...d.replies.map((t: string) => ({ role: "assistant", content: t }))] });
      window.dispatchEvent(new Event("ai-usage-updated"));
    } catch (er: any) { setMsg(er.message); }
  }

  if (!mounted) return null;
  // Portal: a tela do editor cobre o painel inteiro; só sai dela por Salvar ou Cancelar
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/40 p-3 backdrop-blur-sm">
      <div className="glass flex h-full flex-col overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-5 py-3 dark:border-white/10">
          <input className={inp + " !w-64"} value={name} onChange={(x) => setName(x.target.value)} aria-label="Nome do chatbot" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(x) => setActive(x.target.checked)} /> Ativo</label>
          {bot.id && <button className="text-xs text-red-500 opacity-70 transition hover:opacity-100" onClick={excluir}>Excluir chatbot</button>}
          {msg && <span className="text-sm text-red-500">{msg}</span>}
          <span className="ml-auto flex items-center gap-2">
            <button className={btn2} onClick={() => { setTest(!test); if (!test) testar(null, true); }}>{test ? "Fechar teste" : "Testar"}</button>
            <button className={btn2} onClick={cancel}>Cancelar</button>
            <button className={btn} onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
          </span>
        </div>
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes}
              fitView minZoom={0.2} colorMode={dark ? "dark" : "light"} style={{ background: "transparent" }} defaultEdgeOptions={{ animated: true }}>
              <Background /><Controls /><MiniMap pannable zoomable />
              <Panel position="top-left" className="flex flex-wrap gap-1">{ADD.map(([t, l]) => <button key={t} className={btn2 + " !py-1.5 text-xs"} onClick={() => add(t)}>{l}</button>)}</Panel>
              <Panel position="bottom-center"><p className="text-[11px] opacity-60">Arraste do ponto laranja até outro passo para ligar. Selecione uma linha e aperte Backspace para remover.</p></Panel>
            </ReactFlow>
          </div>
          {test && (
            <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex items-center justify-between"><b className="text-sm">Testar</b><button className={btn2 + " !px-3 !py-1.5 text-xs"} onClick={() => testar(null, true)}>Reiniciar</button></div>
              <div className="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-black/[.04] p-3 dark:bg-white/5">
                {sim.log.map((l: any, i: number) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${l.me ? "self-end bg-blue-500 text-white" : "bg-black/[.06] dark:bg-white/10"}`}>{l.text}</div>)}
              </div>
              <div className="rounded-xl bg-black/[.04] p-3 text-xs opacity-80 dark:bg-white/5">
                <b>Guardado:</b> {Object.keys(sim.state.vars).length ? Object.entries(sim.state.vars).map(([k, v]) => `${k}=${v}`).join(" · ") : "—"}<br />
                <b>Tags:</b> {sim.state.tags.length ? sim.state.tags.join(", ") : "—"}{sim.state.done && <><br /><b>Fluxo concluído</b></>}
              </div>
              <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); if (sim.input.trim()) testar(sim.input.trim()); }}>
                <input className={inp} placeholder="Responder…" value={sim.input} onChange={(x) => setSim({ ...sim, input: x.target.value })} /><button className={btn}>Enviar</button>
              </form>
            </div>)}
        </div>
      </div>
    </div>, document.body);
}

export default function Chatbots({ ws }: { ws: Workspace }) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [bot, setBot] = useState<Bot | null>(null);
  const [k, setK] = useState(0);
  const load = useCallback(() => api<Bot[]>(`workspaces/${ws.id}/chatbots`).then(setBots).catch(() => {}), [ws.id]);
  useEffect(() => { setBot(null); load(); }, [load]);
  const open = (b: Bot) => { setBot(b); setK((x) => x + 1); };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => open({ name: "Novo chatbot", active: true, flow: blank() })}>+ Em branco</button>
        <button className={btn2} onClick={() => open({ name: "Captação de leads", active: true, flow: captacao() })}>+ Modelo de captação de leads</button>
      </div>
      {!bots.length && <p className="text-sm opacity-60">Nenhum chatbot ainda. Crie um em branco ou comece pelo modelo. O editor abre em tela própria e dá para testar sem nenhum canal conectado.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {bots.map((b) => (
          <button key={b.id} onClick={() => open(b)} className="glass lift rounded-2xl p-4 text-left">
            <div className="flex items-center justify-between"><span className="font-medium">{b.name}</span><span className={`chip text-[11px] ${b.active ? "" : "opacity-60"}`}>{b.active ? "Ativo" : "Pausado"}</span></div>
            <div className="mt-1 text-xs opacity-60">{b.flow.nodes.length} passos</div>
          </button>))}
      </div>
      {bot && <Editor key={k} ws={ws} bot={bot} onClose={(changed) => { setBot(null); if (changed) load(); }} />}
    </div>
  );
}
