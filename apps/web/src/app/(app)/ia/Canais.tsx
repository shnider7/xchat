"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { btn, btn2, card, inp } from "@/lib/ui";
import { Workspace } from "@/lib/ws";

export default function Canais({ ws }: { ws: Workspace }) {
  const [list, setList] = useState<any[]>([]);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`workspaces/${ws.id}/channels`).then(setList).catch(() => {}), [ws.id]);
  useEffect(() => { load(); }, [load]);
  const ig = list.find((c) => c.type === "INSTAGRAM");

  async function conectar() {
    setMsg(""); setBusy(true);
    try {
      const r = await api(`workspaces/${ws.id}/channels/instagram`, { method: "POST", body: JSON.stringify({ accessToken: token }) });
      setToken(""); setMsg(r.webhook ? `Conectado: ${r.label}.` : `Conectado: ${r.label}, mas não consegui ligar os avisos (webhook). Confira a configuração do app na Meta.`); load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className={card + " space-y-2"}>
        <div className="text-sm font-medium">WhatsApp (Evolution API)</div>
        <p className="text-sm opacity-70">Usado só para enviar avisos pela Evolution (como os leads captados). Não é um canal de conversas. Informe o nome da instância na aba <b>IA e API</b>.</p>
      </div>
      <div className={card + " space-y-4"}>
        <div className="text-sm font-medium">Instagram</div>
        {ig ? (
          <div className="flex items-center justify-between text-sm"><span>{ig.label} · conectado</span>
            <button className={btn2} onClick={async () => { await api(`channels/${ig.id}`, { method: "DELETE" }); setMsg(""); load(); }}>Desconectar</button></div>
        ) : (<>
          <p className="text-xs opacity-60">Cole o token de acesso da sua conta profissional do Instagram, gerado no painel do app da Meta (Instagram com login do Instagram). O sistema descobre a conta sozinho, guarda o token criptografado e liga o recebimento de directs e comentários. Cada conta tem apenas 1 Instagram.</p>
          <input className={inp} type="password" placeholder="Token de acesso do Instagram" value={token} onChange={(e) => setToken(e.target.value)} />
          <button className={btn} onClick={conectar} disabled={busy || token.length < 20}>{busy ? "Conectando…" : "Conectar Instagram"}</button>
        </>)}
        {msg && <p className="text-sm opacity-80">{msg}</p>}
        <p className="rounded-xl bg-black/[.04] p-3 text-xs opacity-70 dark:bg-white/5">Directs, respostas e menções em stories e comentários passam a chegar nas Conversas e a acionar os chatbots cujo gatilho combinar. Em modo de desenvolvimento da Meta, isso vale para contas que têm função no app (administrador, desenvolvedor ou testador).</p>
      </div>
    </div>
  );
}
