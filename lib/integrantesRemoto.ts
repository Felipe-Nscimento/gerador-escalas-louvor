import { supabase } from "./supabase";
import { Integrante } from "./types";

/** Formato da linha na tabela public.integrantes (snake_case, igual ao banco). */
interface LinhaIntegrante {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  nome: string;
  nome_exibicao: string | null;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  endereco: string | null;
  data_aniversario: string | null;
  foto: string | null;
  ativo: boolean;
  funcoes: string[];
  niveis: Integrante["niveis"];
  observacoes_musicais: string | null;
  disponibilidade: Integrante["disponibilidade"] | null;
  preferencias: string[] | null;
  restricoes: Integrante["restricoes"] | null;
}

function linhaParaIntegrante(l: LinhaIntegrante): Integrante {
  return {
    id: l.id,
    nome: l.nome,
    nomeExibicao: l.nome_exibicao ?? undefined,
    telefone: l.telefone ?? undefined,
    email: l.email ?? undefined,
    instagram: l.instagram ?? undefined,
    endereco: l.endereco ?? undefined,
    dataAniversario: l.data_aniversario ?? undefined,
    foto: l.foto ?? undefined,
    ativo: l.ativo,
    funcoes: l.funcoes ?? [],
    niveis: l.niveis && l.niveis.length > 0 ? l.niveis : undefined,
    observacoesMusicais: l.observacoes_musicais ?? undefined,
    disponibilidade: l.disponibilidade ?? undefined,
    preferencias: l.preferencias && l.preferencias.length > 0 ? l.preferencias : undefined,
    restricoes: l.restricoes ?? undefined,
  };
}

/** Só os campos presentes em `patch` viram colunas no update/insert (evita apagar o resto sem querer). */
function integranteParaColunas(patch: Partial<Integrante>): Record<string, unknown> {
  const colunas: Record<string, unknown> = {};
  if (patch.nome !== undefined) colunas.nome = patch.nome;
  if (patch.nomeExibicao !== undefined) colunas.nome_exibicao = patch.nomeExibicao ?? null;
  if (patch.telefone !== undefined) colunas.telefone = patch.telefone ?? null;
  if (patch.email !== undefined) colunas.email = patch.email ?? null;
  if (patch.instagram !== undefined) colunas.instagram = patch.instagram || null;
  if (patch.endereco !== undefined) colunas.endereco = patch.endereco || null;
  if (patch.dataAniversario !== undefined) colunas.data_aniversario = patch.dataAniversario || null;
  if (patch.foto !== undefined) colunas.foto = patch.foto ?? null;
  if (patch.ativo !== undefined) colunas.ativo = patch.ativo;
  if (patch.funcoes !== undefined) colunas.funcoes = patch.funcoes;
  if (patch.niveis !== undefined) colunas.niveis = patch.niveis ?? [];
  if (patch.observacoesMusicais !== undefined)
    colunas.observacoes_musicais = patch.observacoesMusicais ?? null;
  if (patch.disponibilidade !== undefined)
    colunas.disponibilidade = patch.disponibilidade ?? null;
  if (patch.preferencias !== undefined) colunas.preferencias = patch.preferencias ?? [];
  if (patch.restricoes !== undefined) colunas.restricoes = patch.restricoes ?? null;
  return colunas;
}

export async function listarIntegrantesRemotos(): Promise<Integrante[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("integrantes")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((l) => linhaParaIntegrante(l as LinhaIntegrante));
}

/**
 * Cria preservando o id ORIGINAL (gerado no cliente com uid(), igual sempre
 * foi) — nunca deixa o banco gerar outro, pra escalas antigas (locais ou já
 * salvas no Supabase) que referenciam esse id continuarem funcionando.
 */
/** Marca gravada em todo integrante criado por esta versão do app. */
const ORIGEM_APP = "app-v2";

export async function criarIntegranteRemoto(
  integrante: Integrante,
  userId: string
): Promise<Integrante> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const linha = {
    id: integrante.id,
    created_by: userId,
    // O banco só aceita novos integrantes com esta marca (migration_integrantes_origem.sql):
    // versões antigas do app, que recriavam cadastros apagados, passam a ser recusadas.
    origem: ORIGEM_APP,
    ...integranteParaColunas(integrante),
  };
  const { data, error } = await supabase
    .from("integrantes")
    .insert(linha)
    .select()
    .single();
  if (error) throw error;
  return linhaParaIntegrante(data as LinhaIntegrante);
}

export async function atualizarIntegranteRemoto(
  id: string,
  patch: Partial<Integrante>
): Promise<Integrante> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("integrantes")
    .update(integranteParaColunas(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return linhaParaIntegrante(data as LinhaIntegrante);
}

/**
 * Exclusão física — usada só quando a pessoa pede explicitamente pra
 * excluir (ex: cadastro duplicado). Escalas antigas não quebram: elas
 * guardam uma cópia do integrante congelada no próprio payload, não uma
 * referência viva a esta tabela.
 */
export async function excluirIntegranteRemoto(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("integrantes").delete().eq("id", id);
  if (error) throw error;
}

/** Assina mudanças em tempo real na tabela; retorna uma função para cancelar a assinatura. */
export function assinarIntegrantesRemotos(callback: () => void): () => void {
  if (!supabase) return () => {};
  const cliente = supabase;
  const canal = cliente
    .channel("integrantes_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "integrantes" },
      callback
    )
    .subscribe();
  return () => {
    cliente.removeChannel(canal);
  };
}
