"use client";
import { useRef, useState } from "react";

const IC = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
};

// Campo com ícone, iluminação ao digitar e estado de erro (vermelho)
export default function Field({ icon, kind = "text", error, onChange, ...p }: { icon: keyof typeof IC; kind?: "text" | "email" | "password"; error?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  const [pulse, setPulse] = useState(false);
  const t = useRef<any>(null);
  return (
    <div className={`fld ${pulse ? "pulse" : ""} ${error ? "err" : ""}`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{IC[icon]}</svg>
      <input {...p} type={kind === "password" && show ? "text" : kind}
        onChange={(e) => { onChange?.(e); setPulse(true); clearTimeout(t.current); t.current = setTimeout(() => setPulse(false), 180); }} />
      {kind === "password" && <button type="button" tabIndex={-1} onClick={() => setShow(!show)} className="text-xs opacity-50 transition hover:opacity-100">{show ? "Ocultar" : "Mostrar"}</button>}
    </div>
  );
}
