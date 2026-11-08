"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { btn2, card, inp } from "@/lib/ui";

const dt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const left = (d: string | null) => (d ? Math.ceil((+new Date(d) - Date.now()) / 864e5) : null);

function Inner() {
  const s = useSearchParams().get("s") ?? "all";
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(() => api(`admin/users?status=${s}&q=${encodeURIComponent(q)}`).then((d) => { setRows(d.users); setCounts(d.counts); setErr(""); }).catch((e) => setErr(e.message)), [s, q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const patch = (id: string, body: object) => api(`admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then(load).catch((e) => setErr(e.message));
  const plus30 = (u: any) => { const b = u.activeUntil && new Date(u.activeUntil) > new Date() ? new Date(u.activeUntil) : new Date(); b.setDate(b.getDate() + 30); patch(u.id, { activeUntil: b.toISOString().slice(0, 10) }); };

  return (
    <div className="space-y-4 p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-lg font-semibold">Usuários</h1>
          <p className="text-xs opacity-60">{counts.all ?? 0} contas · {counts.active ?? 0} ativas · {counts.inactive ?? 0} desativadas · {counts.expiring ?? 0} a vencer. O vencimento só avisa: nada é desativado sozinho.</p></div>
        <input className={inp + " !w-64 !rounded-full"} placeholder="Buscar por email ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <div className={card + " overflow-x-auto !p-0"}>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-black/10 text-xs opacity-60 dark:border-white/10"><th className="px-4 py-3 font-medium">Usuário</th><th className="px-4 py-3 font-medium">Acesso</th><th className="px-4 py-3 font-medium">Vencimento</th><th className="px-4 py-3 font-medium" title="Limite de respostas de IA por mês (proteção contra gasto inesperado)">IA/mês</th><th className="px-4 py-3 font-medium">Último acesso</th><th className="px-4 py-3 font-medium">Cadastro</th></tr></thead>
          <tbody>
            {rows.map((u) => { const d = left(u.activeUntil); return (
              <tr key={u.id} className="border-b border-black/5 transition hover:bg-black/[.03] dark:border-white/5 dark:hover:bg-white/[.04]">
                <td className="px-4 py-3"><div className="font-medium">{u.name}</div><div className="text-xs opacity-60">{u.email}</div></td>
                <td className="px-4 py-3">
                  <button role="switch" aria-checked={u.active} onClick={() => patch(u.id, { active: !u.active })} className="flex items-center gap-2 text-xs">
                    <span className={`relative h-5 w-9 rounded-full transition-colors ${u.active ? "bg-blue-500" : "bg-zinc-400/50"}`}><i className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${u.active ? "left-[18px]" : "left-0.5"}`} /></span>{u.active ? "Ativa" : "Desativada"}
                  </button></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input type="date" className={inp + " !w-36 !py-1.5 !text-xs"} value={u.activeUntil ? u.activeUntil.slice(0, 10) : ""} onChange={(e) => patch(u.id, { activeUntil: e.target.value || null })} />
                    <button className={btn2 + " !px-3 !py-1 text-xs"} onClick={() => plus30(u)}>+30 dias</button>
                    {d !== null && d <= 7 && <span className={`chip text-[11px] ${d < 0 ? "text-red-500" : "text-amber-600 dark:text-amber-300"}`}>{d < 0 ? "vencida" : `vence em ${d}d`}</span>}
                  </div></td>
                <td className="px-4 py-3"><input type="number" min={0} defaultValue={u.aiLimit ?? ""} key={u.id + String(u.aiLimit)} onBlur={(e) => { const v = Number(e.target.value); if (e.target.value !== "" && !Number.isNaN(v) && v !== u.aiLimit) patch(u.id, { aiLimit: v }); }} className={inp + " !w-24 !py-1.5 !text-xs"} /></td>
                <td className="px-4 py-3 text-xs opacity-70">{dt(u.ultimoAcesso)}</td>
                <td className="px-4 py-3 text-xs opacity-70">{dt(u.createdAt)}</td>
              </tr>); })}
          </tbody>
        </table>
        {!rows.length && !err && <p className="p-6 text-sm opacity-60">Nenhuma conta neste filtro.</p>}
      </div>
    </div>
  );
}
export default function Usuarios() { return <Suspense fallback={null}><Inner /></Suspense>; }
