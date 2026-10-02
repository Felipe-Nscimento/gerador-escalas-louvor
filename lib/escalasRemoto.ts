import { supabase } from "./supabase";
import { PayloadEscala, StatusEscala } from "./types";

/** Erro de negócio ao atualizar uma escala remota (com o motivo já explicado em português). */
export class ErroEscalaRemota extends Error {
  motivo: "inexistente" | "sem_permissao";
  constructor(motivo: "inexistente" | "sem_permissao", mensagem: string) {
    super(mensagem);
    this.name = "ErroEscalaRemota";
    this.motivo = motivo;
  }
}

export interface EscalaRemota {
  id: string;
  created_at: string;
  created_by: string;
  status: StatusEscala;
  payload: PayloadEscala;
  motivo_devolucao: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

/** Confere se o payload tem o formato mínimo esperado (protege contra linhas antigas/manuais malformadas). */
export function payloadValido(payload: unknown): payload is PayloadEscala {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Partial<PayloadEscala>;
  return (
    !!p.config &&
    typeof p.config.mes === "number" &&
    typeof p.config.ano === "number" &&
    Array.isArray(p.domingos) &&
    Array.isArray(p.integrantes) &&
    Array.isArray(p.instrumentos)
  );
}

export async function listarEscalasRemotas(): Promise<EscalaRemota[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("escalas_aprovacao")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EscalaRemota[];
}

export async function criarEscalaRemota(
  payload: PayloadEscala,
  userId: string,
  status: StatusEscala = "aguardando_aprovacao"
): Promise<EscalaRemota> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("escalas_aprovacao")
    .insert({ created_by: userId, status, payload })
    .select()
    .single();
  if (error) throw error;
  return data as EscalaRemota;
}

export async function atualizarEscalaRemota(
  id: string,
  patch: Partial<
    Pick<
      EscalaRemota,
      "status" | "payload" | "motivo_devolucao" | "approved_by" | "approved_at"
    >
  >
): Promise<EscalaRemota> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("escalas_aprovacao")
    .update(patch)
    .eq("id", id)
    .select();
  if (error) throw error;
  if (data && data.length > 0) return data[0] as EscalaRemota;

  // Nenhuma linha foi atualizada. Como a leitura é liberada para qualquer
  // pessoa logada, dá pra descobrir o motivo em vez de mostrar um erro técnico.
  const { data: existente } = await supabase
    .from("escalas_aprovacao")
    .select("id, created_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!existente) {
    throw new ErroEscalaRemota(
      "inexistente",
      "Esta escala não existe mais na nuvem (foi excluída)."
    );
  }

  const statusLinha = (existente as { status: StatusEscala }).status;
  if (statusLinha === "aprovada" || statusLinha === "publicada") {
    throw new ErroEscalaRemota(
      "sem_permissao",
      "Esta escala já foi aprovada/publicada e só o líder pode alterá-la."
    );
  }
  throw new ErroEscalaRemota(
    "sem_permissao",
    "Você não tem permissão para alterar esta escala: ela foi criada por outra conta. Entre com a conta que a criou ou peça ao líder."
  );
}

export async function excluirEscalaRemota(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.from("escalas_aprovacao").delete().eq("id", id);
  if (error) throw error;
}

/** Assina mudanças em tempo real na tabela; retorna uma função para cancelar a assinatura. */
export function assinarEscalasRemotas(callback: () => void): () => void {
  if (!supabase) return () => {};
  const cliente = supabase;
  const canal = cliente
    .channel("escalas_aprovacao_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "escalas_aprovacao" },
      callback
    )
    .subscribe();
  return () => {
    cliente.removeChannel(canal);
  };
}
