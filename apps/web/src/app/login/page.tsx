"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Field from "@/lib/Field";
import LiquidGlass from "@/lib/LiquidGlass";
import Otp from "@/lib/Otp";
import { btn } from "@/lib/ui";

// fundo de "cacos" escuros, como na referência
const FACETS: [string, string][] = [
  ["polygon(0 0,40% 0,24% 44%,0 28%)", "linear-gradient(135deg,#16161a,#2a2a30)"],
  ["polygon(40% 0,100% 0,100% 22%,58% 30%,24% 44%)", "linear-gradient(200deg,#0e0e11,#202026)"],
  ["polygon(0 28%,24% 44%,12% 100%,0 100%)", "linear-gradient(160deg,#1b1b20,#101013)"],
  ["polygon(24% 44%,58% 30%,70% 72%,38% 100%,12% 100%)", "linear-gradient(120deg,#121215,#26262c)"],
  ["polygon(58% 30%,100% 22%,100% 70%,70% 72%)", "linear-gradient(210deg,#18181c,#0d0d10)"],
  ["polygon(70% 72%,100% 70%,100% 100%,38% 100%)", "linear-gradient(100deg,#101012,#222228)"],
  ["polygon(24% 44%,58% 30%,58.4% 30.7%,24.4% 44.7%)", "rgba(255,255,255,.16)"],
  ["polygon(58% 30%,70% 72%,69.6% 72.3%,57.6% 30.4%)", "rgba(255,255,255,.10)"],
  ["polygon(24% 44%,12% 100%,12.4% 100%,24.4% 44.6%)", "rgba(255,255,255,.08)"],
];
const Shards = () => (
  <div aria-hidden className="fixed inset-0 overflow-hidden bg-[#08080a]">
    {FACETS.map(([clip, bg], i) => <div key={i} className="absolute inset-0" style={{ clipPath: clip, background: bg }} />)}
    <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 50% 55%, rgba(249,115,22,.10), transparent 70%)" }} />
  </div>);
const Spinner = () => <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;

export default function Login() {
  const r = useRouter();
  const [target, setTarget] = useState<"login" | "signup">("login"); // para onde o cartão desliza
  const [shown, setShown] = useState<"login" | "signup">("login");   // conteúdo exibido (troca no meio da animação)
  const [view, setView] = useState<"auth" | "otp">("auth");
  const [swap, setSwap] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/p/auth/config").then((x) => x.json()).then((d) => setSignupOpen(!!d.signup)).catch(() => {});
    if (new URLSearchParams(location.search).get("modo") === "cadastro") { setTarget("signup"); setShown("signup"); }
  }, []);
  useEffect(() => { (window as any).initLiquidGlass?.(); }, [view]);

  const blur = (fn: () => void) => { setSwap(true); setTimeout(fn, 330); setTimeout(() => setSwap(false), 700); };
  const switchTo = (m: "login" | "signup") => { setTarget(m); blur(() => { setShown(m); setErr(""); setBad(false); }); };
  const done = (d: any) => r.push(d.precisaAtivar2FA ? "/2fa" : d.role === "PLATFORM_ADMIN" ? "/admin" : "/inbox");
  const edit = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setBad(false); setErr(""); };

  async function login(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setErr(""); setBad(false);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email, password: f.password }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "Não foi possível entrar."); setBad(true); return; }
      if (d.need2fa) { blur(() => setView("otp")); return; }
      done(d);
    } catch { setErr("Sem conexão com o servidor."); setBad(true); } finally { setBusy(false); }
  }
  async function signup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setBad(false);
    try {
      const res = await fetch("/api/p/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? d.message ?? "Não foi possível criar a conta."); setBad(true); return; }
      await login();
    } catch { setErr("Sem conexão com o servidor."); setBad(true); } finally { setBusy(false); }
  }

  const slide = "transition-[left] duration-700 ease-[cubic-bezier(.65,0,.35,1)]";
  return (
    <main className="dark relative flex min-h-screen items-center justify-center p-4 text-white">
      <Shards /><LiquidGlass />
      {view === "otp" ? (
        <div className="glass glass-refract relative w-[min(440px,94vw)] rounded-[28px] p-8 md:p-10">
          <div className={swap ? "swap" : ""}><Otp onBack={() => blur(() => setView("auth"))} onSuccess={done} /></div>
        </div>
      ) : (
        <div className="glass glass-refract relative w-[min(920px,94vw)] overflow-hidden rounded-[28px] md:h-[540px]">
          <section className={`relative flex flex-col justify-center p-8 md:absolute md:inset-y-0 md:w-1/2 md:p-12 ${slide} ${target === "login" ? "md:left-0" : "md:left-1/2"}`}>
            <div className={swap ? "swap" : ""}>
              {shown === "login" ? (
                <form onSubmit={login} className="space-y-4">
                  <div><h1 className="text-2xl font-semibold">Entrar</h1><p className="mt-1 text-sm opacity-60">Acesse o seu painel ChatFlow.</p></div>
                  <Field icon="mail" kind="email" autoComplete="email" placeholder="Email" required value={f.email} error={bad} onChange={edit("email")} />
                  <Field icon="lock" kind="password" autoComplete="current-password" placeholder="Senha" required value={f.password} error={bad} onChange={edit("password")} />
                  {err && <p className="text-sm text-red-400">{err}</p>}
                  <button disabled={busy} className={btn + " flex h-11 w-full items-center justify-center"}>{busy ? <Spinner /> : "Entrar"}</button>
                  {signupOpen && <p className="text-center text-sm opacity-70 md:hidden">Não tem conta? <button type="button" onClick={() => switchTo("signup")} className="underline">Criar conta</button></p>}
                </form>
              ) : (
                <form onSubmit={signup} className="space-y-4">
                  <div><h1 className="text-2xl font-semibold">Criar conta</h1><p className="mt-1 text-sm opacity-60">Leva menos de um minuto.</p></div>
                  <Field icon="user" autoComplete="name" placeholder="Nome" required minLength={2} value={f.name} error={bad} onChange={edit("name")} />
                  <Field icon="mail" kind="email" autoComplete="email" placeholder="Email" required value={f.email} error={bad} onChange={edit("email")} />
                  <Field icon="lock" kind="password" autoComplete="new-password" placeholder="Senha (12+ caracteres)" required minLength={12} value={f.password} error={bad} onChange={edit("password")} />
                  {err && <p className="text-sm text-red-400">{err}</p>}
                  <button disabled={busy} className={btn + " flex h-11 w-full items-center justify-center"}>{busy ? <Spinner /> : "Criar conta"}</button>
                  <p className="text-center text-sm opacity-70 md:hidden">Já tem conta? <button type="button" onClick={() => switchTo("login")} className="underline">Entrar</button></p>
                </form>
              )}
            </div>
          </section>
          <aside className={`hidden flex-col justify-center border-white/10 bg-white/[.04] p-12 md:absolute md:inset-y-0 md:flex md:w-1/2 ${slide} ${target === "login" ? "md:left-1/2 md:border-l" : "md:left-0 md:border-r"}`}>
            <div className={`space-y-4 ${swap ? "swap" : ""}`}>
              {shown === "login" ? (<>
                <h2 className="text-3xl font-bold leading-tight">OLÁ,<br />AMIGO!</h2>
                <p className="text-sm opacity-70">{signupOpen ? "Ainda não tem conta? Crie a sua e comece a automatizar o seu atendimento." : "Automação de atendimento para o seu Instagram."}</p>
                {signupOpen && <button onClick={() => switchTo("signup")} className="group rounded-full border border-white/30 px-5 py-2 text-sm transition hover:bg-white/10">Criar conta <span className="inline-block transition group-hover:translate-x-1">→</span></button>}
              </>) : (<>
                <h2 className="text-3xl font-bold leading-tight">BEM-VINDO<br />DE VOLTA!</h2>
                <p className="text-sm opacity-70">Já tem conta? Entre com as suas credenciais e continue de onde parou.</p>
                <button onClick={() => switchTo("login")} className="group rounded-full border border-white/30 px-5 py-2 text-sm transition hover:bg-white/10"><span className="inline-block transition group-hover:-translate-x-1">←</span> Entrar</button>
              </>)}
            </div>
          </aside>
        </div>)}
    </main>
  );
}
