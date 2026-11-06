"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/lib/PasswordInput";

export default function Login() {
  const r = useRouter();
  const [f, setF] = useState({ email: "", password: "", totp: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);

  useEffect(() => {
    fetch("/api/p/auth/config").then((x) => x.json()).then((d) => setSignup(!!d.signup)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.email, password: f.password, totp: f.totp || undefined }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "falha no login"); return; }
      r.push(d.precisaAtivar2FA ? "/2fa" : d.role === "PLATFORM_ADMIN" ? "/admin" : "/inbox");
    } catch {
      setErr("Sem conexão com o servidor.");
    } finally {
      setBusy(false);
    }
  }
  const input = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900";
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-8">
        <h1 className="text-xl font-semibold">ChatFlow</h1>
        <label className="block text-sm text-zinc-600">Email
          <input className={input + " mt-1"} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="block text-sm text-zinc-600">Senha
          <PasswordInput className={input + " mt-1"} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <label className="block text-sm text-zinc-600">Código 2FA (se já ativou)
          <input className={input + " mt-1"} inputMode="numeric" maxLength={6} value={f.totp} onChange={(e) => setF({ ...f, totp: e.target.value })} /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? "Entrando…" : "Entrar"}</button>
        {signup && <p className="text-center text-sm text-zinc-600">Não tem conta? <a href="/cadastro" className="font-medium text-zinc-900 underline">Criar conta</a></p>}
      </form>
    </main>
  );
}
