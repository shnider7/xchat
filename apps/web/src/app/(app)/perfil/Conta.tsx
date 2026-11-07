"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PasswordInput from "@/lib/PasswordInput";
import { btn, btn2, card, inp } from "@/lib/ui";

const PERIODOS: Record<string, string> = { MENSAL: "mensal", TRIMESTRAL: "trimestral", SEMESTRAL: "semestral", ANUAL: "anual" };
const ROLE: Record<string, string> = { MANAGER: "Gestor", CLIENT: "Conta", PLATFORM_ADMIN: "Admin" };

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

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggle() { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.setItem("theme", d ? "dark" : "light"); }
  return (
    <button onClick={toggle} title={dark ? "Modo claro" : "Modo escuro"} aria-label="Alternar entre modo claro e escuro"
      className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full opacity-70 transition hover:rotate-12 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
      </svg>
    </button>
  );
}

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 border-t border-black/5 py-5 first:border-0 dark:border-white/10">
    <h3 className="text-[11px] font-medium uppercase tracking-wider opacity-50">{title}</h3>{children}
  </section>);

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
    <div className="prof p-8">
      <aside className={card + " relative flex h-fit flex-col items-center gap-3 text-center"}>
        <ThemeToggle />
        <label className="group relative mt-2 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-black/5 text-3xl ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/15">
          {me.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : me.name[0]?.toUpperCase()}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs text-white opacity-0 transition group-hover:opacity-100">Trocar foto</span>
          <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) run(async () => patch({ avatar: await resize(file) }), "Foto atualizada."); }} />
        </label>
        {me.avatar && <button className="text-xs opacity-50 transition hover:opacity-100" onClick={() => run(() => patch({ avatar: null }), "Foto removida.")}>Remover foto</button>}
        <div><div className="font-semibold">{me.name}</div><div className="text-sm opacity-60">{me.username ? `@${me.username}` : me.email}</div></div>
        <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
          <span className="chip">{ROLE[me.role]}</span>
          <span className="chip">{me.subscriptionStatus === "CANCELADA" ? "Assinatura cancelada" : `Teste · ${PERIODOS[me.planPeriod] ?? me.planPeriod}`}</span>
        </div>
      </aside>

      <div className={card + " !py-2"}>
        <Sec title="Dados">
          <div className="grid gap-3 md:grid-cols-2">
            <input className={inp} placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className={inp} placeholder="Nome de usuário" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
          </div>
          <div className="flex items-center justify-between gap-3"><span className="truncate text-xs opacity-60">{me.email}</span>
            <button className={btn} onClick={() => run(() => patch({ name: f.name, username: f.username || null }), "Dados salvos.")}>Salvar</button></div>
        </Sec>
        <Sec title="Plano">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="opacity-80">Período de teste, sem cobrança ainda</span>
            {me.subscriptionStatus !== "CANCELADA" && <button className={btn2} onClick={() => { if (confirm("Cancelar a assinatura?")) run(() => api("me/subscription", { method: "DELETE" }), "Assinatura cancelada."); }}>Cancelar</button>}
          </div>
        </Sec>
        <Sec title="Segurança">
          <div className="grid gap-3 md:grid-cols-2">
            <PasswordInput className={inp} placeholder="Senha atual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <PasswordInput className={inp} placeholder="Nova senha (8+, letra, número e símbolo)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          <button className={btn2} onClick={() => run(() => api("me/password", { method: "POST", body: JSON.stringify(pw) }).then(() => setPw({ current: "", next: "" })), "Senha alterada.")}>Alterar senha</button>
        </Sec>
        {me.role !== "PLATFORM_ADMIN" && (
          <Sec title="Zona de perigo">
            <details>
              <summary className="cursor-pointer text-sm text-red-500 transition hover:opacity-80">Excluir minha conta</summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs opacity-60">Apaga a conta{me.role === "CLIENT" ? ", as conversas, os chatbots e as chaves" : ""} e não dá para desfazer.</p>
                <PasswordInput className={inp} placeholder="Digite sua senha para confirmar" value={del} onChange={(e) => setDel(e.target.value)} />
                <button className={btn2 + " !border-red-400 text-red-500"} onClick={async () => {
                  if (!confirm("Excluir a conta definitivamente?")) return;
                  try { await api("me/delete", { method: "POST", body: JSON.stringify({ password: del }) }); await fetch("/api/logout", { method: "POST" }); r.push("/login"); } catch (e: any) { setMsg(e.message); }
                }}>Excluir definitivamente</button>
              </div>
            </details>
          </Sec>)}
        {msg && <p className="pb-3 text-sm opacity-80">{msg}</p>}
      </div>
    </div>
  );
}
