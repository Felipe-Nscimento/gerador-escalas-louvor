/**
 * Lógica do envio dos lembretes (sem depender de Next, Supabase ou web-push, para poder ser
 * testada). A rota app/api/lembretes/route.ts liga isso ao banco e ao serviço de notificação.
 */

export interface CultoLembrete {
  data: string; // YYYY-MM-DD
  titulo: string;
  chave: string; // título em minúsculas (igual ao gravado em push_envios)
  funcoes: string[]; // ex.: ["🎤 Voz", "🎸 Violão"]
  playlist: boolean;
}

export interface AssinaturaPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ItemLembrete {
  integrante_id: string;
  nome: string;
  cultos: CultoLembrete[];
  assinaturas: AssinaturaPush[];
}

export type ResultadoEnvio = "ok" | "expirada" | "erro";

export interface DependenciasLembretes {
  buscar: () => Promise<ItemLembrete[]>;
  enviar: (assinatura: AssinaturaPush, conteudo: string) => Promise<ResultadoEnvio>;
  marcarEnviado: (integranteId: string, cultos: { data: string; chave: string }[]) => Promise<void>;
  removerAssinatura: (endpoint: string) => Promise<void>;
}

export interface ResumoLembretes {
  pessoas: number;
  notificacoesEnviadas: number;
  aparelhosRemovidos: number;
  falhas: number;
  simulacao: boolean;
  detalhes?: { nome: string; titulo: string; corpo: string; aparelhos: number }[];
}

function primeiraMaiuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "2026-10-18" -> "Domingo, 18/10" (sem depender do fuso do servidor) */
export function rotuloDaData(data: string): string {
  const [a, m, d] = data.slice(0, 10).split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  return `${primeiraMaiuscula(dia)}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Texto da notificação de uma pessoa (um aviso só, mesmo com mais de um culto na semana). */
export function montarNotificacao(item: ItemLembrete): { titulo: string; corpo: string; url: string; tag: string } {
  const linhas = item.cultos.map((c) => {
    const nomeCulto = c.titulo.toLowerCase() === "culto de domingo" ? "" : ` — ${c.titulo}`;
    const funcoes = c.funcoes.length > 0 ? `: ${c.funcoes.join(", ")}` : "";
    return `${rotuloDaData(c.data)}${nomeCulto}${funcoes}`;
  });
  const temPlaylist = item.cultos.some((c) => c.playlist);
  const fim = temPlaylist
    ? "Reserve um tempo para estudar as músicas. A playlist já está no app 🎧"
    : "Reserve um tempo para estudar as músicas! 🎶";
  const primeiroNome = item.nome.trim().split(/\s+/)[0] || "";
  return {
    titulo: primeiroNome ? `${primeiroNome}, você está escalado nesta semana` : "Você está escalado nesta semana",
    corpo: `${linhas.join("\n")}\n${fim}`,
    url: "/escala",
    tag: `escala-${item.cultos[0]?.data ?? "semana"}`,
  };
}

/**
 * Envia os lembretes pendentes. Só marca como enviado quando pelo menos um aparelho recebeu,
 * e remove aparelhos que o serviço de notificação diz que não existem mais.
 * Com `simular`, não envia nem marca nada: só mostra o que seria enviado.
 */
export async function processarLembretes(
  deps: DependenciasLembretes,
  opcoes: { simular?: boolean } = {}
): Promise<ResumoLembretes> {
  const itens = await deps.buscar();
  const resumo: ResumoLembretes = {
    pessoas: itens.length,
    notificacoesEnviadas: 0,
    aparelhosRemovidos: 0,
    falhas: 0,
    simulacao: !!opcoes.simular,
  };
  if (opcoes.simular) {
    resumo.detalhes = itens.map((i) => {
      const n = montarNotificacao(i);
      return { nome: i.nome, titulo: n.titulo, corpo: n.corpo, aparelhos: i.assinaturas.length };
    });
    return resumo;
  }

  for (const item of itens) {
    if (item.cultos.length === 0 || item.assinaturas.length === 0) continue;
    const n = montarNotificacao(item);
    const conteudo = JSON.stringify({ titulo: n.titulo, corpo: n.corpo, url: n.url, tag: n.tag });
    let algumOk = false;
    for (const assinatura of item.assinaturas) {
      let r: ResultadoEnvio;
      try {
        r = await deps.enviar(assinatura, conteudo);
      } catch {
        r = "erro";
      }
      if (r === "ok") {
        algumOk = true;
        resumo.notificacoesEnviadas++;
      } else if (r === "expirada") {
        await deps.removerAssinatura(assinatura.endpoint).catch(() => {});
        resumo.aparelhosRemovidos++;
      } else {
        resumo.falhas++;
      }
    }
    if (algumOk) {
      await deps.marcarEnviado(
        item.integrante_id,
        item.cultos.map((c) => ({ data: c.data, chave: c.chave }))
      );
    }
  }
  return resumo;
}
