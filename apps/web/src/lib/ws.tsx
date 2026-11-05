"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type Workspace = { id: string; name: string; instagram?: string | null };
const Ctx = createContext<{ list: Workspace[]; current: Workspace | null; select: (id: string) => void }>({ list: [], current: null, select: () => {} });
export const useWorkspace = () => useContext(Ctx);

export function WorkspaceProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [list, setList] = useState<Workspace[]>([]);
  const [id, setId] = useState<string>("");
  useEffect(() => {
    if (!enabled) return;
    api<Workspace[]>("workspaces").then((l) => { setList(l); setId(localStorage.getItem("ws") ?? ""); }).catch(() => {});
  }, [enabled]);
  const select = (v: string) => { setId(v); localStorage.setItem("ws", v); };
  // só considera selecionado um cliente que ainda existe na lista do usuário
  const current = list.find((w) => w.id === id) ?? null;
  return <Ctx.Provider value={{ list, current, select }}>{children}</Ctx.Provider>;
}
