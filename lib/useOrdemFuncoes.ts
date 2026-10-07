"use client";

import { useEffect } from "react";
import { KEYS, usePersistedState } from "./storage";
import { assinarPreferenciasRemotas, carregarOrdemFuncoesRemota } from "./preferenciasRemoto";

/**
 * Ordem das funções (ids de instrumentos) escolhida na aba "Gerar escala".
 * Somente leitura: usa a cópia do aparelho e, se estiver logado, a da nuvem
 * (a da nuvem manda). `null` = ordem padrão.
 */
export function useOrdemFuncoes(logado: boolean): string[] | null {
  const [ordem, setOrdem] = usePersistedState<string[] | null>(KEYS.ordemFuncoes, null);

  useEffect(() => {
    if (!logado) return;
    let ativo = true;
    function sincronizar() {
      carregarOrdemFuncoesRemota()
        .then((remota) => {
          if (ativo && remota !== undefined) setOrdem(remota.length > 0 ? remota : null);
        })
        .catch(() => {
          /* sem a nuvem, segue com a ordem do aparelho */
        });
    }
    sincronizar();
    const cancelar = assinarPreferenciasRemotas(sincronizar);
    return () => {
      ativo = false;
      cancelar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logado]);

  return ordem;
}
