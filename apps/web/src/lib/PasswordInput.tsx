"use client";
import { useState } from "react";

// Campo de senha com botão para mostrar/ocultar
export default function PasswordInput({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input {...p} type={show ? "text" : "password"} className={className + " pr-20"} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-900">{show ? "Ocultar" : "Mostrar"}</button>
    </span>
  );
}
