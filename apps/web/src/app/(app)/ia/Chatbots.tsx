"use client";
import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, Panel, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
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

function Editor({ ws, bot, onSaved, onDeleted }: { ws: Workspace; bot: Bot; onSaved: (b: Bot) => void; onDeleted: () => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>(bot.flow.nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>(bot.flow.edges.map((x: any) => ({ id: x.id ?? uid(), source: x.source, sourceHandle: x.sourceHandle ?? undefined, target: x.target, animated: true })));
  const [name, setName] = useState(bot.name);
  const [active, setActive] = useState(bot.active);
  const [msg, setMsg] = useState("");
  const [test, setTest] = useState(false);
  const [sim, setSim] = useState<any>(fresh());
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  // um botão/saída tem só 1 destino: ligar de novo troca a conexão
  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge(c, es.filter((x) => !(x.source === c.source && x.sourceHandle === c.sourceHandle))).map((x) => ({ ...x, animated: true }))), [setEdges]);
  const add = (type: string) => setNodes((ns) => [...ns, { id: uid(), type, position: { x: 200 + ns.length * 24, y: 80 + ns.length * 24 }, data: {} }]);
  const flow = () => ({ v: 2, nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges: edges.map((x) => ({ id: x.id, source: x.source, sourceHandle: x.sourceHandle ?? null, target: x.target })) });

  async function salvar() {
    setMsg("");
    try {
      const body = JSON.stringify({ name, active, flow: flow() });
      const r = bot.id ? await api(`chatbots/${bot.id}`, { method: "PATCH", body }) : await api(`workspaces/${ws.id}/chatbots`, { method: "POST", body });
      onSaved({ id: r.id, name, active, flow: bot.flow }); setMsg("Salvo.");
    } catch (er: any) { setMsg(er.message); }
  }
  async function testar(message: string | null, reset = false) {
    const st = reset ? fresh().state : sim.state, hist = reset ? [] : sim.history;
    const log = reset ? [] : [...sim.log, ...(message ? [{ me: true, text: message }] : [])];
    try {
      const d = await api(`workspaces/${ws.id}/chatbot-simulate`, { method: "POST", body: JSON.stringify({ flow: flow(), message, state: st, history: hist }) });
      setNodes((ns) => ns.map((n) => ({ ...n, className: n.id === d.state.cur ? "rounded-2xl ring-2 ring-orange-400" : "" })));
      setSim({ state: d.state, input: "", log: [...log, ...d.replies.map((t: string) => ({ me: false, text: t }))],
        history: [...hist, ...(message ? [{ role: "user", content: message }] : []), ...d.replies.map((t: string) => ({ role: "assistant", content: t }))] });
    } catch (er: any) { setMsg(er.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={inp + " !w-64"} value={name} onChange={(x) => setName(x.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(x) => setActive(x.target.checked)} /> Ativo</label>
        <span className="ml-auto flex gap-2">
          <button className={btn2} onClick={() => { setTest(!test); if (!test) testar(null, true); }}>{test ? "Fechar teste" : "Testar"}</button>
          <button className={btn} onClick={salvar}>Salvar</button>
          {bot.id && <button className={btn2} onClick={async () => { await api(`chatbots/${bot.id}`, { method: "DELETE" }); onDeleted(); }}>Excluir</button>}
        </span>
        {msg && <span className="text-sm opacity-80">{msg}</span>}
      </div>
      <p className="text-xs opacity-60">Arraste do ponto laranja de um passo até outro para ligar. Cada botão tem a sua própria saída. Selecione uma linha e aperte Backspace para remover.</p>
      <div className="flex gap-3">
        <div className="glass h-[calc(100vh-290px)] min-h-[480px] flex-1 overflow-hidden rounded-2xl">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes}
            fitView minZoom={0.2} colorMode={dark ? "dark" : "light"} style={{ background: "transparent" }} defaultEdgeOptions={{ animated: true }}>
            <Background /><Controls /><MiniMap pannable zoomable />
            <Panel position="top-left" className="flex flex-wrap gap-1">{ADD.map(([t, l]) => <button key={t} className={btn2 + " !py-1.5 text-xs"} onClick={() => add(t)}>{l}</button>)}</Panel>
          </ReactFlow>
        </div>
        {test && (
          <div className={card + " flex w-80 shrink-0 flex-col gap-3"}>
            <div className="flex items-center justify-between"><b className="text-sm">Testar</b><button className={btn2} onClick={() => testar(null, true)}>Reiniciar</button></div>
            <div className="flex max-h-[45vh] min-h-40 flex-col gap-2 overflow-y-auto rounded-lg bg-zinc-50 p-3">
              {sim.log.map((l: any, i: number) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${l.me ? "self-end bg-zinc-900 text-white" : "border border-zinc-200 bg-white"}`}>{l.text}</div>)}
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              <b>Guardado:</b> {Object.keys(sim.state.vars).length ? Object.entries(sim.state.vars).map(([k, v]) => `${k}=${v}`).join(" · ") : "—"}<br />
              <b>Tags:</b> {sim.state.tags.length ? sim.state.tags.join(", ") : "—"}{sim.state.done && <><br /><b>Fluxo concluído</b></>}
            </div>
            <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); if (sim.input.trim()) testar(sim.input.trim()); }}>
              <input className={inp} placeholder="Responder…" value={sim.input} onChange={(x) => setSim({ ...sim, input: x.target.value })} /><button className={btn}>Enviar</button>
            </form>
          </div>)}
      </div>
    </div>
  );
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
        {bots.map((b) => <button key={b.id} className={b.id === bot?.id ? btn : btn2} onClick={() => open(b)}>{b.name}{b.active ? "" : " (pausado)"}</button>)}
        <button className={btn2} onClick={() => open({ name: "Novo chatbot", active: true, flow: blank() })}>+ Em branco</button>
        <button className={btn2} onClick={() => open({ name: "Captação de leads", active: true, flow: captacao() })}>+ Modelo de captação de leads</button>
      </div>
      {!bot && <p className="text-sm opacity-60">Crie um chatbot ou escolha um. Não precisa de canal conectado: use o botão Testar.</p>}
      {bot && <Editor key={k} ws={ws} bot={bot} onSaved={(b) => { setBot((x) => x && { ...x, id: b.id }); load(); }} onDeleted={() => { setBot(null); load(); }} />}
    </div>
  );
}
