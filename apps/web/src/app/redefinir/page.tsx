"use client";
import { useEffect, useState } from "react";
import Field from "@/lib/Field";
import { btn } from "@/lib/ui";

export default function Redefinir() {
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(location.search).get("token") ?? ""); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const res = await fetch("/api/p/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? "Não foi possível redefinir."); return; }
      setOk(true);
    } catch { setErr("Sem conexão com o servidor."); } finally { setBusy(false); }
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="glass glass-refract w-[min(440px,94vw)] rounded-[28px] p-8 md:p-10">
        {ok ? (
          <div className="space-y-4 text-center"><h1 className="text-xl font-semibold">Senha alterada</h1><p className="text-sm opacity-60">Agora é só entrar com a nova senha.</p><a href="/login" className={btn + " inline-block"}>Ir para o login</a></div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><h1 className="text-xl font-semibold">Criar nova senha</h1><p className="mt-1 text-sm opacity-60">Mínimo de 8 caracteres, com letra, número e símbolo.</p></div>
            <Field icon="lock" kind="password" autoComplete="new-password" placeholder="Nova senha" required minLength={8} value={pw} error={!!err} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button disabled={busy || !token} className={btn + " h-11 w-full"}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
            {!token && <p className="text-sm text-red-400">Link incompleto. Abra o link do email de novo.</p>}
          </form>)}
      </div>
    </main>
  );
}
