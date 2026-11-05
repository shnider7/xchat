import { config } from "../config";
import { prisma } from "../db";
import { decrypt } from "./crypto";

let cache: { at: number; url: string; key: string } | null = null;

// Prioriza a integração EVOLUTION cadastrada no painel; cai para o .env
async function conn() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const i = await prisma.integration.findFirst({ where: { type: "EVOLUTION", active: true } });
  if (i) {
    const c = JSON.parse(decrypt(i.configEnc));
    cache = { at: Date.now(), url: c.url, key: c.apiKey };
  } else cache = { at: Date.now(), url: config.evolutionUrl, key: config.evolutionKey };
  return cache;
}
export const clearEvolutionCache = () => { cache = null; };

// `to`: número (5567999999999) ou JID de grupo (xxx@g.us)
export async function sendText(instance: string, to: string, text: string) {
  const c = await conn();
  const res = await fetch(`${c.url}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: c.key },
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) throw new Error(`Evolution sendText falhou: ${res.status}`);
  return res.json();
}
