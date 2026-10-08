"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, MessageCircle } from "lucide-react";

/**
 * Atalho para líder/montador: link da página /escala, onde os integrantes veem só a
 * aba Escala (nome + data de aniversário só com números como senha).
 */
export function LinkAcessoIntegrantes() {
  const [url, setUrl] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/escala`);
  }, []);

  if (!url) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  const mensagem =
    `Olá! Aqui você consulta a escala do louvor:\n${url}\n\n` +
    `Entre com o seu nome e, como senha, a sua data de aniversário só com números ` +
    `(dia, mês e ano). Ex.: 15/10/1990 vira 15101990.`;

  return (
    <section
      aria-label="Acesso dos integrantes"
      className="no-print mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-[hsl(var(--accent))]/15 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-[hsl(var(--accent))]" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">Link para os integrantes</p>
          <p className="mt-0.5 text-sm text-[hsl(var(--muted))]">
            Eles veem só a aba Escala. Entram com o nome e a data de aniversário só com números (ddmmaaaa)
            como senha. Só funciona para quem tem a data de aniversário cadastrada em Integrantes.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--border))]/40"
        >
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
        </a>
      </div>
    </section>
  );
}
