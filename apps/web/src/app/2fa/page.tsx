"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Ativar2FA() {
  const r = useRouter();
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  async function gerar() {
    try { const d = await api("auth/totp/setup", { method: "POST" }); setSecret(new URL(d.otpauthUrl).searchParams.get("secret") ?? ""); }
    catch (e: any) { setErr(e.message); }
  }
  async function ativar() {
    try {
      await api("auth/totp/enable", { method: "POST", body: JSON.stringify({ code }) });
      await fetch("/api/logout", { method: "POST" });
      r.push("/login");
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-8 text-sm">
        <h1 className="text-xl font-semibold">Ative o 2FA</h1>
        <p className="text-zinc-600">Obrigatório para admin e gestores. Use o Google Authenticator, Microsoft Authenticator ou Authy.</p>
        {!secret ? <button onClick={gerar} className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white">Gerar chave</button> : (
          <>
            <p>No app, escolha <b>inserir chave de configuração</b> e digite:</p>
            <code className="block break-all rounded-lg bg-zinc-100 p-3 text-base tracking-wider">{secret}</code>
            <input className="w-full rounded-lg border border-zinc-300 px-3 py-2.5" placeholder="Código de 6 dígitos" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            <button onClick={ativar} className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white">Confirmar e ativar</button>
          </>
        )}
        {err && <p className="text-red-600">{err}</p>}
      </div>
    </main>
  );
}
