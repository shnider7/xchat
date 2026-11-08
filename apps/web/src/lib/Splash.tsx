"use client";
import { useEffect, useLayoutEffect, useState } from "react";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Abertura do painel (uma vez por sessão): logo no escuro e um círculo que se abre do canto revelando o painel
export default function Splash() {
  const [show, setShow] = useState(false);
  useIso(() => {
    if (sessionStorage.getItem("splash") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    sessionStorage.setItem("splash", "1"); setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div className="splash" onAnimationEnd={(e) => { if (e.animationName === "reveal") setShow(false); }}>
      <div className="splash-logo flex flex-col items-center gap-4 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
        </div>
        <div className="text-xl font-semibold tracking-wide">ChatFlow</div>
      </div>
    </div>
  );
}
