"use client";

import { useEffect, useState } from "react";

const KEYS = {
  integrantes: "louvor:integrantes",
  instrumentos: "louvor:instrumentos",
  config: "louvor:config",
  escalas: "louvor:escalas",
  tema: "louvor:tema",
  escalaAtual: "louvor:escalaAtual",
};

export { KEYS };

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage indisponível (modo privado, quota excedida, etc.)
  }
}

/**
 * Hook genérico que mantém um estado sincronizado com o LocalStorage.
 * Carrega o valor salvo na montagem e persiste toda alteração subsequente.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    setState(readStorage<T>(key, initialValue));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (loaded) {
      writeStorage(key, state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loaded]);

  return [state, setState, loaded];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
