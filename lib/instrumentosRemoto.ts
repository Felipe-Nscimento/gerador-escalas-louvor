import { supabase } from "./supabase";
import { Instrumento } from "./types";

/** Formato da linha na tabela public.instrumentos. */
interface LinhaInstrumento {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  nome: string;
  emoji: string;
  obrigatorio: boolean;
}

function linhaParaInstrumento(l: LinhaInstrumento): Instrumento {
  return {
    id: l.id,
    nome: l.nome,
    emoji: l.emoji,
    obrigatorio: l.obrigatorio,
  };
}

function instrumentoParaColunas(patch: Partial<Instrumento>): Record<string, unknown> {
  const colunas: Record<string, unknown> = {};
  if (patch.nome !== undefined) colunas.nome = patch.nome;
  if (patch.emoji !== undefined) colunas.emoji = patch.emoji;
  if (patch.obrigatorio !== undefined) colunas.obrigatorio = patch.obrigatorio;
  return colunas;
}

export async function listarInstrumentosRemotos(): Promise<Instrumento[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("instrumentos")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((l) => linhaParaInstrumento(l as LinhaInstrumento));
}

/**
 * Cria preservando o id ORIGINAL (gerado no cliente com uid(), igual
 * sempre foi, inclusive para os padrão "voz"/"violao"/etc.) — nunca deixa
 * o banco gerar outro, pra Integrante.funcoes e escalas antigas (locais
 * ou já salvas no Supabase) continuarem funcionando.
 */
export async function criarInstrumentoRemoto(
  instrumento: Instrumento,
  userId: string
): Promise<Instrumento> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const linha = {
    id: instrumento.id,
    created_by: userId,
    ...instrumentoParaColunas(instrumento),
  };
  const { data, error } = await supabase
    .from("instrumentos")
    .insert(linha)
    .select()
    .single();
  if (error) throw error;
  return linhaParaInstrumento(data as LinhaInstrumento);
}

export async function atualizarInstrumentoRemoto(
  id: string,
  patch: Partial<Instrumento>
): Promise<Instrumento> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("instrumentos")
    .update(instrumentoParaColunas(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return linhaParaInstrumento(data as LinhaInstrumento);
}

/** Assina mudanças em tempo real na tabela; retorna uma função para cancelar a assinatura. */
export function assinarInstrumentosRemotos(callback: () => void): () => void {
  if (!supabase) return () => {};
  const cliente = supabase;
  const canal = cliente
    .channel("instrumentos_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "instrumentos" },
      callback
    )
    .subscribe();
  return () => {
    cliente.removeChannel(canal);
  };
}
