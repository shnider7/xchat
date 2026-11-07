"use client";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { btn2, inp } from "@/lib/ui";

const hs = { width: 12, height: 12, background: "#f97316", border: "2px solid #fff" };
const nd = "nodrag nowheel";
const I = `${inp} ${nd} !py-2 !text-xs`;
const ta = `${I} resize-none`;
const mini = `${btn2} nodrag !px-3 !py-1.5 text-xs`;
const rid = () => Math.random().toString(36).slice(2, 6);
const useSet = (id: string) => { const { updateNodeData } = useReactFlow(); return (p: object) => updateNodeData(id, p); };
const patchList = (list: any[], id: string, p: object) => list.map((x) => (x.id === id ? { ...x, ...p } : x));
const Sel = ({ value, onChange, opts, cls = "" }: { value: string; onChange: (v: string) => void; opts: [string, string][]; cls?: string }) => (
  <select className={`${I} ${cls}`} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>);
const Box = ({ children }: { children: React.ReactNode }) => <div className="space-y-1.5 rounded-xl border border-black/10 p-2 dark:border-white/10">{children}</div>;
const X = ({ onClick }: { onClick: () => void }) => <button className="nodrag px-2 opacity-60 hover:opacity-100" onClick={onClick} aria-label="Remover">×</button>;

function Shell({ id, title, color, children, start, wide }: { id: string; title: string; color: string; children: React.ReactNode; start?: boolean; wide?: boolean }) {
  const { deleteElements } = useReactFlow();
  return (
    <div className={`glass rounded-2xl p-3 text-sm ${wide ? "w-80" : "w-72"}`}>
      {!start && <Handle type="target" position={Position.Left} style={hs} />}
      <div className="mb-2 flex items-center justify-between">
        <b className={`text-xs uppercase tracking-wide ${color}`}>{title}</b>
        {!start && <button className="nodrag text-xs opacity-60 hover:opacity-100" onClick={() => deleteElements({ nodes: [{ id }] })}>Excluir</button>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
const Out = () => <Handle type="source" id="out" position={Position.Right} style={hs} />;

/* ---------- Início: gatilhos ---------- */
const TRIGGERS: [string, string][] = [["dm", "Mensagem no direct"], ["comment", "Comentário em post ou reel"], ["story_reply", "Resposta a um story"], ["story_mention", "Menção em um story"], ["ad", "Clique em anúncio"], ["ref", "Link com referência"]];
function StartNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  const triggers: any[] = d.triggers ?? (d.trigger ? [{ id: "legacy", type: "dm", match: "contains", keywords: d.trigger }] : []);
  const up = (tid: string, p: object) => set({ triggers: patchList(triggers, tid, p) });
  const cr = d.commentReply ?? { mode: "none" };
  return (
    <Shell id={id} title="Início · gatilhos" color="text-emerald-500" start wide>
      {!triggers.length && <p className="text-xs opacity-60">Sem gatilho: começa na 1ª mensagem do direct.</p>}
      {triggers.map((t) => (
        <Box key={t.id}>
          <div className="flex gap-1"><Sel value={t.type} onChange={(v) => up(t.id, { type: v })} opts={TRIGGERS} /><X onClick={() => set({ triggers: triggers.filter((x) => x.id !== t.id) })} /></div>
          <Sel value={t.match ?? "contains"} onChange={(v) => up(t.id, { match: v })} opts={[["contains", "Contém a palavra"], ["exact", "Palavra exata"], ["any", "Qualquer texto"]]} />
          {t.match !== "any" && <input className={I} placeholder="Palavras, separadas por vírgula" value={t.keywords ?? ""} onChange={(e) => up(t.id, { keywords: e.target.value })} />}
          {t.type === "comment" && <>
            <Sel value={t.scope ?? "all"} onChange={(v) => up(t.id, { scope: v })} opts={[["all", "Em qualquer post ou reel"], ["post", "Em um post específico"]]} />
            {t.scope === "post" && <input className={I} placeholder="ID ou link do post" value={t.postId ?? ""} onChange={(e) => up(t.id, { postId: e.target.value })} />}</>}
        </Box>))}
      <select className={I} value="" onChange={(e) => e.target.value && set({ triggers: [...triggers, { id: rid(), type: e.target.value, match: "contains", keywords: "", scope: "all" }] })}>
        <option value="">+ Adicionar gatilho…</option>{TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      {triggers.some((t) => t.type === "comment") && (
        <Box>
          <div className="text-xs font-medium">Resposta pública ao comentário</div>
          <Sel value={cr.mode ?? "none"} onChange={(v) => set({ commentReply: { ...cr, mode: v } })} opts={[["none", "Não responder no comentário"], ["fixed", "Texto fixo (sem IA)"], ["ai", "IA com instrução própria"]]} />
          {cr.mode === "fixed" && <textarea rows={3} className={ta} placeholder="Uma resposta por linha. Uma é sorteada a cada comentário." value={cr.variations ?? ""} onChange={(e) => set({ commentReply: { ...cr, variations: e.target.value } })} />}
          {cr.mode === "ai" && <textarea rows={3} className={ta} placeholder="Instrução da IA só para comentários (tom, tamanho, o que evitar)" value={cr.prompt ?? ""} onChange={(e) => set({ commentReply: { ...cr, prompt: e.target.value } })} />}
        </Box>)}
      <textarea rows={2} className={ta} placeholder="Instruções da IA deste chatbot (valem para todos os passos de IA dele)" value={d.aiPrompt ?? ""} onChange={(e) => set({ aiPrompt: e.target.value })} />
      <Out />
    </Shell>
  );
}

/* ---------- Mensagem: botões de resposta rápida ou link ---------- */
function MessageNode({ id, data }: NodeProps) {
  const set = useSet(id); const { setEdges } = useReactFlow(); const d: any = data;
  const btns: any[] = d.buttons ?? [];
  const isReply = (b: any) => (b.type ?? "reply") === "reply";
  const dropEdges = (bid: string) => setEdges((es) => es.filter((e) => !(e.source === id && e.sourceHandle === `b_${bid}`)));
  const up = (bid: string, p: object) => set({ buttons: patchList(btns, bid, p) });
  return (
    <Shell id={id} title="Mensagem" color="text-blue-500" wide>
      <textarea rows={3} className={ta} placeholder="Texto. Use {nome} para variáveis." value={d.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
      {btns.map((b) => (
        <div key={b.id} className="relative space-y-1">
          <div className="flex gap-1">
            <Sel cls="!w-28 shrink-0" value={b.type ?? "reply"} onChange={(v) => { if (v === "url") dropEdges(b.id); up(b.id, { type: v }); }} opts={[["reply", "Resposta"], ["url", "Link"]]} />
            <input className={I} placeholder="Texto do botão" value={b.label ?? ""} onChange={(e) => up(b.id, { label: e.target.value })} />
            <X onClick={() => { dropEdges(b.id); set({ buttons: btns.filter((x) => x.id !== b.id) }); }} />
          </div>
          {b.type === "url" && <input className={I} placeholder="https://…" value={b.url ?? ""} onChange={(e) => up(b.id, { url: e.target.value })} />}
          {isReply(b) && <Handle type="source" id={`b_${b.id}`} position={Position.Right} style={{ ...hs, right: -20, top: 16 }} />}
        </div>))}
      <div className="flex gap-1.5">
        <button className={mini} onClick={() => set({ buttons: [...btns, { id: rid(), type: "reply", label: "" }] })}>+ Resposta rápida</button>
        <button className={mini} onClick={() => set({ buttons: [...btns, { id: rid(), type: "url", label: "", url: "" }] })}>+ Link</button>
      </div>
      {btns.some(isReply) && <input className={I} placeholder="Guardar a escolha como (opcional)" value={d.save ?? ""} onChange={(e) => set({ save: e.target.value.replace(/\W/g, "") })} />}
      {!btns.some(isReply) && <Out />}
    </Shell>
  );
}

/* ---------- Pergunta ---------- */
function QuestionNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  return (
    <Shell id={id} title="Pergunta" color="text-violet-500">
      <textarea rows={2} className={ta} placeholder="O que perguntar" value={d.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
      <input className={I} placeholder="Guardar resposta como (ex.: nome)" value={d.save ?? ""} onChange={(e) => set({ save: e.target.value.replace(/\W/g, "") })} />
      <Sel value={d.kind ?? "text"} onChange={(v) => set({ kind: v })} opts={[["text", "Texto livre"], ["phone", "Telefone"], ["email", "Email"], ["number", "Número"]]} />
      <Out />
    </Shell>
  );
}

/* ---------- Condição: várias regras, "todas" ou "qualquer" ---------- */
const FIELDS: [string, string][] = [["var", "Variável"], ["tag", "Tag"], ["channel", "Canal"], ["source", "Origem"], ["time", "Horário"]];
const OPS: Record<string, [string, string][]> = {
  var: [["eq", "é igual a"], ["neq", "não é igual a"], ["contains", "contém"], ["starts", "começa com"], ["ends", "termina com"], ["set", "está preenchida"], ["empty", "está vazia"], ["gt", "maior que"], ["lt", "menor que"]],
  tag: [["has", "tem a tag"], ["not_has", "não tem a tag"]], channel: [["eq", "é"], ["neq", "não é"]], source: [["eq", "é igual a"], ["contains", "contém"]], time: [["between", "está entre"]],
};
function ConditionNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  const rules: any[] = d.rules ?? (d.variable ? [{ id: "l", field: "var", name: d.variable, op: d.op ?? "eq", value: d.value }] : []);
  const up = (rid_: string, p: object) => set({ rules: patchList(rules, rid_, p) });
  const row = (label: string, h: string) => <div className="relative pr-1 text-right text-xs opacity-70">{label}<Handle type="source" id={h} position={Position.Right} style={{ ...hs, right: -20 }} /></div>;
  return (
    <Shell id={id} title="Condição" color="text-amber-500" wide>
      {rules.length > 1 && <Sel value={d.match ?? "all"} onChange={(v) => set({ match: v })} opts={[["all", "Todas as regras"], ["any", "Qualquer regra"]]} />}
      {rules.map((r) => (
        <Box key={r.id}>
          <div className="flex gap-1"><Sel value={r.field ?? "var"} onChange={(v) => up(r.id, { field: v, op: OPS[v][0][0] })} opts={FIELDS} /><X onClick={() => set({ rules: rules.filter((x) => x.id !== r.id) })} /></div>
          {(r.field ?? "var") === "var" && <input className={I} placeholder="Nome da variável (ex.: interesse)" value={r.name ?? ""} onChange={(e) => up(r.id, { name: e.target.value.replace(/\W/g, "") })} />}
          <Sel value={r.op ?? OPS[r.field ?? "var"][0][0]} onChange={(v) => up(r.id, { op: v })} opts={OPS[r.field ?? "var"]} />
          {r.field === "channel" ? <Sel value={r.value ?? "INSTAGRAM_DM"} onChange={(v) => up(r.id, { value: v })} opts={[["INSTAGRAM_DM", "Direct"], ["INSTAGRAM_COMMENT", "Comentário"], ["SIMULADOR", "Simulador"]]} />
            : !["set", "empty"].includes(r.op) && <input className={I} placeholder={r.field === "time" ? "09:00-18:00" : r.field === "tag" ? "Nome da tag" : "Valor"} value={r.value ?? ""} onChange={(e) => up(r.id, { value: e.target.value })} />}
        </Box>))}
      <button className={mini + " w-full"} onClick={() => set({ rules: [...rules, { id: rid(), field: "var", name: "", op: "eq", value: "" }] })}>+ Regra</button>
      {row("Se verdadeiro", "yes")}{row("Senão", "no")}
    </Shell>
  );
}

/* ---------- Ação: lista pré-definida ---------- */
const ACTIONS: [string, string][] = [["tag_add", "Adicionar tag"], ["tag_remove", "Remover tag"], ["var_set", "Definir variável"], ["var_clear", "Limpar variável"], ["notify", "Avisar a equipe (WhatsApp)"], ["lead", "Enviar lead ao grupo"], ["pause", "Pausar o bot (humano assume)"], ["http", "Requisição externa (HTTPS)"]];
function ActionNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  const list: any[] = d.actions ?? [d.tag && { id: "t", type: "tag_add", tag: d.tag }, d.varName && { id: "v", type: "var_set", name: d.varName, value: d.varValue }, d.lead && { id: "l", type: "lead" }].filter(Boolean);
  const up = (aid: string, p: object) => set({ actions: patchList(list, aid, p) });
  return (
    <Shell id={id} title="Ações" color="text-rose-500" wide>
      {list.map((a) => (
        <Box key={a.id}>
          <div className="flex gap-1"><Sel value={a.type} onChange={(v) => up(a.id, { type: v })} opts={ACTIONS} /><X onClick={() => set({ actions: list.filter((x) => x.id !== a.id) })} /></div>
          {(a.type === "tag_add" || a.type === "tag_remove") && <input className={I} placeholder="Nome da tag" value={a.tag ?? ""} onChange={(e) => up(a.id, { tag: e.target.value })} />}
          {(a.type === "var_set" || a.type === "var_clear") && <input className={I} placeholder="Nome da variável" value={a.name ?? ""} onChange={(e) => up(a.id, { name: e.target.value.replace(/\W/g, "") })} />}
          {a.type === "var_set" && <input className={I} placeholder="Valor (aceita {variáveis})" value={a.value ?? ""} onChange={(e) => up(a.id, { value: e.target.value })} />}
          {a.type === "notify" && <textarea rows={2} className={ta} placeholder="Aviso para o grupo da equipe" value={a.text ?? ""} onChange={(e) => up(a.id, { text: e.target.value })} />}
          {a.type === "http" && <><Sel value={a.method ?? "POST"} onChange={(v) => up(a.id, { method: v })} opts={[["POST", "POST (envia as variáveis)"], ["GET", "GET"]]} /><input className={I} placeholder="https://…" value={a.url ?? ""} onChange={(e) => up(a.id, { url: e.target.value })} /></>}
          {a.type === "lead" && <p className="text-[11px] opacity-60">Usa as variáveis nome, telefone e interesse.</p>}
          {a.type === "pause" && <p className="text-[11px] opacity-60">O bot para de responder esta conversa até você reativar no chat.</p>}
        </Box>))}
      <button className={mini + " w-full"} onClick={() => set({ actions: [...list, { id: rid(), type: "tag_add", tag: "" }] })}>+ Ação</button>
      <Out />
    </Shell>
  );
}

/* ---------- IA ---------- */
function AiNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  return (
    <Shell id={id} title="IA responde" color="text-fuchsia-500" wide>
      <textarea rows={2} className={ta} placeholder="Mensagem inicial (opcional, sem IA)" value={d.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
      <textarea rows={3} className={ta} placeholder="Como a IA deve responder neste passo (aceita {variáveis})" value={d.prompt ?? ""} onChange={(e) => set({ prompt: e.target.value })} />
      <label className="nodrag flex items-center gap-2 text-xs">Responder por <input type="number" min={0} max={50} className={`${I} !w-16`} value={d.turns ?? 1} onChange={(e) => set({ turns: Math.max(0, Number(e.target.value) || 0) })} /> mensagens <span className="opacity-60">(0 = sempre)</span></label>
      <input className={I} placeholder="Palavra do contato para sair da IA (opcional)" value={d.exit ?? ""} onChange={(e) => set({ exit: e.target.value })} />
      <Out />
    </Shell>
  );
}

export const nodeTypes = { start: StartNode, message: MessageNode, question: QuestionNode, condition: ConditionNode, action: ActionNode, ai: AiNode };
