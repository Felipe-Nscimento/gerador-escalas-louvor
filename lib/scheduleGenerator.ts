import {
  ConfiguracaoEscala,
  CultoExtra,
  DomingoEscala,
  Escalacao,
  escalacaoVazia,
  EscalaSalva,
  Instrumento,
  Integrante,
} from "./types";
import { uid } from "./storage";

/** Um item genérico e escalável: tanto um domingo quanto um culto extra viram isso. */
export interface ItemEscalado {
  id: string;
  data: string;
  rotulo: string;
  escalacao: Escalacao;
}

/** Junta domingos e cultos extras num único array ordenado por data, para estatísticas/validação/exportação. */
export function unificarItens(
  domingos: DomingoEscala[],
  cultosExtras: CultoExtra[] = []
): ItemEscalado[] {
  const itens: ItemEscalado[] = [
    ...domingos.map((d) => ({
      id: d.data,
      data: d.data,
      rotulo: `Domingo ${d.numero}`,
      escalacao: d.escalacao,
    })),
    ...cultosExtras.map((c) => ({
      id: c.id,
      data: c.data,
      rotulo: c.titulo || "Culto extra",
      escalacao: c.escalacao,
    })),
  ];
  return itens.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

/** Todas as pessoas atribuídas num item, em qualquer instrumento. */
export function pessoasDoItem(escalacao: Escalacao): string[] {
  return Object.values(escalacao.atribuicoes).flat().filter(Boolean) as string[];
}

/** Cria um culto extra vazio para o usuário preencher manualmente. */
export function criarCultoExtra(data: string, titulo: string): CultoExtra {
  return {
    id: uid(),
    data,
    titulo,
    escalacao: escalacaoVazia(),
  };
}

/** Retorna todas as datas de domingo de um mês/ano, na quantidade pedida. */
export function getDomingosDoMes(
  mes: number,
  ano: number,
  quantidade: number
): Date[] {
  const domingos: Date[] = [];
  const data = new Date(ano, mes - 1, 1);
  // avança até o primeiro domingo
  while (data.getDay() !== 0) {
    data.setDate(data.getDate() + 1);
  }
  while (domingos.length < quantidade && data.getMonth() === mes - 1) {
    domingos.push(new Date(data));
    data.setDate(data.getDate() + 7);
  }
  return domingos;
}

/** Quantos domingos um mês/ano realmente possui (4 ou 5). */
export function contarDomingosDoMes(mes: number, ano: number): number {
  const data = new Date(ano, mes - 1, 1);
  let count = 0;
  const dataFinal = new Date(ano, mes, 0).getDate();
  for (let dia = 1; dia <= dataFinal; dia++) {
    const d = new Date(ano, mes - 1, dia);
    if (d.getDay() === 0) count++;
  }
  return count;
}

function temInstrumento(pessoa: Integrante, instrumentoId: string): boolean {
  return pessoa.funcoes.includes(instrumentoId);
}

function rand(seed: () => number, min: number, max: number) {
  return min + seed() * (max - min);
}

/** Gerador pseudoaleatório simples baseado em seed numérica, para permitir variação controlada. */
function criarRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface EstadoEscolha {
  scoreMap: Record<string, number>; // menor = maior prioridade (tocou menos)
}

function construirEstadoInicial(
  integrantes: Integrante[],
  historico: EscalaSalva[]
): EstadoEscolha {
  const scoreMap: Record<string, number> = {};
  integrantes.forEach((i) => (scoreMap[i.id] = 0));

  const escalasOrdenadas = [...historico].sort(
    (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
  );
  escalasOrdenadas.forEach((escala) => {
    const itens = unificarItens(escala.domingos, escala.cultosExtras ?? []);
    itens.forEach((item) => {
      pessoasDoItem(item.escalacao).forEach((id) => {
        if (scoreMap[id] !== undefined) scoreMap[id] += 1;
      });
    });
  });

  return { scoreMap };
}

/**
 * Escolhe a melhor pessoa disponível para um instrumento, priorizando
 * quem tocou menos, com um fator aleatório para permitir variação entre gerações.
 */
function escolherPessoa(
  candidatos: Integrante[],
  instrumentoId: string,
  usadosNoDia: Set<string>,
  estado: EstadoEscolha,
  rng: () => number
): Integrante | null {
  const disponiveis = candidatos.filter(
    (p) => temInstrumento(p, instrumentoId) && !usadosNoDia.has(p.id)
  );
  if (disponiveis.length === 0) return null;

  const pontuados = disponiveis.map((p) => ({
    pessoa: p,
    pontuacao: estado.scoreMap[p.id] * 10 - rand(rng, 0, 6),
  }));
  pontuados.sort((a, b) => a.pontuacao - b.pontuacao);
  return pontuados[0].pessoa;
}

function marcarEscolha(estado: EstadoEscolha, id: string | null) {
  if (!id) return;
  estado.scoreMap[id] += 1;
}

/**
 * Gera uma escala completa para o mês, respeitando as regras e os
 * instrumentos cadastrados. `seed` permite gerar combinações diferentes
 * a cada chamada (usado por "Gerar outra escala" e "Surpreenda-me").
 */
export function gerarEscala(
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  config: ConfiguracaoEscala,
  historico: EscalaSalva[],
  seed: number = Date.now()
): DomingoEscala[] {
  const rng = criarRng(seed);
  const estado = construirEstadoInicial(integrantes, historico);
  const domingosDatas = getDomingosDoMes(
    config.mes,
    config.ano,
    config.quantidadeDomingos
  );

  const felipe = integrantes.find((i) => i.nome.trim().toLowerCase() === "felipe");
  const obrigatorios = instrumentos.filter((i) => i.obrigatorio);
  const vozId = instrumentos.find((i) => i.id === "voz")?.id ?? "voz";
  const violaoId = instrumentos.find((i) => i.id === "violao")?.id ?? "violao";
  const baixoId = instrumentos.find((i) => i.id === "baixo")?.id ?? "baixo";

  return domingosDatas.map((data, indice) => {
    const numero = indice + 1;
    const ehDomingoSolo =
      config.regras.permitirDomingoSolo && config.domingoSolo === numero;

    if (ehDomingoSolo && felipe) {
      marcarEscolha(estado, felipe.id);
      const escalacao: Escalacao = {
        atribuicoes: { [vozId]: [felipe.id], [violaoId]: [felipe.id] },
        solo: true,
      };
      return { data: data.toISOString(), numero, escalacao };
    }

    const usados = new Set<string>();
    const atribuicoes: Record<string, string[]> = {};

    obrigatorios.forEach((inst) => {
      // baixo é dispensado quando o violonista já cobre a função (regra configurável)
      if (
        inst.id === baixoId &&
        config.regras.violaoDispensaBaixo &&
        atribuicoes[violaoId]?.length
      ) {
        atribuicoes[inst.id] = [];
        return;
      }
      const pessoa = escolherPessoa(integrantes, inst.id, usados, estado, rng);
      atribuicoes[inst.id] = pessoa ? [pessoa.id] : [];
      if (pessoa) usados.add(pessoa.id);
    });

    // se ninguém dedicado cantou, o violonista pode cobrir a voz também
    if (!atribuicoes[vozId]?.length && atribuicoes[violaoId]?.length) {
      const violonista = integrantes.find((p) => p.id === atribuicoes[violaoId][0]);
      if (violonista && temInstrumento(violonista, vozId)) {
        atribuicoes[vozId] = [violonista.id];
      }
    }

    Object.values(atribuicoes)
      .flat()
      .forEach((id) => marcarEscolha(estado, id));

    return {
      data: data.toISOString(),
      numero,
      escalacao: { atribuicoes, solo: false },
    };
  });
}

/** Gera uma nova combinação diferente da atual, mantendo as mesmas configurações. */
export function gerarOutraEscala(
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  config: ConfiguracaoEscala,
  historico: EscalaSalva[]
): DomingoEscala[] {
  return gerarEscala(
    integrantes,
    instrumentos,
    config,
    historico,
    Date.now() + Math.random() * 100000
  );
}

export interface Alerta {
  mensagem: string;
  nivel: "aviso" | "erro";
}

/** Calcula avisos de validação (não bloqueantes) para uma escala completa (domingos + cultos extras). */
export function validarEscala(
  domingos: DomingoEscala[],
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  cultosExtras: CultoExtra[] = []
): Alerta[] {
  const alertas: Alerta[] = [];
  const nomeById = (id: string) => integrantes.find((i) => i.id === id)?.nome ?? "?";

  const contagemPorPessoa: Record<string, number> = {};
  const itens = unificarItens(domingos, cultosExtras);

  itens.forEach((item) => {
    const { escalacao } = item;
    if (escalacao.solo) return;

    const vozIds = escalacao.atribuicoes["voz"] ?? [];
    if (vozIds.length >= 3) {
      alertas.push({
        mensagem: `⚠ Existem três ou mais vozes em ${item.rotulo} (dia ${new Date(
          item.data
        ).toLocaleDateString("pt-BR")}).`,
        nivel: "aviso",
      });
    }

    instrumentos
      .filter((inst) => inst.obrigatorio)
      .forEach((inst) => {
        if (!escalacao.atribuicoes[inst.id]?.length) {
          alertas.push({
            mensagem: `⚠ Não há ${inst.nome.toLowerCase()} em ${item.rotulo}.`,
            nivel: "aviso",
          });
        }
      });

    Object.entries(escalacao.atribuicoes).forEach(([instId, ids]) => {
      const vistosNaFuncao = new Set<string>();
      (ids ?? []).forEach((id) => {
        if (!id) return;
        if (vistosNaFuncao.has(id)) {
          const inst = instrumentos.find((i) => i.id === instId);
          alertas.push({
            mensagem: `⚠ ${nomeById(id)} está repetido em ${
              inst?.nome.toLowerCase() ?? instId
            } em ${item.rotulo}.`,
            nivel: "aviso",
          });
        }
        vistosNaFuncao.add(id);
      });
    });

    new Set(pessoasDoItem(escalacao)).forEach((id) => {
      contagemPorPessoa[id] = (contagemPorPessoa[id] ?? 0) + 1;
    });
  });

  const totalComMusica = itens.filter((i) => !i.escalacao.solo).length;
  Object.entries(contagemPorPessoa).forEach(([id, count]) => {
    if (totalComMusica > 0 && count >= totalComMusica) {
      alertas.push({
        mensagem: `⚠ ${nomeById(id)} está escalado em todos os ${count} cultos com música.`,
        nivel: "aviso",
      });
    }
  });

  return alertas;
}

/** Calcula estatísticas de participação por integrante (domingos + cultos extras). */
export function calcularEstatisticas(
  domingos: DomingoEscala[],
  integrantes: Integrante[],
  cultosExtras: CultoExtra[] = []
): { id: string; nome: string; participacoes: number }[] {
  const contagem: Record<string, number> = {};
  integrantes.forEach((i) => (contagem[i.id] = 0));

  const itens = unificarItens(domingos, cultosExtras);
  itens.forEach((item) => {
    pessoasDoItem(item.escalacao).forEach((id) => {
      contagem[id] = (contagem[id] ?? 0) + 1;
    });
  });

  return integrantes
    .map((i) => ({ id: i.id, nome: i.nome, participacoes: contagem[i.id] ?? 0 }))
    .sort((a, b) => b.participacoes - a.participacoes);
}
