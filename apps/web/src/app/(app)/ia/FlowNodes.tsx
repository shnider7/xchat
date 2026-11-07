"use client";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { btn2, inp } from "@/lib/ui";

const hs = { width: 12, height: 12, background: "#f97316", border: "2px solid #fff" };
const nd = "nodrag nowheel";
const ta = `${inp} ${nd} resize-none`;
const rid = () => Math.random().toString(36).slice(2, 6);
const useSet = (id: string) => { const { updateNodeData } = useReactFlow(); return (p: object) => updateNodeData(id, p); };

function Shell({ id, title, color, children, start }: { id: string; title: string; color: string; children: React.ReactNode; start?: boolean }) {
  const { deleteElements } = useReactFlow();
  return (
    <div className="glass w-72 rounded-2xl p-3 text-sm">
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

function StartNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  return (
    <Shell id={id} title="Início" color="text-emerald-500" start>
      <input className={`${inp} ${nd}`} placeholder="Palavra que inicia (vazio = qualquer 1ª mensagem)" value={d.trigger ?? ""} onChange={(e) => set({ trigger: e.target.value })} />
      <Out />
    </Shell>
  );
}

function MessageNode({ id, data }: NodeProps) {
  const set = useSet(id); const { setEdges } = useReactFlow(); const d: any = data;
  const btns: { id: string; label: string }[] = d.buttons ?? [];
  return (
    <Shell id={id} title="Mensagem" color="text-blue-500">
      <textarea rows={3} className={ta} placeholder="Texto. Use {nome} para variáveis." value={d.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
      {btns.map((b) => (
        <div key={b.id} className="relative flex gap-1">
          <input className={`${inp} ${nd}`} placeholder="Texto do botão" value={b.label} onChange={(e) => set({ buttons: btns.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })} />
          <button className="nodrag px-2 opacity-60" onClick={() => { set({ buttons: btns.filter((x) => x.id !== b.id) }); setEdges((es) => es.filter((e) => !(e.source === id && e.sourceHandle === `b_${b.id}`))); }}>×</button>
          <Handle type="source" id={`b_${b.id}`} position={Position.Right} style={{ ...hs, right: -20 }} />
        </div>))}
      <button className={`nodrag ${btn2} w-full !py-1.5 text-xs`} onClick={() => set({ buttons: [...btns, { id: rid(), label: "" }] })}>+ Botão</button>
      {btns.length > 0 && <input className={`${inp} ${nd}`} placeholder="Guardar a escolha como (opcional)" value={d.save ?? ""} onChange={(e) => set({ save: e.target.value.replace(/\W/g, "") })} />}
      {!btns.length && <Out />}
    </Shell>
  );
}

function QuestionNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  return (
    <Shell id={id} title="Pergunta" color="text-violet-500">
      <textarea rows={2} className={ta} placeholder="O que perguntar" value={d.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
      <input className={`${inp} ${nd}`} placeholder="Guardar resposta como (ex.: nome)" value={d.save ?? ""} onChange={(e) => set({ save: e.target.value.replace(/\W/g, "") })} />
      <select className={`${inp} ${nd}`} value={d.kind ?? "text"} onChange={(e) => set({ kind: e.target.value })}>
        <option value="text">Texto livre</option><option value="phone">Telefone</option><option value="email">Email</option><option value="number">Número</option></select>
      <Out />
    </Shell>
  );
}

function ConditionNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  const row = (label: string, h: string) => <div className="relative pr-1 text-right text-xs opacity-70">{label}<Handle type="source" id={h} position={Position.Right} style={{ ...hs, right: -20 }} /></div>;
  return (
    <Shell id={id} title="Condição" color="text-amber-500">
      <input className={`${inp} ${nd}`} placeholder="Variável (ex.: interesse)" value={d.variable ?? ""} onChange={(e) => set({ variable: e.target.value.replace(/\W/g, "") })} />
      <select className={`${inp} ${nd}`} value={d.op ?? "eq"} onChange={(e) => set({ op: e.target.value })}><option value="eq">é igual a</option><option value="contains">contém</option><option value="set">foi preenchida</option></select>
      {d.op !== "set" && <input className={`${inp} ${nd}`} placeholder="Valor" value={d.value ?? ""} onChange={(e) => set({ value: e.target.value })} />}
      {row("Se verdadeiro", "yes")}{row("Senão", "no")}
    </Shell>
  );
}

function ActionNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  return (
    <Shell id={id} title="Ação" color="text-rose-500">
      <input className={`${inp} ${nd}`} placeholder="Adicionar tag (opcional)" value={d.tag ?? ""} onChange={(e) => set({ tag: e.target.value })} />
      <div className="flex gap-1"><input className={`${inp} ${nd}`} placeholder="Variável" value={d.varName ?? ""} onChange={(e) => set({ varName: e.target.value.replace(/\W/g, "") })} />
        <input className={`${inp} ${nd}`} placeholder="Valor" value={d.varValue ?? ""} onChange={(e) => set({ varValue: e.target.value })} /></div>
      <label className="nodrag flex items-center gap-2 text-xs"><input type="checkbox" checked={!!d.lead} onChange={(e) => set({ lead: e.target.checked })} /> Enviar lead ao grupo (usa nome, telefone, interesse)</label>
      <Out />
    </Shell>
  );
}

function AiNode({ id, data }: NodeProps) {
  const set = useSet(id); const d: any = data;
  return (
    <Shell id={id} title="IA responde" color="text-fuchsia-500">
      <textarea rows={2} className={ta} placeholder="Mensagem inicial (opcional)" value={d.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
      <textarea rows={3} className={ta} placeholder="Como a IA deve responder aqui (pode usar {variáveis})" value={d.prompt ?? ""} onChange={(e) => set({ prompt: e.target.value })} />
      <label className="nodrag flex items-center gap-2 text-xs">Responder por <input type="number" min={1} max={10} className={`${inp} ${nd} !w-16`} value={d.turns ?? 1} onChange={(e) => set({ turns: Number(e.target.value) || 1 })} /> mensagens</label>
      <Out />
    </Shell>
  );
}

export const nodeTypes = { start: StartNode, message: MessageNode, question: QuestionNode, condition: ConditionNode, action: ActionNode, ai: AiNode };
