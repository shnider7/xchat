"use client";
import { useState } from "react";
import Field from "./Field";
import { btn } from "./ui";

export default function Forgot({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const res = await fetch("/api/p/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Não foi possível enviar agora."); return; }
      setSent(true);
    } catch { setErr("Sem conexão com o servidor."); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5 text-center">
      <div><h1 className="text-xl font-semibold">Esqueci minha senha</h1>
        <p className="mt-2 text-sm opacity-60">{sent ? "Se existir uma conta com esse email, enviamos um link para criar uma nova senha. Ele vale por 30 minutos." : "Informe o email da sua conta e enviaremos um link para redefinir a senha."}</p></div>
      {!sent && (
        <form onSubmit={submit} className="space-y-4 text-left">
          <Field icon="mail" kind="email" autoComplete="email" placeholder="Email" required value={email} error={!!err} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button disabled={busy} className={btn + " h-11 w-full"}>{busy ? "Enviando…" : "Enviar link"}</button>
        </form>)}
      <button type="button" onClick={onBack} className="text-sm opacity-60 transition hover:opacity-100">← Voltar ao login</button>
    </div>
  );
}
