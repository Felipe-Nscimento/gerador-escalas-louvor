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
  // false enquanto o app ainda confere, no banco, se o e-mail logado é Líder/Montador
  const [acessoVerificado, setAcessoVerificado] = useState(!supabaseConfigurado);

  useEffect(() => {
    if (!supabase) {
      setCarregando(false);
      return;
    }
    let ativo = true;

    // O perfil vem do cadastro de Integrantes: o banco compara o e-mail do login com o
    // e-mail cadastrado e devolve "lider", "montador" ou nada (sem acesso).
    async function carregarPerfil(uid: string) {
      const { data, error } = await supabase!.rpc("perfil_de_acesso");
      if (!ativo) return;
      if (error) {
        setPerfil(null);
        setAcessoVerificado(false);
        return;
      }
      setPerfil(data === "lider" || data === "montador" ? { id: uid, nome: null, role: data } : null);
      setAcessoVerificado(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      const session = data.session;
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (session?.user.id) carregarPerfil(session.user.id);
      else setAcessoVerificado(true);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (session?.user.id) {
        setAcessoVerificado(false);
        carregarPerfil(session.user.id);
      } else {
        setPerfil(null);
        setAcessoVerificado(true);
      }
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
    acessoVerificado,
    ehLider: perfil?.role === "lider",
    logado: Boolean(userId),
    sair,
  };
}
