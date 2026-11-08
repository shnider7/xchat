"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, getRole } from "@/lib/api";
import LiquidGlass from "@/lib/LiquidGlass";
import Splash from "@/lib/Splash";
import { WorkspaceProvider, useWorkspace } from "@/lib/ws";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const ICON: Record<string, React.ReactNode> = {
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  lead: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" /></>,
  bot: <><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  grid: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  out: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
};
const Icon = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ICON[n]}</svg>);

// Submenu da barra superior: depende da seção escolhida no menu lateral (a página lê o mesmo parâmetro da URL)
const SUB: Record<string, [string, string][]> = {
  "/usuarios": [["Todas", ""], ["Ativas", "s=active"], ["Desativadas", "s=inactive"], ["A vencer", "s=expiring"], ["Vencidas", "s=expired"]],
  "/inbox": [["Todas", ""], ["Direct", "canal=INSTAGRAM_DM"], ["Comentários", "canal=INSTAGRAM_COMMENT"], ["Só leads", "lead=1"]],
  "/leads": [["Todos", ""], ["Hoje", "p=hoje"], ["7 dias", "p=7"], ["30 dias", "p=30"]],
  "/relatorios": [["7 dias", "dias=7"], ["30 dias", ""], ["90 dias", "dias=90"]],
  "/ia": [["Chatbots", ""], ["IA e API", "aba=ia"], ["Canais", "aba=canais"]],
  "/perfil": [["Conta", ""], ["Instagram", "aba=instagram"], ["Gestão de usuários", "aba=gestao"]],
};

// Todas as opções ficam lado a lado. Só vira um menu que abre e fecha se realmente não couber.
function SubMenu({ path, admin }: { path: string; admin: boolean }) {
  const sp = useSearchParams().toString();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const need = useRef(0);
  const base = Object.keys(SUB).find((k) => path.startsWith(k));
  useEffect(() => { need.current = 0; setCompact(false); setOpen(false); }, [path]);
  useEffect(() => { setOpen(false); }, [sp]);
  useIso(() => {
    const el = box.current; if (!el) return;
    const check = () => {
      const nav = el.querySelector<HTMLElement>("[data-inline]");
      if (nav) need.current = nav.scrollWidth;
      setCompact(need.current > 0 && need.current > el.clientWidth);
    };
    check();
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => ro.disconnect();
  }, [path, compact]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  if (!base || (admin && base === "/perfil")) return <div className="flex-1" />;
  const items = SUB[base];
  const cur = items.find(([, q]) => q === sp) ?? items[0];
  const href = (q: string) => (q ? `${base}?${q}` : base);
  return (
    <div ref={box} className="relative min-w-0 flex-1">
      {!compact && (
        <nav data-inline className="flex w-max items-center gap-1">
          {items.map(([label, q]) => (
            <Link key={label} href={href(q)} className={`pill whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${sp === q ? "navon font-medium" : "opacity-60"}`}>{label}</Link>))}
        </nav>)}
      {compact && (
        <>
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="navon flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
            {cur[0]}
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {open && (
            <div className="pop absolute left-0 top-full z-50 mt-2 w-56 space-y-1 rounded-2xl p-2">
              {items.map(([label, q]) => <Link key={label} href={href(q)} className={`pill block rounded-xl px-3 py-2 text-sm ${sp === q ? "navon font-medium" : "opacity-80"}`}>{label}</Link>)}
            </div>)}
        </>)}
    </div>
  );
}

// Só aparece quando há 2 ou mais contas; com uma só, ela já vem selecionada e nada é mostrado
function Selector() {
  const { list, current, select } = useWorkspace();
  if (list.length < 2) return null;
  return (
    <select value={current?.id ?? ""} onChange={(e) => select(e.target.value)} aria-label="Cliente" className="min-w-[200px] rounded-full border border-black/10 bg-white/40 px-4 py-1.5 text-sm dark:border-white/15 dark:bg-white/5">
      {list.map((w) => <option key={w.id} value={w.id}>{w.own ? `${w.name} (minha conta)` : w.name}</option>)}
    </select>
  );
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Barrinha do gasto estimado de IA no mês (acima do "Sair")
function UsageMeter({ collapsed }: { collapsed: boolean }) {
  const { current } = useWorkspace();
  const [u, setU] = useState<any>(null);
  useEffect(() => {
    if (!current) { setU(null); return; }
    const load = () => api(`workspaces/${current.id}/ai-usage`).then(setU).catch(() => {});
    load(); const t = setInterval(load, 60000); window.addEventListener("ai-usage-updated", load);
    return () => { clearInterval(t); window.removeEventListener("ai-usage-updated", load); };
  }, [current?.id]);
  if (!u) return null;
  const pct = Math.min(100, Math.round(u.orcamentoBrl > 0 ? (u.custoBrl / u.orcamentoBrl) * 100 : (u.respostas / Math.max(1, u.limiteRespostas)) * 100));
  const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#3b82f6";
  const tip = `IA no mês: ${brl(u.custoBrl)} (estimativa) · ${u.respostas} respostas`;
  const bar = <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} /></div>;
  const spark = <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>;
  if (collapsed) return <div title={tip} className="mx-auto flex w-10 flex-col items-center gap-1.5 opacity-80">{spark}<div className="w-8">{bar}</div></div>;
  return (
    <div title={tip} className="rounded-2xl border border-black/10 p-3 text-xs dark:border-white/10">
      <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 opacity-70">{spark} IA no mês</span><b className="text-sm">{brl(u.custoBrl)}</b></div>
      <div className="mt-2">{bar}</div>
      <div className="mt-1.5 opacity-50">{u.respostas} respostas · {u.orcamentoBrl > 0 ? `meta ${brl(u.orcamentoBrl)}` : `limite ${u.limiteRespostas}`}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const r = useRouter();
  const [role, setRole] = useState("");
  const [me, setMe] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState(0);
  const loadMe = useCallback(() => { api("me").then(setMe).catch(() => {}); }, []);

  useEffect(() => {
    setRole(getRole()); loadMe();
    const sb = localStorage.getItem("sb"); setCollapsed(sb === null ? window.innerWidth < 1100 : sb === "1"); // tela pequena: menu já começa recolhido
    window.addEventListener("me-updated", loadMe);
    return () => window.removeEventListener("me-updated", loadMe);
  }, [loadMe]);

  useEffect(() => { if (role && role !== "PLATFORM_ADMIN") api("me/invites").then((l: any[]) => setPending(l.filter((i) => i.status === "PENDING").length)).catch(() => {}); }, [role, path]);

  function toggleSb() { const c = !collapsed; setCollapsed(c); localStorage.setItem("sb", c ? "1" : "0"); }
  async function sair() { await fetch("/api/logout", { method: "POST" }); r.push("/login"); }

  const admin = role === "PLATFORM_ADMIN";
  const inactive = !!me && !admin && me.active === false;
  const daysLeft = me?.activeUntil ? Math.ceil((+new Date(me.activeUntil) - Date.now()) / 864e5) : null;
  const nav: [string, string, string][] = admin
    ? [["/admin", "Visão geral", "grid"], ["/usuarios", "Usuários", "users"], ["/perfil", "Perfil", "user"]]
    : [["/inbox", "Conversas", "chat"], ["/leads", "Leads", "lead"], ["/relatorios", "Relatórios", "chart"], ["/ia", "IA e chatbot", "bot"], ["/perfil", "Perfil", "user"]];

  return (
    <WorkspaceProvider enabled={!!role && !admin}>
      <LiquidGlass />
      <Splash />
      <div className="flex h-screen gap-3 p-3">
        <aside className={`intro-left glass glass-refract flex shrink-0 flex-col rounded-3xl p-3 transition-[width] duration-300 ${collapsed ? "w-[76px]" : "w-60"}`}>
          <div className={`flex items-center py-3 ${collapsed ? "justify-center" : "justify-between px-2"}`}>
            {!collapsed && <span className="text-lg font-semibold">ChatFlow</span>}
            <button onClick={toggleSb} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} className="rounded-lg px-2 py-1 opacity-70 hover:opacity-100">
              <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></svg>
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map(([href, label, icon]) => (
              <Link key={href} href={href} title={label} className={`nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${collapsed ? "justify-center" : ""} ${path.startsWith(href) ? "navon font-medium" : "opacity-70"}`}>
                <Icon n={icon} />{!collapsed && label}{href === "/perfil" && pending > 0 && <span className={`h-2 w-2 rounded-full bg-blue-500 ${collapsed ? "absolute right-2 top-2" : "ml-auto"}`} />}
              </Link>))}
          </nav>
          <div className="mt-auto space-y-2">{!admin && <UsageMeter collapsed={collapsed} />}<button onClick={sair} title="Sair" className={`nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm opacity-70 ${collapsed ? "justify-center" : ""}`}><Icon n="out" />{!collapsed && "Sair"}</button></div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <header className="intro-top topbar relative z-30 glass glass-refract flex h-14 shrink-0 items-center gap-4 rounded-2xl px-5">
            {!admin && <Selector />}
            <Suspense fallback={<div className="flex-1" />}><SubMenu path={path} admin={admin} /></Suspense>
            {daysLeft !== null && daysLeft <= 7 && !admin && <Link href="/perfil" className="chip whitespace-nowrap text-[11px] text-amber-600 dark:text-amber-300">{daysLeft < 0 ? "Acesso vencido" : daysLeft === 0 ? "Acesso vence hoje" : `Acesso vence em ${daysLeft}d`}</Link>}
            <Link href="/perfil" title={me?.name ?? "Perfil"} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white/40 text-sm font-medium dark:border-white/15 dark:bg-white/10">
              {me?.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : (me?.name?.[0]?.toUpperCase() ?? "?")}
            </Link>
          </header>
          <main className="page glass min-h-0 flex-1 overflow-y-auto rounded-3xl">{inactive && !path.startsWith("/perfil") ? (
            <div className="flex h-full items-center justify-center p-8 text-center"><div className="max-w-sm space-y-3"><h1 className="text-lg font-semibold">Conta aguardando ativação</h1><p className="text-sm opacity-60">Seu cadastro foi recebido. Assim que a conta for liberada, bots, IA e conversas ficam disponíveis. Você já pode ajustar seu perfil.</p></div></div>
          ) : children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
