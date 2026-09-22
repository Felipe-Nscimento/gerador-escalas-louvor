import {
  ConfiguracaoEscala,
  CultoExtra,
  DiaSemana,
  DomingoEscala,
  Escalacao,
  EscalaSalva,
  escalacaoVazia,
  Instrumento,
  Integrante,
  Regras,
} from "./types";

// ==================================================
// Datas
// ==================================================

/** "YYYY-MM-DD" a partir de um Date, usando os componentes LOCAIS (nunca
 * `toISOString().split("T")[0]`, que pode recuar um dia dependendo do fuso). */
function paraDataISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Retorna todas as datas de domingo de um mês/ano, na quantidade pedida. */
export function getDomingosDoMes(
  mes: number,
  ano: number,
  quantidade: number
): Date[] {
  const domingos: Date[] = [];
  const data = new Date(ano, mes - 1, 1, 12, 0, 0);
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
  let count = 0;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  for (let dia = 1; dia <= ultimoDia; dia++) {
    if (new Date(ano, mes - 1, dia).getDay() === 0) count++;
  }
  return count;
}

// ==================================================
// Itens unificados (domingos + cultos extras, em ordem)
// ==================================================

export interface ItemEscalado {
  id: string; // data (domingos) ou id do culto extra
  data: string;
  rotulo: string; // "Domingo N" ou o título do culto extra
  escalacao: Escalacao;
}

export function unificarItens(
  domingos: DomingoEscala[],
  cultosExtras: CultoExtra[]
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
      rotulo: c.titulo,
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
  return { id: cryptoId(), data, titulo, escalacao: escalacaoVazia() };
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ==================================================
// Disponibilidade (Etapa 1) — só olha o dia (data completa quando é
// exceção, dia da semana quando é disponibilidade habitual). O projeto não
// guarda horário específico do culto em si (Domingo/CultoExtra), então a
// checagem é no nível do dia — coerente com o que existe hoje.
// ==================================================

export type StatusDisponibilidadeDia = "disponivel" | "indisponivel" | "nao_informado";

export function statusDisponibilidadeNoDia(
  pessoa: Integrante,
  data: Date
): StatusDisponibilidadeDia {
  const dispo = pessoa.disponibilidade;
  if (!dispo) return "nao_informado";

  const dataISO = paraDataISO(data);
  const excecao = dispo.excecoes?.find((e) => e.data === dataISO);
  if (excecao) return excecao.status; // EXCEÇÃO > HABITUAL, sempre

  const diaSemana = data.getDay() as DiaSemana;
  const habitual = dispo.dias?.find((d) => d.dia === diaSemana);
  if (!habitual) return "nao_informado";
  return habitual.status;
}

// ==================================================
// RNG determinístico por seed (permite "gerar outra"/"surpreenda-me"
// produzirem combinações diferentes de forma controlada).
// ==================================================

function criarRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function rand(seed: () => number, min: number, max: number) {
  return min + seed() * (max - min);
}

// ==================================================
// Estado de equilíbrio, construído a partir do histórico de escalas já
// salvas — igual ao gerador anterior: quem tocou menos e há mais tempo,
// tem prioridade.
// ==================================================

interface EstadoEscolha {
  scoreMap: Record<string, number>; // quantas vezes já serviu (menor = mais prioridade)
  ultimoIndice: Record<string, number>; // índice do item em que serviu por último (-1 = nunca)
}

function construirEstadoInicial(
  integrantes: Integrante[],
  historico: EscalaSalva[]
): EstadoEscolha {
  const scoreMap: Record<string, number> = {};
  const ultimoIndice: Record<string, number> = {};
  integrantes.forEach((i) => {
    scoreMap[i.id] = 0;
    ultimoIndice[i.id] = -1;
  });

  const escalasOrdenadas = [...historico].sort(
    (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
  );
  let indiceGlobal = 0;
  escalasOrdenadas.forEach((escala) => {
    const itens = unificarItens(escala.domingos, escala.cultosExtras ?? []);
    itens.forEach((item) => {
      new Set(pessoasDoItem(item.escalacao)).forEach((id) => {
        if (scoreMap[id] !== undefined) {
          scoreMap[id] += 1;
          ultimoIndice[id] = indiceGlobal;
        }
      });
      indiceGlobal++;
    });
  });

  return { scoreMap, ultimoIndice };
}

// ==================================================
// Explicação / relatório da geração inteligente
// ==================================================

export interface ChecagemAtribuicao {
  ok: boolean;
  label: string;
}

export interface ExplicacaoAtribuicao {
  itemId: string;
  itemRotulo: string;
  pessoaId: string;
  pessoaNome: string;
  instrumentoId: string;
  instrumentoNome: string;
  compatibilidade: number; // 0-100, só para exibição
  checagens: ChecagemAtribuicao[];
}

export interface ProblemaGeracao {
  itemId: string;
  itemRotulo: string;
  instrumentoId: string;
  instrumentoNome: string;
  motivo: string;
}

export interface RelatorioGeracao {
  explicacoes: ExplicacaoAtribuicao[];
  problemas: ProblemaGeracao[];
  qualidade: {
    percentual: number;
    nivel: "excelente" | "boa" | "atencao";
  };
}

export interface ResultadoGeracao {
  domingos: DomingoEscala[];
  relatorio: RelatorioGeracao;
}

function calcularNivelQualidade(percentual: number): "excelente" | "boa" | "atencao" {
  if (percentual >= 80) return "excelente";
  if (percentual >= 55) return "boa";
  return "atencao";
}

// ==================================================
// Seleção de candidato para uma função num item
// ==================================================

interface AvaliacaoCandidato {
  pessoa: Integrante;
  pontuacaoOrdenacao: number; // usada só para decidir quem vence (pode ter ruído)
  compatibilidade: number; // 0-100 "limpo", para exibir
  checagens: ChecagemAtribuicao[];
}

function avaliarCandidato(
  pessoa: Integrante,
  instrumentoId: string,
  data: Date,
  estado: EstadoEscolha,
  indiceAtual: number,
  balancearParticipacoes: boolean,
  rng: () => number
): AvaliacaoCandidato {
  const checagens: ChecagemAtribuicao[] = [
    { ok: true, label: "Função compatível" },
  ];
  let pontuacao = 50;

  const dispo = statusDisponibilidadeNoDia(pessoa, data);
  if (dispo === "disponivel") {
    pontuacao += 15;
    checagens.push({ ok: true, label: "Disponível" });
  } else {
    checagens.push({ ok: true, label: "Disponibilidade não informada" });
  }

  const vezes = estado.scoreMap[pessoa.id] ?? 0;
  const ultimoIndice = estado.ultimoIndice[pessoa.id] ?? -1;
  if (balancearParticipacoes) {
    if (ultimoIndice === -1) {
      pontuacao += 12;
      checagens.push({ ok: true, label: "Ainda não foi escalado" });
    } else {
      const intervalo = indiceAtual - ultimoIndice;
      if (intervalo >= 2) {
        pontuacao += Math.min(12, intervalo * 2);
        checagens.push({ ok: true, label: `Não serve há ${intervalo} cultos` });
      } else {
        pontuacao -= 10;
        checagens.push({ ok: false, label: "Serviu recentemente" });
      }
    }
    pontuacao -= vezes * 2;
  }

  if (pessoa.preferencias?.includes(instrumentoId)) {
    pontuacao += 12;
    checagens.push({ ok: true, label: "Preferência atendida" });
  }

  const nivel = pessoa.niveis?.find((n) => n.instrumentoId === instrumentoId)?.nivel;
  if (nivel === "avancado") {
    pontuacao += 6;
    checagens.push({ ok: true, label: "Nível avançado" });
  } else if (nivel === "intermediario") {
    pontuacao += 3;
    checagens.push({ ok: true, label: "Nível intermediário" });
  }

  const compatibilidade = Math.max(0, Math.min(100, Math.round(pontuacao)));
  const pontuacaoOrdenacao = pontuacao + rand(rng, -4, 4);

  return { pessoa, pontuacaoOrdenacao, compatibilidade, checagens };
}

/**
 * Candidatos elegíveis para uma função num item: ativo, tem a função,
 * não está bloqueado por restrição, não está indisponível (exceção tem
 * prioridade sobre a disponibilidade habitual), e — se não puder acumular
 * funções — ainda não foi escalado em outro instrumento neste mesmo item.
 */
function candidatosElegiveis(
  integrantes: Integrante[],
  instrumentoId: string,
  data: Date,
  usadosNoItem: Set<string>
): Integrante[] {
  return integrantes.filter((p) => {
    if (p.ativo === false) return false;
    if (!p.funcoes.includes(instrumentoId)) return false;
    if (p.restricoes?.funcoesBloqueadas?.includes(instrumentoId)) return false;
    if (statusDisponibilidadeNoDia(p, data) === "indisponivel") return false;
    if (usadosNoItem.has(p.id) && p.restricoes?.podeAcumularFuncoes === false) {
      return false;
    }
    return true;
  });
}

function motivoFalha(
  todasComFuncao: Integrante[],
  instrumentoNome: string,
  data: Date
): string {
  if (todasComFuncao.length === 0) {
    return `Nenhum integrante cadastrado com a função ${instrumentoNome}.`;
  }
  const inativos = todasComFuncao.filter((p) => p.ativo === false).length;
  const indisponiveis = todasComFuncao.filter(
    (p) => statusDisponibilidadeNoDia(p, data) === "indisponivel"
  ).length;
  const restritos = todasComFuncao.filter(
    (p) => (p.restricoes?.funcoesBloqueadas?.length ?? 0) > 0
  ).length;

  const partes: string[] = [];
  if (indisponiveis > 0) partes.push(`${indisponiveis} indisponível(is) neste dia`);
  if (inativos > 0) partes.push(`${inativos} inativo(s)`);
  if (restritos > 0) partes.push(`${restritos} com restrição para essa função`);

  const total = todasComFuncao.length;
  const plural = total === 1 ? "integrante cadastrado" : "integrantes cadastrados";
  if (partes.length === 0) {
    return `Existem ${total} ${plural} com a função ${instrumentoNome}, mas nenhum ficou disponível para acumular com outra função neste culto.`;
  }
  return `Existem ${total} ${plural} com a função ${instrumentoNome}, mas ${partes.join(
    " e "
  )}.`;
}

// ==================================================
// Geração principal
// ==================================================

function gerarItens(
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  config: ConfiguracaoEscala,
  historico: EscalaSalva[],
  seed: number
): ResultadoGeracao {
  const rng = criarRng(seed);
  const estado = construirEstadoInicial(integrantes, historico);
  const domingosDatas = getDomingosDoMes(
    config.mes,
    config.ano,
    config.quantidadeDomingos
  );

  const explicacoes: ExplicacaoAtribuicao[] = [];
  const problemas: ProblemaGeracao[] = [];

  const felipe = config.regras.felipePodeSozinho
    ? integrantes.find((i) => i.nome.trim().toLowerCase() === "felipe")
    : undefined;
  const vozId = instrumentos.some((i) => i.id === "voz") ? "voz" : instrumentos[0]?.id;
  const violaoId = instrumentos.some((i) => i.id === "violao")
    ? "violao"
    : instrumentos[1]?.id;

  const domingos: DomingoEscala[] = domingosDatas.map((data, indice) => {
    const numero = indice + 1;
    const ehDomingoSolo =
      config.regras.permitirDomingoSolo && config.domingoSolo === numero;

    if (ehDomingoSolo && felipe && vozId && violaoId) {
      estado.scoreMap[felipe.id] = (estado.scoreMap[felipe.id] ?? 0) + 1;
      estado.ultimoIndice[felipe.id] = indice;
      return {
        data: data.toISOString(),
        numero,
        escalacao: {
          atribuicoes: { [vozId]: [felipe.id], [violaoId]: [felipe.id] },
          solo: true,
        },
      };
    }

    const atribuicoes: Record<string, string[]> = {};
    const usadosNoItem = new Set<string>();

    // obrigatórios primeiro (voz/violão/teclado/bateria por padrão),
    // depois os opcionais (ex: baixo) — mantém a prioridade de antes.
    const ordem = [...instrumentos].sort(
      (a, b) => Number(b.obrigatorio) - Number(a.obrigatorio)
    );

    ordem.forEach((inst) => {
      // regra existente: violão dispensa baixo quando já há alguém no violão
      if (
        inst.id === "baixo" &&
        config.regras.violaoDispensaBaixo &&
        (atribuicoes["violao"]?.length ?? 0) > 0
      ) {
        return;
      }

      const elegiveis = candidatosElegiveis(integrantes, inst.id, data, usadosNoItem);
      if (elegiveis.length === 0) {
        if (inst.obrigatorio) {
          const todasComFuncao = integrantes.filter((p) => p.funcoes.includes(inst.id));
          problemas.push({
            itemId: data.toISOString(),
            itemRotulo: `Domingo ${numero}`,
            instrumentoId: inst.id,
            instrumentoNome: inst.nome,
            motivo: motivoFalha(todasComFuncao, inst.nome, data),
          });
        }
        return;
      }

      const avaliados = elegiveis.map((p) =>
        avaliarCandidato(
          p,
          inst.id,
          data,
          estado,
          indice,
          config.regras.balancearParticipacoes,
          rng
        )
      );
      avaliados.sort((a, b) => b.pontuacaoOrdenacao - a.pontuacaoOrdenacao);
      const escolhido = avaliados[0];

      atribuicoes[inst.id] = [...(atribuicoes[inst.id] ?? []), escolhido.pessoa.id];
      usadosNoItem.add(escolhido.pessoa.id);
      estado.scoreMap[escolhido.pessoa.id] = (estado.scoreMap[escolhido.pessoa.id] ?? 0) + 1;
      estado.ultimoIndice[escolhido.pessoa.id] = indice;

      explicacoes.push({
        itemId: data.toISOString(),
        itemRotulo: `Domingo ${numero}`,
        pessoaId: escolhido.pessoa.id,
        pessoaNome: escolhido.pessoa.nome,
        instrumentoId: inst.id,
        instrumentoNome: inst.nome,
        compatibilidade: escolhido.compatibilidade,
        checagens: escolhido.checagens,
      });
    });

    return { data: data.toISOString(), numero, escalacao: { atribuicoes, solo: false } };
  });

  const obrigatorios = instrumentos.filter((i) => i.obrigatorio).length;
  const vagasObrigatorias =
    domingos.filter((d) => !d.escalacao.solo).length * Math.max(1, obrigatorios);
  const vagasPreenchidas = domingos.reduce((soma, d) => {
    if (d.escalacao.solo) return soma;
    return (
      soma +
      instrumentos.filter(
        (i) => i.obrigatorio && (d.escalacao.atribuicoes[i.id]?.length ?? 0) > 0
      ).length
    );
  }, 0);
  const percentualCobertura =
    vagasObrigatorias > 0 ? (vagasPreenchidas / vagasObrigatorias) * 100 : 100;
  const percentualMedioCompat = explicacoes.length
    ? explicacoes.reduce((s, e) => s + e.compatibilidade, 0) / explicacoes.length
    : 100;
  const penalidadeProblemas = Math.min(30, problemas.length * 10);
  const percentual = Math.max(
    0,
    Math.round((percentualCobertura + percentualMedioCompat) / 2 - penalidadeProblemas)
  );

  return {
    domingos,
    relatorio: {
      explicacoes,
      problemas,
      qualidade: { percentual, nivel: calcularNivelQualidade(percentual) },
    },
  };
}

export function gerarEscala(
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  config: ConfiguracaoEscala,
  historico: EscalaSalva[]
): ResultadoGeracao {
  return gerarComRetentativa(integrantes, instrumentos, config, historico, Date.now());
}

/** Gera uma nova combinação diferente da atual, mantendo as mesmas configurações. */
export function gerarOutraEscala(
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  config: ConfiguracaoEscala,
  historico: EscalaSalva[]
): ResultadoGeracao {
  return gerarComRetentativa(
    integrantes,
    instrumentos,
    config,
    historico,
    Date.now() + Math.random() * 100000
  );
}

function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}

function assinaturaDomingos(domingos: DomingoEscala[]): string {
  return domingos.map((d) => JSON.stringify(d.escalacao.atribuicoes)).join("|");
}

function encontrarEscalaMesAnterior(
  historico: EscalaSalva[],
  mes: number,
  ano: number
): EscalaSalva | undefined {
  const { mes: mesAnt, ano: anoAnt } = mesAnterior(mes, ano);
  return [...historico]
    .filter((e) => e.config.mes === mesAnt && e.config.ano === anoAnt)
    .sort(
      (a, b) =>
        new Date(b.atualizadoEm ?? b.criadoEm).getTime() -
        new Date(a.atualizadoEm ?? a.criadoEm).getTime()
    )[0];
}

/**
 * Regra "evitar repetir a mesma escala do mês anterior": se a combinação
 * gerada bater exatamente com a última escala salva do mês anterior,
 * tenta gerar de novo (seed diferente) até um pequeno limite de tentativas,
 * em vez de simplesmente devolver a repetição.
 */
function gerarComRetentativa(
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  config: ConfiguracaoEscala,
  historico: EscalaSalva[],
  seedBase: number
): ResultadoGeracao {
  let resultado = gerarItens(integrantes, instrumentos, config, historico, seedBase);
  if (!config.regras.evitarRepetirMesAnterior) return resultado;

  const anterior = encontrarEscalaMesAnterior(historico, config.mes, config.ano);
  if (!anterior) return resultado;

  const assinaturaAnterior = assinaturaDomingos(anterior.domingos);
  let tentativas = 0;
  while (
    assinaturaDomingos(resultado.domingos) === assinaturaAnterior &&
    tentativas < 3
  ) {
    tentativas++;
    resultado = gerarItens(
      integrantes,
      instrumentos,
      config,
      historico,
      seedBase + tentativas * 7919
    );
  }
  return resultado;
}

// ==================================================
// Validação (avisos, não bloqueia) e estatísticas — preservadas do gerador
// anterior, só adaptadas para a lista dinâmica de instrumentos.
// ==================================================

export interface Alerta {
  mensagem: string;
  nivel: "aviso" | "erro";
}

export function validarEscala(
  domingos: DomingoEscala[],
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  cultosExtras: CultoExtra[] = [],
  regras?: Regras
): Alerta[] {
  const alertas: Alerta[] = [];
  const nomeById = (id: string | null) =>
    integrantes.find((i) => i.id === id)?.nome ?? "?";
  const nomeInstrumento = (id: string) =>
    instrumentos.find((i) => i.id === id)?.nome ?? id;

  const itens = unificarItens(domingos, cultosExtras);
  const contagemPorPessoa: Record<string, number> = {};

  itens.forEach((item) => {
    const { escalacao } = item;
    if (escalacao.solo) return;

    const vozIds = escalacao.atribuicoes["voz"] ?? [];
    if ((regras?.maxDuasVozes ?? true) && vozIds.length >= 3) {
      alertas.push({
        mensagem: `⚠ Existem três ou mais vozes em ${item.rotulo}.`,
        nivel: "aviso",
      });
    }

    instrumentos
      .filter((i) => i.obrigatorio)
      .forEach((inst) => {
        if ((escalacao.atribuicoes[inst.id]?.length ?? 0) === 0) {
          alertas.push({
            mensagem: `⚠ Não há ${nomeInstrumento(inst.id).toLowerCase()} em ${item.rotulo}.`,
            nivel: "aviso",
          });
        }
      });

    Object.entries(escalacao.atribuicoes).forEach(([instId, ids]) => {
      const vistosNaFuncao = new Set<string>();
      (ids ?? []).forEach((id) => {
        if (!id) return;
        if (vistosNaFuncao.has(id)) {
          alertas.push({
            mensagem: `⚠ ${nomeById(id)} está repetido em ${nomeInstrumento(
              instId
            ).toLowerCase()} em ${item.rotulo}.`,
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
    if (totalComMusica > 1 && count >= totalComMusica) {
      alertas.push({
        mensagem: `⚠ ${nomeById(id)} está escalado em todos os ${count} cultos com música.`,
        nivel: "aviso",
      });
    }
  });

  return alertas;
}

export function calcularEstatisticas(
  domingos: DomingoEscala[],
  integrantes: Integrante[],
  cultosExtras: CultoExtra[] = []
): { id: string; nome: string; participacoes: number }[] {
  const contagem: Record<string, number> = {};
  integrantes.forEach((i) => (contagem[i.id] = 0));

  const itens = unificarItens(domingos, cultosExtras);
  itens.forEach((item) => {
    new Set(pessoasDoItem(item.escalacao)).forEach((id) => {
      contagem[id] = (contagem[id] ?? 0) + 1;
    });
  });

  return integrantes
    .map((i) => ({ id: i.id, nome: i.nome, participacoes: contagem[i.id] ?? 0 }))
    .sort((a, b) => b.participacoes - a.participacoes);
}
