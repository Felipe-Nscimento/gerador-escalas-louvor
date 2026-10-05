import { supabase } from "./supabase";
import {
  DadosFormulario,
  FormularioCadastro,
  gerarToken,
  gerarUuid,
  DIAS_VALIDADE_LINK,
  normalizarInstagram,
  normalizarNome,
  normalizarWhatsapp,
} from "./formularios";
import { FotoPreparada } from "./imagemUpload";

const BUCKET = "fotos-integrantes";

/** Formato da linha em public.formularios_cadastro (+ instrumentos aninhados). */
interface LinhaFormulario {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  origem: "admin" | "link";
  status: FormularioCadastro["status"];
  token: string | null;
  link_expira_em: string | null;
  enviado_em: string | null;
  nome: string | null;
  whatsapp: string | null;
  instagram: string | null;
  endereco: string | null;
  data_aniversario: string | null;
  foto_path: string | null;
  integrante_id: string | null;
  formularios_cadastro_instrumentos?: { instrumento_id: string }[];
}

const SELECT_COM_INSTRUMENTOS = "*, formularios_cadastro_instrumentos(instrumento_id)";

/** URL pública da foto (bucket público, caminho com UUID impossível de adivinhar). */
export function urlPublicaFoto(path: string | null): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function linhaParaFormulario(l: LinhaFormulario): FormularioCadastro {
  return {
    id: l.id,
    created_at: l.created_at,
    updated_at: l.updated_at,
    created_by: l.created_by,
    origem: l.origem,
    status: l.status,
    token: l.token,
    link_expira_em: l.link_expira_em,
    enviado_em: l.enviado_em,
    nome: l.nome,
    whatsapp: l.whatsapp,
    instagram: l.instagram,
    endereco: l.endereco,
    data_aniversario: l.data_aniversario,
    foto_path: l.foto_path,
    foto_url: urlPublicaFoto(l.foto_path),
    integrante_id: l.integrante_id,
    instrumentos: (l.formularios_cadastro_instrumentos ?? []).map((i) => i.instrumento_id),
  };
}

function dadosParaColunas(d: DadosFormulario) {
  return {
    nome: normalizarNome(d.nome),
    whatsapp: normalizarWhatsapp(d.whatsapp),
    instagram: normalizarInstagram(d.instagram),
    endereco: d.endereco.trim() || null,
    data_aniversario: d.dataAniversario || null,
  };
}

// ---------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------
function idAleatorio(): string {
  return gerarUuid().replace(/-/g, "").slice(0, 12);
}

/** Envia a foto para formularios/{formularioId}/foto-{unico}.{ext} e devolve o caminho. */
export async function enviarFotoFormulario(
  formularioId: string,
  foto: FotoPreparada
): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const caminho = `formularios/${formularioId}/foto-${idAleatorio()}.${foto.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, foto.blob, { contentType: foto.tipo, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  return caminho;
}

export async function removerFotoDoStorage(caminho: string): Promise<void> {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([caminho]);
}

// ---------------------------------------------------------------------
// Área administrativa (líder / montador — protegida por RLS)
// ---------------------------------------------------------------------
export async function listarFormularios(): Promise<FormularioCadastro[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("formularios_cadastro")
    .select(SELECT_COM_INSTRUMENTOS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l) => linhaParaFormulario(l as unknown as LinhaFormulario));
}

export async function buscarFormulario(id: string): Promise<FormularioCadastro | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("formularios_cadastro")
    .select(SELECT_COM_INSTRUMENTOS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? linhaParaFormulario(data as unknown as LinhaFormulario) : null;
}

async function gravarInstrumentos(formularioId: string, atuais: string[], novos: string[]) {
  if (!supabase) return;
  const aAdicionar = novos.filter((id) => !atuais.includes(id));
  const aRemover = atuais.filter((id) => !novos.includes(id));
  if (aAdicionar.length > 0) {
    const { error } = await supabase
      .from("formularios_cadastro_instrumentos")
      .insert(aAdicionar.map((instrumento_id) => ({ formulario_id: formularioId, instrumento_id })));
    if (error) throw error;
  }
  if (aRemover.length > 0) {
    const { error } = await supabase
      .from("formularios_cadastro_instrumentos")
      .delete()
      .eq("formulario_id", formularioId)
      .in("instrumento_id", aRemover);
    if (error) throw error;
  }
}

/** Cadastro criado diretamente pela equipe (botão "Novo Formulário"). */
export async function criarFormulario(
  id: string,
  dados: DadosFormulario,
  userId: string,
  fotoPath: string | null
): Promise<FormularioCadastro> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("formularios_cadastro").insert({
    id,
    created_by: userId,
    origem: "admin",
    status: "pendente",
    foto_path: fotoPath,
    ...dadosParaColunas(dados),
  });
  if (error) throw error;
  await gravarInstrumentos(id, [], dados.instrumentos);
  const criado = await buscarFormulario(id);
  if (!criado) throw new Error("Cadastro criado, mas não foi possível relê-lo.");
  return criado;
}

/**
 * Atualiza os dados. `fotoPath`: undefined = não mexe na foto; null = remove a
 * foto; string = nova foto. A foto antiga só é apagada do Storage se nenhum
 * integrante estiver usando o mesmo arquivo.
 */
export async function atualizarFormulario(
  atual: FormularioCadastro,
  dados: DadosFormulario,
  fotoPath: string | null | undefined
): Promise<FormularioCadastro> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const patch: Record<string, unknown> = dadosParaColunas(dados);
  if (fotoPath !== undefined) patch.foto_path = fotoPath;
  const { error } = await supabase.from("formularios_cadastro").update(patch).eq("id", atual.id);
  if (error) throw error;
  await gravarInstrumentos(atual.id, atual.instrumentos, dados.instrumentos);

  if (fotoPath !== undefined && atual.foto_path && atual.foto_path !== fotoPath && !atual.integrante_id) {
    removerFotoDoStorage(atual.foto_path).catch(() => {});
  }
  const atualizado = await buscarFormulario(atual.id);
  if (!atualizado) throw new Error("Cadastro atualizado, mas não foi possível relê-lo.");
  return atualizado;
}

/**
 * Exclui o cadastro. A foto só sai do Storage se ele ainda não virou
 * integrante — quando já virou, o integrante continua apontando para o
 * mesmo arquivo e ele precisa ficar.
 */
export async function excluirFormulario(f: FormularioCadastro): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("formularios_cadastro").delete().eq("id", f.id);
  if (error) throw error;
  if (f.foto_path && f.status !== "utilizado" && !f.integrante_id) {
    removerFotoDoStorage(f.foto_path).catch(() => {});
  }
}

/** Gera um link (token aleatório de 256 bits) válido por DIAS_VALIDADE_LINK dias. */
export async function gerarLinkFormulario(userId: string): Promise<FormularioCadastro> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const expira = new Date(Date.now() + DIAS_VALIDADE_LINK * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("formularios_cadastro")
    .insert({
      created_by: userId,
      origem: "link",
      status: "aguardando",
      token: gerarToken(),
      link_expira_em: expira,
    })
    .select(SELECT_COM_INSTRUMENTOS)
    .single();
  if (error) throw error;
  return linhaParaFormulario(data as unknown as LinhaFormulario);
}

export async function marcarFormularioComoUtilizado(
  id: string,
  integranteId: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase
    .from("formularios_cadastro")
    .update({ status: "utilizado", integrante_id: integranteId })
    .eq("id", id);
  if (error) throw error;
}

/** Assina mudanças em tempo real na tabela; retorna uma função para cancelar a assinatura. */
export function assinarFormularios(callback: () => void): () => void {
  if (!supabase) return () => {};
  const cliente = supabase;
  const canal = cliente
    .channel("formularios_cadastro_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "formularios_cadastro" },
      callback
    )
    .subscribe();
  return () => {
    cliente.removeChannel(canal);
  };
}

// ---------------------------------------------------------------------
// Formulário PÚBLICO (sem login) — só conversa com as funções do banco
// ---------------------------------------------------------------------
export interface InstrumentoPublico {
  id: string;
  nome: string;
  emoji: string;
}

export type InfoFormularioPublico =
  | { ok: true; formularioId: string; instrumentos: InstrumentoPublico[] }
  | { ok: false; motivo: string };

export async function buscarFormularioPublico(token: string): Promise<InfoFormularioPublico> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.rpc("formulario_publico_info", { p_token: token });
  if (error) throw error;
  const r = data as { ok: boolean; motivo?: string; formulario_id?: string; instrumentos?: InstrumentoPublico[] };
  if (!r?.ok) return { ok: false, motivo: r?.motivo ?? "invalido" };
  return { ok: true, formularioId: r.formulario_id as string, instrumentos: r.instrumentos ?? [] };
}

export async function enviarFormularioPublico(
  token: string,
  dados: DadosFormulario,
  fotoPath: string | null
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const c = dadosParaColunas(dados);
  const { data, error } = await supabase.rpc("formulario_publico_enviar", {
    p_token: token,
    p_nome: c.nome,
    p_whatsapp: c.whatsapp,
    p_instagram: c.instagram,
    p_endereco: c.endereco,
    p_data_aniversario: c.data_aniversario,
    p_foto_path: fotoPath,
    p_instrumentos: dados.instrumentos,
  });
  if (error) throw error;
  const r = data as { ok: boolean; motivo?: string };
  return r?.ok ? { ok: true } : { ok: false, motivo: r?.motivo ?? "invalido" };
}
