import { config } from "../config";

export interface LeadData {
  nome: string;
  telefone: string;
  interesse: string;
  contactId: string;
}

const DEFAULT_TEMPLATE = `🔔 *NOVO LEAD CAPTADO*
━━━━━━━━━━━━━━
👤 *Nome:* {nome}
📱 *Telefone:* {telefone}
🎯 *Interesse:* {interesse}
🕐 {data}
━━━━━━━━━━━━━━
💬 Ver conversa: {link}`;

export function buildLeadCard(lead: LeadData, template?: string | null) {
  const vars: Record<string, string> = {
    nome: lead.nome,
    telefone: lead.telefone,
    interesse: lead.interesse,
    data: new Date().toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" }),
    link: `${config.panelUrl}/inbox/${lead.contactId}`,
  };
  return (template || DEFAULT_TEMPLATE).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
