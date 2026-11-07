"use client";
import Script from "next/script";

// Carrega /liquid-glass.js e (re)aplica a refração nos elementos .glass-refract a cada montagem do painel
const init = () => (window as any).initLiquidGlass?.();
export default function LiquidGlass() {
  return <Script src="/liquid-glass.js" strategy="afterInteractive" onReady={init} />;
}
