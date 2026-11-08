// Instagram API com Instagram Login (graph.instagram.com). Limites da Meta: mensagem de até 1000 bytes;
// resposta privada a comentário só 1 vez e em até 7 dias; conversa aberta por 24h depois que a pessoa escreve.
const VER = process.env.META_GRAPH_VERSION ?? "v25.0";
const BASE = `https://graph.instagram.com/${VER}`;
export type Ig = { igId: string; token: string };

async function call(token: string, path: string, init?: { method?: string; body?: any }) {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${data?.error?.message ?? "erro"}`); // nunca inclui o token
  return data;
}

export const getMe = (token: string) => call(token, "/me?fields=user_id,username");
export const subscribe = (ig: Ig) => call(ig.token, `/${ig.igId}/subscribed_apps?subscribed_fields=messages,comments,messaging_postbacks`, { method: "POST" });
export const fetchProfile = (ig: Ig, igsid: string) => call(ig.token, `/${igsid}?fields=name,username`).catch(() => null);

function parts(t: string) { // quebra em mensagens de até ~900 bytes
  const out: string[] = []; let cur = "";
  for (const w of t.split(/(\s+)/)) { if (Buffer.byteLength(cur + w) > 900) { out.push(cur.trimEnd()); cur = w.trimStart(); } else cur += w; }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [t.slice(0, 300)];
}
export async function sendDM(ig: Ig, igsid: string, text: string) {
  for (const p of parts(text)) await call(ig.token, `/${ig.igId}/messages`, { method: "POST", body: { recipient: { id: igsid }, message: { text: p } } });
}
export const sendPrivateReply = (ig: Ig, commentId: string, text: string) =>
  call(ig.token, `/${ig.igId}/messages`, { method: "POST", body: { recipient: { comment_id: commentId }, message: { text: parts(text)[0] } } });
export const replyToComment = (ig: Ig, commentId: string, text: string) =>
  call(ig.token, `/${commentId}/replies`, { method: "POST", body: { message: text.slice(0, 2000) } });
