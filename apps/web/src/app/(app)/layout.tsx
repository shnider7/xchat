"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRole } from "@/lib/api";
import { WorkspaceProvider, useWorkspace } from "@/lib/ws";

function Selector() {
  const { list, current, select } = useWorkspace();
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-600">Cliente
      <select value={current?.id ?? ""} onChange={(e) => select(e.target.value)}
        className="min-w-[240px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900">
        <option value="">Selecione um cliente…</option>
        {list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const r = useRouter();
  const [role, setRole] = useState("");
  useEffect(() => setRole(getRole()), []);
  const admin = role === "PLATFORM_ADMIN";
  const item = (href: string, label: string) => (
    <Link href={href} className={`block rounded-lg px-3 py-2.5 text-sm ${path === href ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"}`}>{label}</Link>);
  const soon = (label: string) => <span className="block px-3 py-2.5 text-sm text-zinc-400">{label} · em breve</span>;
  async function sair() { await fetch("/api/logout", { method: "POST" }); r.push("/login"); }

  return (
    <WorkspaceProvider enabled={!!role && !admin}>
      <div className="grid min-h-screen grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-1 border-r border-zinc-200 bg-white p-4">
          <div className="px-3 pb-4 text-lg font-semibold">ChatFlow</div>
          {admin ? <>{item("/admin", "Visão geral")}{soon("Conexões")}{soon("Gestores")}</> :
            <>{item("/inbox", "Inbox")}{soon("Contatos")}{soon("Fluxos")}{soon("Configurações")}</>}
          <button onClick={sair} className="mt-auto rounded-lg px-3 py-2.5 text-left text-sm text-zinc-500 hover:bg-zinc-50">Sair</button>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3.5">
            {admin ? <span className="text-sm text-zinc-500">Administração da plataforma</span> : <Selector />}
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
