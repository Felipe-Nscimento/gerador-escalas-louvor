"use client";

import { useEffect } from "react";
import { KEYS, usePersistedState } from "./storage";

export type Tema = "claro" | "escuro";

/** Tema claro/escuro, guardado no aparelho e compartilhado por todas as telas do app. */
export function useTema() {
  const [tema, setTema] = usePersistedState<Tema>(KEYS.tema, "claro");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  return { tema, alternarTema: () => setTema((t) => (t === "claro" ? "escuro" : "claro")) };
}
