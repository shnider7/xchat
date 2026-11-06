"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PasswordInput from "@/lib/PasswordInput";
import { btn, btn2, card, inp } from "@/lib/ui";

const PLANOS: Record<string, string> = { TESTE: "Período de teste (sem cobrança ainda)" };
const PERIODOS: Record<string, string> = { MENSAL: "mensal", TRIMESTRAL: "trimestral", SEMESTRAL: "semestral", ANUAL: "anual" };

function resize(file: File, size = 256): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height); const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = rej; img.src = url;
  });
}

export default function Conta() {
  const r = useRouter();
  const [me, setMe] = useState<any>(null);
  const [f, setF] = useState({ name: "", username: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [del, setDel] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api("me").then((u) => { setMe(u); setF({ name: u.name, username: u.username ?? "" }); });
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  async function run(fn: () => Promise<any>, ok: string) {
    setMsg("");
    try { await fn(); setMsg(ok); await load(); window.dispatchEvent(new Event("me-updated")); } catch (e: any) { setMsg(e.message); }
  }
  if (!me) return null;
  const patch = (body: object) => api("me", { method: "PATCH", body: JSON.stringify(body) });

  return (
    <div className="max-w-2xl space-y-6 p-8">
      <div className={card + " space-y-4"}>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-zinc-300 bg-white/50 text-2xl">
            {me.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : me.name[0]?.toUpperCase()}</div>
          <div className="space-y-2 text-sm">
            <label className={btn2 + " inline-block cursor-pointer"}>Trocar foto
              <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) run(async () => patch({ avatar: await resize(file) }), "Foto atualizada."); }} /></label>
            {me.avatar && <button className={btn2 + " ml-2"} onClick={() => run(() => patch({ avatar: null }), "Foto removida.")}>Remover</button>}
          </div>
        </div>
        <label className="block text-sm opacity-80">Nome<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="block text-sm opacity-80">Nome de usuário<input className={inp} placeholder="letras, números, . e _" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
        <div className="text-sm opacity-70">Email: {me.email}</div>
        <button className={btn} onClick={() => run(() => patch({ name: f.name, username: f.username || null }), "Dados salvos.")}>Salvar</button>
      </div>

      <div className={card + " space-y-3 text-sm"}>
        <div className="font-medium">Plano</div>
        <div>{PLANOS[me.plan] ?? me.plan} · cobrança {PERIODOS[me.planPeriod] ?? me.planPeriod}</div>
        <div className="opacity-70">Situação: {me.subscriptionStatus === "CANCELADA" ? "assinatura cancelada" : "ativa"}</div>
        {me.subscriptionStatus !== "CANCELADA" && <button className={btn2} onClick={() => { if (confirm("Cancelar a assinatura?")) run(() => api("me/subscription", { method: "DELETE" }), "Assinatura cancelada."); }}>Cancelar assinatura</button>}
      </div>

      <div className={card + " space-y-3"}>
        <div className="text-sm font-medium">Alterar senha</div>
        <PasswordInput className={inp} placeholder="Senha atual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <PasswordInput className={inp} placeholder="Nova senha (mínimo 12 caracteres)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button className={btn} onClick={() => run(() => api("me/password", { method: "POST", body: JSON.stringify(pw) }).then(() => setPw({ current: "", next: "" })), "Senha alterada.")}>Alterar senha</button>
      </div>

      {me.role !== "PLATFORM_ADMIN" && (
        <div className={card + " space-y-3"}>
          <div className="text-sm font-medium text-red-600">Excluir conta</div>
          <p className="text-xs opacity-70">Apaga a conta{me.role === "CLIENT" ? ", as conversas, os chatbots e as chaves" : ""} e não dá para desfazer. Digite sua senha para confirmar.</p>
          <PasswordInput className={inp} placeholder="Sua senha" value={del} onChange={(e) => setDel(e.target.value)} />
          <button className={btn2 + " !border-red-400 text-red-600"} onClick={async () => {
            if (!confirm("Excluir a conta definitivamente?")) return;
            try { await api("me/delete", { method: "POST", body: JSON.stringify({ password: del }) }); await fetch("/api/logout", { method: "POST" }); r.push("/login"); } catch (e: any) { setMsg(e.message); }
          }}>Excluir minha conta</button>
        </div>
      )}
      {msg && <p className="text-sm opacity-80">{msg}</p>}
    </div>
  );
}
