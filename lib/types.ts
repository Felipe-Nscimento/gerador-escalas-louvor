/** Um instrumento/função cadastrável (Voz, Violão, Cajon, o que for). */
export interface Instrumento {
  id: string;
  nome: string;
  emoji: string;
  obrigatorio: boolean; // se true, a geração automática tenta sempre preencher
}

export const INSTRUMENTOS_PADRAO: Instrumento[] = [
  { id: "voz", nome: "Voz", emoji: "🎤", obrigatorio: true },
  { id: "violao", nome: "Violão", emoji: "🎸", obrigatorio: true },
  { id: "teclado", nome: "Teclado", emoji: "🎹", obrigatorio: true },
  { id: "bateria", nome: "Bateria", emoji: "🥁", obrigatorio: true },
  { id: "baixo", nome: "Baixo", emoji: "🎸", obrigatorio: false },
];

export type NivelExperiencia = "iniciante" | "intermediario" | "avancado";

export const NIVEL_LABEL: Record<NivelExperiencia, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

/** Nível de experiência do integrante numa função/instrumento específico. */
export interface NivelPorFuncao {
  instrumentoId: string;
  nivel: NivelExperiencia;
}

/**
 * Estrutura preparada para o gerador de escalas usar futuramente — por
 * enquanto só é armazenada, sem UI própria ainda (fica pra uma próxima etapa).
 */
export interface Disponibilidade {
  diasDisponiveis: string[]; // dias da semana em que costuma poder servir
  diasIndisponiveis: string[]; // datas específicas (ISO) em que não pode
  observacao?: string;
}

export interface Integrante {
  id: string;
  nome: string; // nome completo — continua sendo o campo que a escala usa
  funcoes: string[]; // ids de Instrumento — MESMO campo que a escala já usa, intocado
  // --- Campos novos do cadastro, todos opcionais (não quebram dados antigos) ---
  nomeExibicao?: string;
  telefone?: string;
  email?: string;
  foto?: string; // data URL (já redimensionada/comprimida no upload)
  ativo?: boolean; // undefined é tratado como ativo (compatível com integrantes já existentes)
  niveis?: NivelPorFuncao[];
  observacoesMusicais?: string;
  disponibilidade?: Disponibilidade;
}

export interface Regras {
  permitirDomingoSolo: boolean;
  felipePodeSozinho: boolean;
  violaoDispensaBaixo: boolean;
  maxDuasVozes: boolean;
  balancearParticipacoes: boolean;
  evitarRepetirMesAnterior: boolean;
}

export const REGRAS_PADRAO: Regras = {
  permitirDomingoSolo: true,
  felipePodeSozinho: true,
  violaoDispensaBaixo: true,
  maxDuasVozes: true,
  balancearParticipacoes: true,
  evitarRepetirMesAnterior: true,
};

export interface ConfiguracaoEscala {
  mes: number; // 1-12
  ano: number;
  quantidadeDomingos: 4 | 5;
  domingoSolo: number | null; // 1-5, or null if no solo sunday
  regras: Regras;
}

/**
 * Escalação de um culto: cada instrumento pode ter zero, uma ou várias
 * pessoas (por isso é um array por instrumento, não mais um campo fixo).
 */
export interface Escalacao {
  atribuicoes: Record<string, string[]>; // instrumentoId -> ids de integrantes
  solo: boolean;
}

export function escalacaoVazia(): Escalacao {
  return { atribuicoes: {}, solo: false };
}

export interface DomingoEscala {
  data: string; // ISO date string
  numero: number; // 1-5 within month
  escalacao: Escalacao;
}

/** Culto extra: evento avulso em qualquer dia da semana, adicionado manualmente. */
export interface CultoExtra {
  id: string;
  data: string; // ISO date string
  titulo: string; // ex: "Culto de oração", "Vigília"
  escalacao: Escalacao;
}

/**
 * Status de aprovação de uma escala (mesmos valores usados na nuvem/Supabase
 * quando a sincronização remota está configurada):
 * - rascunho: em edição, ainda não enviada para ninguém
 * - aguardando_aprovacao: enviada pelo montador, esperando o líder revisar
 * - devolvida: o líder pediu ajustes (ver motivoDevolucao)
 * - aprovada: liberada pelo líder, pronta para copiar/enviar no WhatsApp
 * - publicada: já foi copiada/enviada no WhatsApp
 */
export type StatusEscala =
  | "rascunho"
  | "aguardando_aprovacao"
  | "devolvida"
  | "aprovada"
  | "publicada";

export const STATUS_LABEL: Record<StatusEscala, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  devolvida: "Devolvida pelo líder",
  aprovada: "Aprovada",
  publicada: "Publicada",
};

export interface EscalaSalva {
  id: string;
  criadoEm: string;
  atualizadoEm?: string;
  config: ConfiguracaoEscala;
  domingos: DomingoEscala[];
  cultosExtras: CultoExtra[];
  escalacaoOriginal?: DomingoEscala[]; // for "restaurar"
  status: StatusEscala;
  motivoDevolucao?: string;
  nuvemId?: string; // id da linha correspondente em escalas_aprovacao (Supabase), se enviada
}

/** Tudo que precisa viajar para a nuvem (ou para o aparelho do líder) para renderizar a escala sem depender dos dados locais de quem está vendo. */
export interface PayloadEscala {
  config: ConfiguracaoEscala;
  domingos: DomingoEscala[];
  cultosExtras: CultoExtra[];
  escalacaoOriginal?: DomingoEscala[];
  integrantes: Integrante[];
  instrumentos: Instrumento[];
}

/** Rascunho em edição na aba Escala, persistido para sobreviver a um recarregamento da página. */
export interface RascunhoAtual {
  escalaAtualId: string | null; // id local (uid()) ou id remoto (uuid do Supabase), conforme origemRemota
  origemRemota: boolean; // true quando escalaAtualId aponta para uma linha em escalas_aprovacao
  domingos: DomingoEscala[] | null;
  domingosOriginais: DomingoEscala[] | null;
  cultosExtras: CultoExtra[];
}

export const RASCUNHO_VAZIO: RascunhoAtual = {
  escalaAtualId: null,
  origemRemota: false,
  domingos: null,
  domingosOriginais: null,
  cultosExtras: [],
};
