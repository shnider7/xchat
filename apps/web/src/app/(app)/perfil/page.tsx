"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/ws";
import NoWorkspace from "@/lib/NoWorkspace";
import Canais from "../ia/Canais";
import Conta from "./Conta";
import Gestao from "./Gestao";

// As abas ficam no submenu da barra superior: ?aba=instagram | gestao
function Inner() {
  const { current } = useWorkspace();
  const aba = useSearchParams().get("aba") ?? "conta";
  const [role, setRole] = useState("");
  useEffect(() => { api("me").then((u) => setRole(u.role)).catch(() => {}); }, []);
  if (!role) return null;
  const tab = role === "PLATFORM_ADMIN" ? "conta" : aba;
  return (
    <>
      {tab === "conta" && <Conta />}
      {tab === "instagram" && (current ? <Canais ws={current} /> : <NoWorkspace what="o Instagram" />)}
      {tab === "gestao" && <Gestao />}
    </>
  );
}
export default function Perfil() { return <Suspense fallback={null}><Inner /></Suspense>; }
