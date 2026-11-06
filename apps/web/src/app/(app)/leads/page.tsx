"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { btn2, card, inp } from "@/lib/ui";
import { useWorkspace } from "@/lib/ws";

const CANAL: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM_DM: "Direct", INSTAGRAM_COMMENT: "Comentário" };
const COLS: [string, string, (c: any) => string][] = [
  ["nome", "Nome", (c) => c.name ?? "—"], ["telefone", "Telefone", (c) => c.phone ?? "—"], ["interesse", "Interesse", (c) => c.interest ?? "—"],
  ["canal", "Canal", (c) => CANAL[c.channel] ?? c.channel], ["tags", "Tags", (c) => c.tags.join(", ") || "—"],
  ["data", "Captado em", (c) => new Date(c.leadSentAt).toLocaleString("pt-BR")], ["ultima", "Última mensagem", (c) => c.messages[0]?.text ?? "—"],
];
const DENS: Record<string, string> = { compacta: "py-1.5", normal: "py-3", confortável: "py-5" };

export default function Leads() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [vis, setVis] = useState<string[]>(["nome", "telefone", "interesse", "data"]);
  const [dens, setDens] = useState("normal");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("leadCols") ?? "null"); if (Array.isArray(s)) setVis(s); } catch {} }, []);
  useEffect(() => {
    setRows([]); setErr("");
    if (current) api(`workspaces/${current.id}/contacts?lead=1`).then(setRows).catch((e) => setErr(e.message));
  }, [current?.id]);

  const cols = COLS.filter(([k]) => vis.includes(k));
  const shown = useMemo(() => rows.filter((c) => !q || cols.concat(COLS as any).some(([, , g]) => g(c).toLowerCase().includes(q.toLowerCase()))), [rows, q, vis]);
  const toggle = (k: string) => { const n = vis.includes(k) ? vis.filter((x) => x !== k) : [...vis, k]; setVis(n); localStorage.setItem("leadCols", JSON.stringify(n)); };
  function csv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const text = [cols.map(([, l]) => esc(l)).join(","), ...shown.map((c) => cols.map(([, , g]) => esc(g(c))).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" })); a.download = "leads.csv"; a.click();
  }

  if (!current) return <p className="p-8 text-sm opacity-60">Selecione um cliente no topo para ver os leads.</p>;
  return (
    <div className="space-y-4 p-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold">Leads · {current.name}</h1>
        <input className={inp + " !w-60"} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="relative">
          <button className={btn2} onClick={() => setOpen(!open)}>Colunas ({cols.length}/{COLS.length})</button>
          {open && <div className="glass absolute right-0 z-10 mt-2 w-52 space-y-1 rounded-xl p-3 text-sm">
            {COLS.map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={vis.includes(k)} onChange={() => toggle(k)} />{l}</label>)}</div>}
        </div>
        <select className={inp + " !w-auto"} value={dens} onChange={(e) => setDens(e.target.value)}>{Object.keys(DENS).map((d) => <option key={d}>{d}</option>)}</select>
        <button className={btn2} onClick={csv}>Exportar CSV</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className={card + " overflow-x-auto !p-0"}>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-xs opacity-60">{cols.map(([k, l]) => <th key={k} className="px-4 py-3 font-medium">{l}</th>)}</tr></thead>
          <tbody>{shown.map((c) => <tr key={c.id} className="border-b border-zinc-100">{cols.map(([k, , g]) => <td key={k} className={`max-w-xs truncate px-4 ${DENS[dens]}`}>{g(c)}</td>)}</tr>)}</tbody>
        </table>
        {!shown.length && <p className="p-6 text-sm opacity-60">Nenhum lead captado ainda.</p>}
      </div>
    </div>
  );
}
