"use client";
import Link from "next/link";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, getRole } from "@/lib/api";
import { WorkspaceProvider, useWorkspace } from "@/lib/ws";

const ICON: Record<string, React.ReactNode> = {
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  lead: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M2 20h20" />,
  bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
};
const Icon = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICON[n]}</svg>);

function Selector() {
  const { list, current, loaded, select } = useWorkspace();
  if (!loaded) return null;
  if (list.length === 0) return <span className="text-sm opacity-60">Nenhuma conta vinculada. Adicione em Perfil.</span>;
  if (list.length === 1) return <span className="text-sm font-medium">{list[0].name}</span>;
  return (
    <label className="flex items-center gap-3 text-sm opacity-90">Cliente
      <select value={current?.id ?? ""} onChange={(e) => select(e.target.value)} className="min-w-[240px] rounded-lg border border-zinc-300 bg-white/60 px-3 py-2 text-sm">
        <option value="">Selecione um cliente…</option>{list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const r = useRouter();
  const [role, setRole] = useState("");
  const [me, setMe] = useState<any>(null);
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const loadMe = useCallback(() => { api("me").then(setMe).catch(() => {}); }, []);

  useEffect(() => {
    setRole(getRole()); loadMe();
    setDark(document.documentElement.classList.contains("dark"));
    setCollapsed(localStorage.getItem("sb") === "1");
    window.addEventListener("me-updated", loadMe);
    return () => window.removeEventListener("me-updated", loadMe);
  }, [loadMe]);

  function toggleTheme() { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.setItem("theme", d ? "dark" : "light"); }
  function toggleSb() { const c = !collapsed; setCollapsed(c); localStorage.setItem("sb", c ? "1" : "0"); }
  async function sair() { await fetch("/api/logout", { method: "POST" }); r.push("/login"); }

  const admin = role === "PLATFORM_ADMIN";
  const nav: [string, string, string][] = admin
    ? [["/admin", "Visão geral", "grid"], ["/gestores", "Gestores", "lead"], ["/perfil", "Perfil", "user"]]
    : [["/inbox", "Conversas", "chat"], ["/leads", "Leads", "lead"], ["/relatorios", "Relatórios", "chart"], ["/ia", "IA e chatbot", "bot"], ["/perfil", "Perfil", "user"]];

  return (
    <WorkspaceProvider enabled={!!role && !admin}>
      <Script src="/liquid-glass.js" strategy="lazyOnload" />
      <div className="flex h-screen gap-3 p-3">
        <aside className={`glass glass-refract flex shrink-0 flex-col rounded-3xl p-3 transition-[width] duration-300 ${collapsed ? "w-[76px]" : "w-60"}`}>
          <div className={`flex items-center py-3 ${collapsed ? "justify-center" : "justify-between px-2"}`}>
            {!collapsed && <span className="text-lg font-semibold">ChatFlow</span>}
            <button onClick={toggleSb} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} className="rounded-lg px-2 py-1 text-sm opacity-70 hover:opacity-100">{collapsed ? "»" : "«"}</button>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map(([href, label, icon]) => (
              <Link key={href} href={href} title={label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${collapsed ? "justify-center" : ""} ${path.startsWith(href) ? "navon font-medium" : "opacity-70 hover:opacity-100"}`}>
                <Icon n={icon} />{!collapsed && label}
              </Link>))}
          </nav>
          <button onClick={sair} className={`mt-auto rounded-xl px-3 py-2.5 text-sm opacity-70 hover:opacity-100 ${collapsed ? "text-center" : "text-left"}`}>{collapsed ? "×" : "Sair"}</button>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <header className="glass glass-refract flex h-14 shrink-0 items-center justify-between rounded-2xl px-5">
            {admin ? <span className="text-sm opacity-60">Administração da plataforma</span> : <Selector />}
            <div className="flex items-center gap-3">
              <button onClick={toggleTheme} className="rounded-lg border border-zinc-300 bg-white/50 px-3 py-1.5 text-xs">{dark ? "Modo claro" : "Modo escuro"}</button>
              <Link href="/perfil" title={me?.name ?? "Perfil"} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-300 bg-white/50 text-sm font-medium">
                {me?.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : (me?.name?.[0]?.toUpperCase() ?? "?")}
              </Link>
            </div>
          </header>
          <main className="glass min-h-0 flex-1 overflow-y-auto rounded-3xl">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
