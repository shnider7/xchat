"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { Workspace } from "@/lib/ws";

export default function Canais({ ws }: { ws: Workspace }) {
  const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState({ igUserId: "", accessToken: "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(() => api(`workspaces/${ws.id}/channels`).then(setList).catch(() => {}), [ws.id]);
  useEffect(() => { load(); }, [load]);

  async function conectar() {
    setMsg("");
    try { await api(`workspaces/${ws.id}/channels/instagram`, { method: "POST", body: JSON.stringify(f) }); setF({ igUserId: "", accessToken: "" }); setMsg("Instagram conectado."); load(); }
    catch (e: any) { setMsg(e.message); }
  }
  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className={card + " space-y-2"}>
        <div className="text-sm font-medium">WhatsApp (Evolution API)</div>
        <p className="text-sm text-zinc-600">Usado só para enviar avisos pela Evolution (como os leads captados). Não é um canal de conversas. Informe o nome da instância na aba <b>IA e API</b>.</p>
      </div>
      <div className={card + " space-y-4"}>
        <div className="text-sm font-medium">Instagram</div>
        {list.filter((c) => c.type === "INSTAGRAM").map((c) => (
          <div key={c.id} className="flex items-center justify-between text-sm"><span>{c.label} · conectado</span>
            <button className={btn2} onClick={async () => { await api(`channels/${c.id}`, { method: "DELETE" }); load(); }}>Desconectar</button></div>))}
        <p className="text-xs text-zinc-500">Cada conta tem apenas 1 Instagram. Conexão manual: precisa de uma conta profissional do Instagram ligada a uma Página do Facebook, e de um token de acesso gerado no app da Meta com as permissões de mensagens e comentários. O token é validado e guardado criptografado.</p>
        {!list.some((c) => c.type === "INSTAGRAM") && <>
        <input className={inp} placeholder="ID da conta do Instagram (só números)" value={f.igUserId} onChange={(e) => setF({ ...f, igUserId: e.target.value })} />
        <input className={inp} type="password" placeholder="Token de acesso" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} />
        <button className={btn} onClick={conectar}>Conectar Instagram</button>{msg && <span className="ml-3 text-sm text-zinc-600">{msg}</span>}
        </>}
        <p className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600">O <b>recebimento</b> de directs e comentários ainda não está ligado: falta o webhook da Meta. A conexão fica salva e validada. O "Entrar com Facebook" para clientes depende de um app da Meta aprovado.</p>
      </div>
    </div>
  );
}
