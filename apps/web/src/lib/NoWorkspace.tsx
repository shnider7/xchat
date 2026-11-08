"use client";
import { useWorkspace } from "./ws";

// Aviso quando não há conta carregada (mostra o erro de verdade, em vez de pedir para escolher um cliente)
export default function NoWorkspace({ what }: { what: string }) {
  const { loaded, error, list } = useWorkspace();
  if (!loaded && !error) return null;
  if (error) return (
    <div className="space-y-2 p-8 text-sm">
      <p className="text-red-500">Não foi possível carregar sua conta: {error}</p>
      <p className="opacity-60">Se você acabou de atualizar o sistema, confirme que a migração do banco foi aplicada e que a API foi reiniciada.</p>
    </div>);
  if (!list.length) return <p className="p-8 text-sm opacity-60">Nenhuma conta disponível para {what}. Se a sua conta é nova, ela pode estar aguardando ativação.</p>;
  return <p className="p-8 text-sm opacity-60">Escolha uma conta no topo para ver {what}.</p>;
}
