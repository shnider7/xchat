"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/lib/PasswordInput";

export default function Cadastro() {
  const r = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => { fetch("/api/p/auth/config").then((x) => x.json()).then((d) => setOpen(!!d.signup)).catch(() => setOpen(false)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const res = await fetch("/api/p/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? d.message ?? "não foi possível criar a conta"); return; }
      const login = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email, password: f.password }) });
      r.push(login.ok ? "/inbox" : "/login");
    } catch { setErr("Sem conexão com o servidor."); } finally { setBusy(false); }
  }
  const input = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900";
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-8">
        <h1 className="text-xl font-semibold">Criar conta</h1>
        {open === false && <p className="text-sm text-red-600">O cadastro está desativado no momento.</p>}
        <label className="block text-sm text-zinc-600">Nome<input className={input} required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="block text-sm text-zinc-600">Email<input className={input} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="block text-sm text-zinc-600">Senha (mínimo 12 caracteres)<PasswordInput className={input} required minLength={12} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy || open === false} className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? "Criando…" : "Criar conta"}</button>
        <p className="text-center text-sm text-zinc-600">Já tem conta? <a href="/login" className="font-medium text-zinc-900 underline">Entrar</a></p>
      </form>
    </main>
  );
}
