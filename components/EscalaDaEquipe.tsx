"use client";

import { ComponentProps, useCallback, useEffect, useState } from "react";
import { EscalaPrincipal } from "@/components/EscalaPrincipal";
import {
  AvisoEquipe,
  excluirAviso,
  listarAvisos,
  listarPlaylists,
  PlaylistCulto,
  removerPlaylist,
  salvarAviso,
  salvarPlaylist,
} from "@/lib/extrasEscalaRemoto";
import { EVENTO_DADOS_ALTERADOS, supabaseConfigurado } from "@/lib/supabase";

type Props = Omit<ComponentProps<typeof EscalaPrincipal>, "playlists" | "avisos" | "edicaoExtras"> & {
  /** Líder/Montador logado com acesso: pode editar playlists e avisos. */
  podeEditar: boolean;
  userId: string | null;
};

/**
 * Aba Escala do app principal (Líder/Montador): carrega as playlists e os avisos do banco e
 * liga a edição. Recarrega sozinha depois de qualquer alteração.
 */
export function EscalaDaEquipe({ podeEditar, userId, ...resto }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistCulto[]>([]);
  const [avisos, setAvisos] = useState<AvisoEquipe[]>([]);
  const logado = resto.logado;

  const recarregar = useCallback(async () => {
    if (!supabaseConfigurado || !logado) return;
    try {
      const [p, a] = await Promise.all([listarPlaylists(), listarAvisos()]);
      setPlaylists(p);
      setAvisos(a);
    } catch {
      /* mantém o que já estava na tela */
    }
  }, [logado]);

  useEffect(() => {
    recarregar();
    window.addEventListener(EVENTO_DADOS_ALTERADOS, recarregar);
    return () => window.removeEventListener(EVENTO_DADOS_ALTERADOS, recarregar);
  }, [recarregar]);

  const edicaoExtras =
    podeEditar && userId
      ? {
          salvarPlaylist: async (data: string, culto: string, url: string) => {
            await salvarPlaylist(data, culto, url, userId);
            await recarregar();
          },
          removerPlaylist: async (data: string, culto: string) => {
            await removerPlaylist(data, culto);
            await recarregar();
          },
          salvarAviso: async (a: AvisoEquipe) => {
            await salvarAviso(a, userId);
            await recarregar();
          },
          excluirAviso: async (id: string) => {
            await excluirAviso(id);
            await recarregar();
          },
        }
      : undefined;

  return <EscalaPrincipal {...resto} playlists={playlists} avisos={avisos} edicaoExtras={edicaoExtras} />;
}
