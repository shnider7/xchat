"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type Workspace = {
  id: string; name: string; instagram?: string | null; clientEmail?: string | null; evolutionInstance?: string | null;
  aiEnabled: boolean; aiProvider: string; aiModel: string; aiPrompt: string; leadDestination?: string | null; leadTemplate?: string | null;
};
const Ctx = createContext<{ list: Workspace[]; current: Workspace | null; select: (id: string) => void; reload: () => Promise<void> }>(
  { list: [], current: null, select: () => {}, reload: async () => {} });
export const useWorkspace = () => useContext(Ctx);

export function WorkspaceProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [list, setList] = useState<Workspace[]>([]);
  const [id, setId] = useState("");
  const reload = useCallback(async () => { setList(await api<Workspace[]>("workspaces")); }, []);
  useEffect(() => { if (enabled) { reload().catch(() => {}); setId(localStorage.getItem("ws") ?? ""); } }, [enabled, reload]);
  const select = (v: string) => { setId(v); localStorage.setItem("ws", v); };
  const current = list.find((w) => w.id === id) ?? null; // só vale cliente que ainda está na lista do usuário
  return <Ctx.Provider value={{ list, current, select, reload }}>{children}</Ctx.Provider>;
}
