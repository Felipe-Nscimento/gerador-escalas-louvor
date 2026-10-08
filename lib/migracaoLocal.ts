/**
 * Regras da "migração" que envia dados do navegador (LocalStorage) para o Supabase
 * quando alguém loga. A nuvem é a fonte oficial: depois que ela tem dados, o que está
 * guardado no navegador NUNCA é reenviado — senão cadastros apagados (ou renomeados)
 * na nuvem voltam como duplicados a cada vez que o app é aberto.
 */

export type DecisaoMigracao = "pular" | "enviar";

/**
 * - nuvem já tem registros → pula (nunca reenvia o que está no aparelho);
 * - nuvem vazia mas este aparelho já migrou antes → pula (esvaziar a nuvem foi de propósito);
 * - nuvem vazia e primeira vez neste aparelho/usuário → envia (configuração inicial).
 */
export function decidirMigracao(qtdNaNuvem: number, jaMigrouNesteAparelho: boolean): DecisaoMigracao {
  if (qtdNaNuvem > 0) return "pular";
  if (jaMigrouNesteAparelho) return "pular";
  return "enviar";
}

export function chaveMigracao(tipo: "integrantes" | "instrumentos", userId: string): string {
  return `louvor:migracao:${tipo}:${userId}`;
}

export function jaMigrou(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

export function marcarMigrou(chave: string): void {
  try {
    window.localStorage.setItem(chave, "1");
  } catch {
    /* sem LocalStorage: a regra "nuvem já tem registros" continua protegendo */
  }
}
