import { config } from "../config";

export interface LeadData {
  nome: string;
  telefone: string;
  interesse: string;
  contactId: string;
  origem?: string;
}

const DEFAULT_TEMPLATE = `🔔 *NOVO LEAD CAPTADO*
━━━━━━━━━━━━━━
👤 *Nome:* {nome}
📱 *Telefone:* {telefone}
🎯 *Interesse:* {interesse}
🔎 *Origem:* {origem}
🕐 {data}
━━━━━━━━━━━━━━
💬 Ver conversa: {link}`;

export function buildLeadCard(lead: LeadData, template?: string | null) {
  const vars: Record<string, string> = {
    nome: lead.nome,
    telefone: lead.telefone,
    interesse: lead.interesse,
    origem: lead.origem || "não informada",
    data: new Date().toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" }),
    link: `${config.panelUrl}/inbox/${lead.contactId}`,
  };
  return (template || DEFAULT_TEMPLATE).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

const LABEL: Record<string, string> = { dm: "Direct", comment: "Comentário", story_reply: "Resposta a story", story_mention: "Menção em story", ad: "Anúncio", ref: "Link" };
// De onde o contato veio (guardado no primeiro contato): canal, comentário e campanha (UTM)
export const origemText = (c: any) => [LABEL[c.source] ?? c.source, c.sourceDetail ? `“${c.sourceDetail}”` : "", c.utm?.utm_campaign ? `campanha ${c.utm.utm_campaign}` : ""].filter(Boolean).join(" · ");
