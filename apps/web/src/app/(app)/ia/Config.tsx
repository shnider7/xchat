"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

export default function Config() {
  const { current, reload } = useWorkspace();
  const [f, setF] = useState<any>(null);
  const [creds, setCreds] = useState<any[]>([]);
  const [k, setK] = useState({ provider: "anthropic", label: "", apiKey: "" });
  const [msg, setMsg] = useState("");
  const loadCreds = useCallback(() => { if (current) api(`workspaces/${current.id}/ai-credentials`).then(setCreds).catch(() => {}); }, [current?.id]);
  useEffect(() => { setF(current && { ...current }); setMsg(""); loadCreds(); }, [current?.id, loadCreds]);

  if (!current || !f) return <p className="p-8 text-sm text-zinc-500">Selecione um cliente no topo para configurar a IA.</p>;
  const set = (key: string) => (e: any) => setF({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function salvar() {
    try {
      const { aiEnabled, aiProvider, aiModel, aiPrompt, leadDestination, leadTemplate, evolutionInstance, instagram } = f;
      await api(`workspaces/${current!.id}`, { method: "PATCH", body: JSON.stringify({ aiEnabled, aiProvider, aiModel, aiPrompt, leadDestination: leadDestination ?? undefined, leadTemplate: leadTemplate ?? undefined, evolutionInstance: evolutionInstance ?? undefined, instagram: instagram ?? undefined }) });
      await reload(); setMsg("Salvo.");
    } catch (e: any) { setMsg(e.message); }
  }
  async function addKey() {
    try { await api(`workspaces/${current!.id}/ai-credentials`, { method: "POST", body: JSON.stringify(k) }); setK({ ...k, label: "", apiKey: "" }); loadCreds(); }
    catch (e: any) { setMsg(e.message); }
  }
  const lab = "block text-sm text-zinc-600 space-y-1";
  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h1 className="text-lg font-semibold">Conexão com a IA · {current.name}</h1>
      <div className={card + " space-y-4"}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.aiEnabled} onChange={set("aiEnabled")} /> Responder automaticamente com IA nas conversas</label>
        <div className="grid grid-cols-2 gap-3">
          <label className={lab}>Provedor<select className={inp} value={f.aiProvider} onChange={set("aiProvider")}><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option></select></label>
          <label className={lab}>Modelo<input className={inp} value={f.aiModel} onChange={set("aiModel")} /></label>
        </div>
        <label className={lab}>Instruções padrão da IA (base para os chatbots e para respostas automáticas)<textarea rows={5} className={inp} value={f.aiPrompt} onChange={set("aiPrompt")} /></label>
        <label className={lab}>Instância da Evolution (só envia avisos de lead; não recebe conversas)<input className={inp} value={f.evolutionInstance ?? ""} onChange={set("evolutionInstance")} /></label>
        <label className={lab}>Destino dos leads (número ou grupo @g.us)<input className={inp} value={f.leadDestination ?? ""} onChange={set("leadDestination")} /></label>
        <label className={lab}>Modelo do cartão de lead ({"{nome} {telefone} {interesse} {data} {link}"})<textarea rows={4} className={inp} value={f.leadTemplate ?? ""} onChange={set("leadTemplate")} /></label>
        <button onClick={salvar} className={btn}>Salvar</button>{msg && <span className="ml-3 text-sm text-zinc-600">{msg}</span>}
      </div>
      <div className={card + " space-y-3"}>
        <div className="text-sm font-medium">API da IA (a chave que gera as respostas)</div>
        <p className="text-xs text-zinc-500">Cada cliente usa a própria chave. Depois de salva, ela nunca é exibida de novo.</p>
        {creds.map((c) => <div key={c.id} className="flex items-center justify-between text-sm"><span>{c.provider} · {c.label} · {c.mascara}</span>
          <button className={btn2} onClick={async () => { await api(`ai-credentials/${c.id}`, { method: "DELETE" }); loadCreds(); }}>Remover</button></div>)}
        <div className="grid grid-cols-[140px_1fr_1fr_auto] gap-2">
          <select className={inp} value={k.provider} onChange={(e) => setK({ ...k, provider: e.target.value })}><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
          <input className={inp} placeholder="Apelido" value={k.label} onChange={(e) => setK({ ...k, label: e.target.value })} />
          <input className={inp} type="password" placeholder="Cole a chave" value={k.apiKey} onChange={(e) => setK({ ...k, apiKey: e.target.value })} />
          <button className={btn} onClick={addKey}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}
