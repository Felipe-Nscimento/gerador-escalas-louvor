"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { normalizarLinkPlaylist } from "@/lib/extrasEscalaRemoto";

interface Props {
  /** Link já salvo para este culto (sem link, os integrantes não veem nada). */
  url?: string;
  /** Só passa para Líder e Montador: permite adicionar, trocar e remover o link. */
  edicao?: {
    salvar: (url: string) => Promise<void>;
    remover: () => Promise<void>;
  };
}

function nomeDoServico(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("spotify")) return "Spotify";
    if (host.includes("youtube") || host === "youtu.be") return "YouTube";
    if (host.includes("deezer")) return "Deezer";
    if (host.includes("apple")) return "Apple Music";
  } catch {
    /* link inválido: segue sem nome */
  }
  return "";
}

/**
 * Link da playlist do culto, no cabeçalho do card. Para os integrantes: só aparece se houver
 * link. Para Líder/Montador: também mostra o botão para adicionar ou editar.
 */
export function PlaylistCultoControle({ url, edicao }: Props) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const linkValido = url ? normalizarLinkPlaylist(url) : null;

  function abrirEdicao() {
    setValor(linkValido ?? "");
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    const limpo = normalizarLinkPlaylist(valor);
    if (!limpo) {
      setErro("Cole um link completo, começando com https://");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await edicao!.salvar(limpo);
      setEditando(false);
    } catch {
      setErro("Não foi possível salvar agora. Confira a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    setSalvando(true);
    setErro(null);
    try {
      await edicao!.remover();
      setEditando(false);
    } catch {
      setErro("Não foi possível remover agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (edicao && editando) {
    return (
      <div className="mt-3 space-y-2" onPointerDown={(e) => e.stopPropagation()}>
        <label className="text-xs font-medium text-[hsl(var(--muted))]" htmlFor="link-playlist">
          Link da playlist deste culto
        </label>
        <Input
          id="link-playlist"
          type="url"
          inputMode="url"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          maxLength={500}
          autoFocus
        />
        {erro && (
          <p role="alert" className="text-sm text-red-500">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-full bg-[hsl(var(--primary))] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            disabled={salvando}
            className="rounded-full border border-[hsl(var(--border))] px-4 py-1.5 text-sm font-semibold"
          >
            Cancelar
          </button>
          {linkValido && (
            <button
              type="button"
              onClick={remover}
              disabled={salvando}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"
            >
              Remover link
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!linkValido && !edicao) return null; // sem link e sem permissão de editar: não mostra nada

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {linkValido && (
        <a
          href={linkValido}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))]/15 px-3.5 py-1.5 text-sm font-semibold text-[hsl(var(--accent))]"
        >
          🎧 Ouvir playlist{nomeDoServico(linkValido) ? ` no ${nomeDoServico(linkValido)}` : ""}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {edicao &&
        (linkValido ? (
          <button
            type="button"
            onClick={abrirEdicao}
            aria-label="Editar link da playlist"
            title="Editar link da playlist"
            className="p-2 rounded-full text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/40"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={abrirEdicao}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[hsl(var(--border))] px-3.5 py-1.5 text-sm font-medium text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/30"
          >
            <Plus className="h-4 w-4" /> Playlist do culto
          </button>
        ))}
    </div>
  );
}
