import { supabase } from "./supabase";

const CHAVE_ORDEM_FUNCOES = "ordem_funcoes";

/**
 * Lê a ordem das funções salva na nuvem.
 * - `undefined`  → nunca foi salva (linha não existe)
 * - `[]`         → alguém restaurou a ordem padrão de propósito
 * - `string[]`   → ids dos instrumentos na ordem escolhida
 */
export async function carregarOrdemFuncoesRemota(): Promise<string[] | undefined> {
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from("preferencias_app")
    .select("valor")
    .eq("chave", CHAVE_ORDEM_FUNCOES)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const valor = (data as { valor: unknown }).valor;
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

/** Salva a ordem (use [] para voltar ao padrão). Cria a linha se ainda não existir. */
export async function salvarOrdemFuncoesRemota(
  ids: string[],
  userId: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase
    .from("preferencias_app")
    .upsert(
      { chave: CHAVE_ORDEM_FUNCOES, valor: ids, updated_by: userId },
      { onConflict: "chave" }
    );
  if (error) throw error;
}

/** Assina mudanças em tempo real; retorna uma função para cancelar a assinatura. */
export function assinarPreferenciasRemotas(callback: () => void): () => void {
  if (!supabase) return () => {};
  const cliente = supabase;
  const canal = cliente
    .channel("preferencias_app_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "preferencias_app" },
      callback
    )
    .subscribe();
  return () => {
    cliente.removeChannel(canal);
  };
}
