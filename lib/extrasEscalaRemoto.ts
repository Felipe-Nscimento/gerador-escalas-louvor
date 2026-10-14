import { supabase } from "./supabase";

/** Link da playlist de um culto (um por data + culto). */
export interface PlaylistCulto {
  data: string; // YYYY-MM-DD
  culto: string; // título do culto em minúsculas, igual ao usado no card
  url: string;
}

export type TipoAviso = "reuniao" | "confraternizacao" | "estudo" | "outro";

/** Aviso de atividade extra culto (reunião, confraternização, estudo...). */
export interface AvisoEquipe {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  data: string; // YYYY-MM-DD
  horario?: string | null;
  local?: string | null;
}

export const TIPOS_AVISO: { id: TipoAviso; label: string; emoji: string }[] = [
  { id: "reuniao", label: "Reunião", emoji: "👥" },
  { id: "confraternizacao", label: "Confraternização", emoji: "🎉" },
  { id: "estudo", label: "Estudo", emoji: "📖" },
  { id: "outro", label: "Outro", emoji: "📌" },
];

/** Chave do culto usada para casar o card com a playlist. */
export function chaveDoCulto(titulo: string): string {
  return titulo.trim().toLowerCase();
}

/** Só aceita links http(s) sem espaços. Devolve o link limpo ou null se for inválido. */
export function normalizarLinkPlaylist(texto: string): string | null {
  const t = texto.trim();
  if (!t || t.length > 500 || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? t : null;
  } catch {
    return null;
  }
}

export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Regra de exibição: o aviso aparece durante o MÊS do evento e some depois da data.
 * "visivel" = já está no mês do evento e a data ainda não passou; "agendado" = é de um mês futuro.
 */
export function situacaoDoAviso(dataAviso: string, hoje: Date): "visivel" | "agendado" | "encerrado" {
  const hojeKey = dataISO(hoje);
  const d = dataAviso.slice(0, 10);
  if (d < hojeKey) return "encerrado";
  return d.slice(0, 7) === hojeKey.slice(0, 7) ? "visivel" : "agendado";
}

// ---------------------------------------------------------------- banco (Líder/Montador)

export async function listarPlaylists(): Promise<PlaylistCulto[]> {
  if (!supabase) return [];
  const desde = new Date();
  desde.setDate(desde.getDate() - 120);
  const { data, error } = await supabase
    .from("playlists_culto")
    .select("data, culto, url")
    .gte("data", dataISO(desde));
  if (error) throw error;
  return (data ?? []) as PlaylistCulto[];
}

export async function salvarPlaylist(data: string, culto: string, url: string, userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase
    .from("playlists_culto")
    .upsert({ data, culto, url, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "data,culto" });
  if (error) throw error;
}

export async function removerPlaylist(data: string, culto: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("playlists_culto").delete().eq("data", data).eq("culto", culto);
  if (error) throw error;
}

/** Avisos de hoje em diante (os que já passaram não são mais necessários). */
export async function listarAvisos(): Promise<AvisoEquipe[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("avisos_equipe")
    .select("id, tipo, titulo, data, horario, local_descricao")
    .gte("data", dataISO(new Date()))
    .order("data", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as (Omit<AvisoEquipe, "local"> & { local_descricao: string | null })[]).map((a) => ({
    id: a.id,
    tipo: a.tipo,
    titulo: a.titulo,
    data: a.data,
    horario: a.horario,
    local: a.local_descricao,
  }));
}

export async function salvarAviso(a: AvisoEquipe, userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("avisos_equipe").upsert(
    {
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo.trim(),
      data: a.data,
      horario: a.horario?.trim() || null,
      local_descricao: a.local?.trim() || null,
      created_by: userId,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function excluirAviso(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("avisos_equipe").delete().eq("id", id);
  if (error) throw error;
}
