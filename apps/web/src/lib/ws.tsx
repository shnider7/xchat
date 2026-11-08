"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type Workspace = {
  id: string; name: string; own?: boolean; instagram?: string | null; clientEmail?: string | null; evolutionInstance?: string | null;
  aiEnabled: boolean; aiProvider: string; aiModel: string; aiPrompt: string; leadDestination?: string | null; leadTemplate?: string | null; aiBudgetBrl?: number;
};
const Ctx = createContext<{ list: Workspace[]; current: Workspace | null; loaded: boolean; error: string; select: (id: string) => void; reload: () => Promise<void> }>(
  { list: [], current: null, loaded: false, error: "", select: () => {}, reload: async () => {} });
export const useWorkspace = () => useContext(Ctx);

export function WorkspaceProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [list, setList] = useState<Workspace[]>([]);
  const [id, setId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try { setList(await api<Workspace[]>("workspaces")); setError(""); } catch (e: any) { setError(e.message); } finally { setLoaded(true); }
  }, []);
  useEffect(() => { if (enabled) { reload(); setId(localStorage.getItem("ws") ?? ""); } }, [enabled, reload]);
  const select = (v: string) => { setId(v); localStorage.setItem("ws", v); };
  // Sem escolha feita, vale a conta da própria pessoa; só aparece escolha se houver outras contas vinculadas
  const current = list.find((w) => w.id === id) ?? list.find((w) => w.own) ?? list[0] ?? null;
  return <Ctx.Provider value={{ list, current, loaded, error, select, reload }}>{children}</Ctx.Provider>;
}
