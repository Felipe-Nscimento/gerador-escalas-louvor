import { supabase } from "./supabase";
import { Instrumento, Integrante } from "./types";

/** Escala já "enxuta" devolvida pelo banco: só datas, títulos e ids (sem dados pessoais). */
export interface EscalaIntegrante {
  id: string;
  atualizadoEm: string;
  domingos: { data: string; numero: number; escalacao: { solo: boolean; atribuicoes: Record<string, string[]> } }[];
  cultosExtras: {
    id: string;
    data: string;
    titulo: string;
    escalacao: { solo: boolean; atribuicoes: Record<string, string[]> };
  }[];
}

export interface DadosAcessoIntegrante {
  nome: string;
  escalas: EscalaIntegrante[];
  integrantes: Integrante[];
  instrumentos: Instrumento[];
  ordemFuncoes: string[] | null;
}

export type ResultadoAcesso =
  | { ok: true; dados: DadosAcessoIntegrante }
  | { ok: false; motivo: string };

const CHAVE_CREDENCIAIS = "louvor:acessoIntegrante";
const CHAVE_CACHE = "louvor:escalaIntegranteCache";

export const MOTIVOS_ACESSO: Record<string, string> = {
  dados_invalidos: "Confira o nome e a senha. A senha tem 8 números: dia, mês e ano (ex.: 15101990).",
  credenciais_invalidas:
    "Nome ou data de aniversário não conferem. Se o problema continuar, peça ao líder para conferir o seu cadastro.",
  muitas_tentativas: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  sem_conexao: "Não foi possível conectar. Verifique a internet e tente de novo.",
  nao_configurado: "O acesso ainda não está disponível. Fale com o líder.",
};

/** Senha = data de aniversário só com números (ddmmaaaa). */
export function normalizarSenha(texto: string): string {
  return texto.replace(/\D/g, "");
}

export async function entrarComoIntegrante(nome: string, senha: string): Promise<ResultadoAcesso> {
  if (!supabase) return { ok: false, motivo: "nao_configurado" };
  try {
    const { data, error } = await supabase.rpc("escala_para_integrante", {
      p_nome: nome.trim(),
      p_senha: normalizarSenha(senha),
    });
    if (error) return { ok: false, motivo: "sem_conexao" };
    const r = data as {
      ok: boolean;
      motivo?: string;
      nome?: string;
      escalas?: EscalaIntegrante[];
      integrantes?: Integrante[];
      instrumentos?: Instrumento[];
      ordemFuncoes?: unknown;
    };
    if (!r?.ok) return { ok: false, motivo: r?.motivo ?? "credenciais_invalidas" };
    const ordem = Array.isArray(r.ordemFuncoes)
      ? (r.ordemFuncoes as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    return {
      ok: true,
      dados: {
        nome: r.nome ?? nome,
        escalas: r.escalas ?? [],
        integrantes: r.integrantes ?? [],
        instrumentos: r.instrumentos ?? [],
        ordemFuncoes: ordem.length > 0 ? ordem : null,
      },
    };
  } catch {
    return { ok: false, motivo: "sem_conexao" };
  }
}

export function lerCredenciais(): { nome: string; senha: string } | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_CREDENCIAIS);
    if (!bruto) return null;
    const c = JSON.parse(bruto);
    return typeof c?.nome === "string" && typeof c?.senha === "string" ? c : null;
  } catch {
    return null;
  }
}

export function salvarCredenciais(nome: string, senha: string): void {
  try {
    window.localStorage.setItem(CHAVE_CREDENCIAIS, JSON.stringify({ nome, senha: normalizarSenha(senha) }));
  } catch {
    /* sem armazenamento: o acesso vale só nesta visita */
  }
}

export function lerCache(): DadosAcessoIntegrante | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_CACHE);
    return bruto ? (JSON.parse(bruto) as DadosAcessoIntegrante) : null;
  } catch {
    return null;
  }
}

export function salvarCache(dados: DadosAcessoIntegrante): void {
  try {
    window.localStorage.setItem(CHAVE_CACHE, JSON.stringify(dados));
  } catch {
    /* cache é só um extra para ver offline */
  }
}

export function sairDoAcesso(): void {
  try {
    window.localStorage.removeItem(CHAVE_CREDENCIAIS);
    window.localStorage.removeItem(CHAVE_CACHE);
  } catch {
    /* ignora */
  }
}
