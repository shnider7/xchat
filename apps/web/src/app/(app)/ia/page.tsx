"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/lib/ws";
import NoWorkspace from "@/lib/NoWorkspace";
import Canais from "./Canais";
import Chatbots from "./Chatbots";
import Config from "./Config";

// As abas (Chatbots, IA e API, Canais) ficam no submenu da barra superior: ?aba=ia | canais
function Inner() {
  const { current } = useWorkspace();
  const aba = useSearchParams().get("aba") ?? "bots";
  if (!current) return <NoWorkspace what="chatbots, IA e canais" />;
  return <>{aba === "bots" && <Chatbots ws={current} />}{aba === "ia" && <Config />}{aba === "canais" && <Canais ws={current} />}</>;
}
export default function IA() { return <Suspense fallback={null}><Inner /></Suspense>; }
