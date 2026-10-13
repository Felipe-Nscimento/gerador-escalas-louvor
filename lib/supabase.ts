import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

/**
 * Evento disparado no navegador depois que QUALQUER gravação, alteração ou exclusão nas
 * tabelas do banco dá certo. As telas escutam este evento e recarregam os dados na hora,
 * sem depender do Realtime do Supabase e sem precisar atualizar a página à mão.
 */
export const EVENTO_DADOS_ALTERADOS = "louvor:dados-alterados";

const METODOS_QUE_ALTERAM = ["POST", "PATCH", "PUT", "DELETE"];
let temporizador: ReturnType<typeof setTimeout> | null = null;

function avisarDadosAlterados() {
  if (typeof window === "undefined") return;
  // junta várias gravações seguidas (ex.: salvar um integrante e suas funções) em um aviso só
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    window.dispatchEvent(new Event(EVENTO_DADOS_ALTERADOS));
  }, 250);
}

async function fetchComAviso(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const resposta = await fetch(input, init);
  try {
    const metodo = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const endereco = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // só tabelas (PostgREST); ignora funções (rpc), login e arquivos
    if (
      resposta.ok &&
      METODOS_QUE_ALTERAM.includes(metodo) &&
      endereco.includes("/rest/v1/") &&
      !endereco.includes("/rest/v1/rpc/")
    ) {
      avisarDadosAlterados();
    }
  } catch {
    /* o aviso é um extra: nunca pode atrapalhar a gravação */
  }
  return resposta;
}

export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url as string, anonKey as string, { global: { fetch: fetchComAviso } })
  : null;
