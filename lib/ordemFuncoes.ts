import { Instrumento } from "./types";

/**
 * Ordem padrão de exibição das funções na aba Escala (e no texto do WhatsApp):
 * Voz, Back Vocal, Violão, Teclado, Bateria, Baixo, Guitarra.
 *
 * A comparação é feita pelo NOME (sem acento, minúsculo), porque os ids dos
 * instrumentos variam (os padrão têm id fixo, os criados depois têm id
 * aleatório). Funções fora dessa lista (ex: Cajon) vão para o final,
 * mantendo a ordem em que já estavam.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const FORA_DO_PADRAO = 1000;

export function posicaoPadrao(nomeInstrumento: string): number {
  const n = normalizar(nomeInstrumento);
  // "back vocal" precisa ser checado ANTES de "voz"/"vocal"
  if (n.includes("back")) return 1;
  if (n.startsWith("voz") || n.startsWith("vocal")) return 0;
  if (n.includes("violao")) return 2;
  if (n.includes("teclad")) return 3;
  if (n.includes("bateria")) return 4;
  if (n.includes("baixo")) return 5;
  if (n.includes("guitarra")) return 6;
  return FORA_DO_PADRAO;
}

/** Ordena pela ordem padrão (ordenação estável: empates mantêm a ordem original). */
export function ordenarPeloPadrao(instrumentos: Instrumento[]): Instrumento[] {
  return instrumentos
    .map((inst, idx) => ({ inst, idx, pos: posicaoPadrao(inst.nome) }))
    .sort((a, b) => a.pos - b.pos || a.idx - b.idx)
    .map((x) => x.inst);
}

/**
 * Aplica a ordem escolhida pela pessoa (lista de ids). Sem ordem salva usa o
 * padrão. Instrumentos novos (que não estão na ordem salva) entram no final,
 * seguindo a ordem padrão; ids salvos que não existem mais são ignorados.
 */
export function ordenarFuncoes(
  instrumentos: Instrumento[],
  ordemSalva: string[] | null
): Instrumento[] {
  if (!ordemSalva || ordemSalva.length === 0) return ordenarPeloPadrao(instrumentos);
  const porId = new Map(instrumentos.map((i) => [i.id, i]));
  const naOrdem = ordemSalva
    .map((id) => porId.get(id))
    .filter((i): i is Instrumento => !!i);
  const usados = new Set(naOrdem.map((i) => i.id));
  const novos = ordenarPeloPadrao(instrumentos.filter((i) => !usados.has(i.id)));
  return [...naOrdem, ...novos];
}

/** Move o item de `de` para a posição `para` e devolve a nova lista de ids. */
export function moverItem(ids: string[], de: number, para: number): string[] {
  if (de === para || de < 0 || para < 0 || de >= ids.length || para >= ids.length) {
    return ids;
  }
  const copia = [...ids];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}
