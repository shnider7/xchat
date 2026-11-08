"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { inp } from "@/lib/ui";

// Caixa de seleção com os modelos do provedor (consultados com a chave do cliente) + opção de digitar outro
export default function ModelPicker({ wsId, provider, value, onChange, refresh }: { wsId: string; provider: string; value: string; onChange: (v: string) => void; refresh: number }) {
  const [info, setInfo] = useState<{ models: string[]; fonte: string; aviso?: string } | null>(null);
  const [custom, setCustom] = useState(false);
  useEffect(() => { setInfo(null); api(`workspaces/${wsId}/ai-models?provider=${provider}`).then(setInfo).catch(() => setInfo({ models: [], fonte: "padrao" })); }, [wsId, provider, refresh]);
  useEffect(() => { // trocou de provedor: escolhe o primeiro modelo dele
    if (!info?.models.length) return;
    const foreign = provider === "anthropic" ? !value.startsWith("claude") : value.startsWith("claude");
    if (!value || foreign) onChange(info.models[0]);
  }, [info, provider]);
  if (!info) return <div className={inp + " opacity-60"}>Carregando modelos…</div>;
  const inList = info.models.includes(value);
  return (
    <div className="space-y-1.5">
      <select className={inp} value={custom || !inList ? "__outro" : value} onChange={(e) => { if (e.target.value === "__outro") setCustom(true); else { setCustom(false); onChange(e.target.value); } }}>
        {info.models.map((m) => <option key={m} value={m}>{m}</option>)}
        <option value="__outro">Outro (digitar o nome)</option>
      </select>
      {(custom || !inList) && <input className={inp} placeholder="Nome exato do modelo" value={value} onChange={(e) => onChange(e.target.value)} />}
      <p className="text-[11px] opacity-50">{info.fonte === "provedor" ? "Lista consultada no seu provedor, com a sua chave." : (info.aviso ?? "Lista padrão. Cadastre a chave de IA abaixo para ver todos os modelos da sua conta.")}</p>
    </div>
  );
}
