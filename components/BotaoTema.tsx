"use client";

import { Moon, Sun } from "lucide-react";
import { Tema } from "@/lib/useTema";

/** Botão redondo para alternar entre tema claro e escuro. */
export function BotaoTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tema === "claro" ? "Ativar tema escuro" : "Ativar tema claro"}
      title={tema === "claro" ? "Tema escuro" : "Tema claro"}
      className="h-11 w-11 shrink-0 rounded-2xl bg-[hsl(var(--card))] shadow-sm flex items-center justify-center"
    >
      {tema === "claro" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}
