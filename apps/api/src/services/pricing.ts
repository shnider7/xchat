// Estimativa do custo da IA em R$. A cobrança real vem do provedor de IA do próprio cliente.
// Ajuste no .env: USD_BRL, IOF, AI_PRICE_IN_USD_PER_M, AI_PRICE_OUT_USD_PER_M ou AI_PRICES={"modelo":[entrada,saida]}
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
const table = (): Record<string, [number, number]> => { try { return JSON.parse(process.env.AI_PRICES ?? "{}"); } catch { return {}; } };

export function estimateBrl(model: string, tokensIn: number, tokensOut: number) {
  const [pin, pout] = table()[model] ?? [num(process.env.AI_PRICE_IN_USD_PER_M, 3), num(process.env.AI_PRICE_OUT_USD_PER_M, 15)];
  return ((tokensIn * pin + tokensOut * pout) / 1e6) * num(process.env.USD_BRL, 5.5) * (1 + num(process.env.IOF, 0.035));
}
