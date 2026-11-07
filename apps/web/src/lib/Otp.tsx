"use client";
import { useEffect, useRef, useState } from "react";

// Código de 6 dígitos em campos separados: ilumina o campo ativo, confere sozinho ao completar,
// fica vermelho se errar e verde com o check se acertar.
export default function Otp({ onBack, onSuccess }: { onBack: () => void; onSuccess: (d: any) => void }) {
  const [d, setD] = useState<string[]>(Array(6).fill(""));
  const [st, setSt] = useState<"idle" | "check" | "err" | "ok">("idle");
  const [merged, setMerged] = useState(false);
  const [msg, setMsg] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => { if (st === "ok") { const t = setTimeout(() => setMerged(true), 600); return () => clearTimeout(t); } }, [st]);

  async function verify(code: string) {
    setSt("check"); setMsg("");
    try {
      const res = await fetch("/api/login/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Código inválido.");
      setSt("ok"); setTimeout(() => onSuccess(data), 1300);
    } catch (e: any) {
      setSt("err"); setMsg(e.message);
      setTimeout(() => { setD(Array(6).fill("")); setSt("idle"); refs.current[0]?.focus(); }, 800);
    }
  }
  function put(i: number, v: string) {
    const c = v.replace(/\D/g, "").slice(-1); const n = [...d]; n[i] = c; setD(n);
    if (c && i < 5) refs.current[i + 1]?.focus();
    if (n.every(Boolean)) verify(n.join(""));
  }
  function paste(e: React.ClipboardEvent) {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (!t) return; e.preventDefault();
    setD(Array.from({ length: 6 }, (_, i) => t[i] ?? "")); refs.current[Math.min(t.length, 5)]?.focus();
    if (t.length === 6) verify(t);
  }
  function key(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !d[i] && i > 0) { const n = [...d]; n[i - 1] = ""; setD(n); refs.current[i - 1]?.focus(); }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }
  const locked = st === "check" || st === "ok";
  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">{st === "ok" ? "Verificado com sucesso" : "Confirme que é você"}</h1>
        <p className="mt-2 text-sm opacity-60">{st === "ok" ? "Entrando no painel…" : "Digite o código de 6 dígitos do seu app autenticador. A conferência é automática."}</p>
      </div>
      {merged ? (
        <div className="otp ok mx-auto flex !h-14 !w-14 items-center justify-center">
          <svg viewBox="0 0 24 24" className="check h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
      ) : (
        <div className="flex justify-center gap-2.5" onPaste={paste}>
          {d.map((v, i) => (
            <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} disabled={locked} inputMode="numeric" autoComplete="one-time-code" maxLength={1}
              aria-label={`Dígito ${i + 1}`} style={st === "ok" ? { animationDelay: `${i * 70}ms` } : undefined}
              className={`otp ${v ? "filled" : ""} ${st === "err" ? "err" : ""} ${st === "ok" ? "ok" : ""}`}
              onChange={(e) => put(i, e.target.value)} onKeyDown={(e) => key(i, e)} onFocus={(e) => e.target.select()} />))}
        </div>)}
      <p className={`h-5 text-sm text-red-400 transition-opacity ${msg ? "opacity-100" : "opacity-0"}`}>{msg}</p>
      {st !== "ok" && <button type="button" onClick={onBack} className="text-sm opacity-60 transition hover:opacity-100">← Voltar ao login</button>}
    </div>
  );
}
