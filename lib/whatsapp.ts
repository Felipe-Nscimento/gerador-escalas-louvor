import { CultoExtra, DomingoEscala, Instrumento, Integrante } from "./types";
import { unificarItens } from "./scheduleGenerator";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function nomeDe(id: string, integrantes: Integrante[]): string {
  return integrantes.find((i) => i.id === id)?.nome ?? "?";
}

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function nomeDiaSemana(data: Date): string {
  return DIAS_SEMANA[data.getDay()];
}

export function gerarTextoWhatsApp(
  domingos: DomingoEscala[],
  integrantes: Integrante[],
  instrumentos: Instrumento[],
  mes: number,
  ano: number,
  cultosExtras: CultoExtra[] = []
): string {
  const linhas: string[] = [];
  linhas.push(`📅 Escala do Grupo de Louvor – ${MESES[mes - 1]}/${ano}`);
  linhas.push("");

  const itens = unificarItens(domingos, cultosExtras);

  itens.forEach((item) => {
    const data = new Date(item.data);
    const dataFormatada = data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const ehDomingo = item.rotulo.startsWith("Domingo");
    linhas.push(
      ehDomingo ? `${dataFormatada} (Domingo)` : `${dataFormatada} — ${item.rotulo}`
    );
    linhas.push("");

    const { escalacao } = item;

    if (escalacao.solo) {
      const violaoIds = escalacao.atribuicoes["violao"] ?? [];
      const nome = violaoIds[0] ? nomeDe(violaoIds[0], integrantes) : "";
      linhas.push(`🎤🎸 ${nome} (solo)`);
    } else {
      const emojisUsados = new Set<string>();
      instrumentos.forEach((inst) => {
        const ids = escalacao.atribuicoes[inst.id] ?? [];
        ids.forEach((id) => {
          // se o emoji já apareceu antes no mesmo culto, adiciona o nome do
          // instrumento entre parênteses para não confundir (ex: violão x baixo)
          const repetido = emojisUsados.has(inst.emoji);
          emojisUsados.add(inst.emoji);
          const sufixo = repetido ? ` (${inst.nome.toLowerCase()})` : "";
          linhas.push(`${inst.emoji} ${nomeDe(id, integrantes)}${sufixo}`);
        });
      });
    }
    linhas.push("");
  });

  return linhas.join("\n").trim();
}

export { MESES };
