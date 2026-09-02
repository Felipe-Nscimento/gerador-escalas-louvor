"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./supabase";

export interface Perfil {
  id: string;
  nome: string | null;
  role: "montador" | "lider";
}

export function useAuth() {
  const [carregando, setCarregando] = useState(supabaseConfigurado);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    if (!supabase) {
      setCarregando(false);
      return;
    }
    let ativo = true;

    async function carregarPerfil(uid: string) {
      const { data } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();
      if (ativo) setPerfil((data as Perfil) ?? null);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      const session = data.session;
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (session?.user.id) carregarPerfil(session.user.id);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (session?.user.id) carregarPerfil(session.user.id);
      else setPerfil(null);
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function sair() {
    await supabase?.auth.signOut();
  }

  return {
    supabaseConfigurado,
    carregando,
    userId,
    email,
    perfil,
    ehLider: perfil?.role === "lider",
    logado: Boolean(userId),
    sair,
  };
}
