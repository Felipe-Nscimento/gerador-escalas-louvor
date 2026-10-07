"use client";

import { useEffect, useState } from "react";
import { Menu, MoreHorizontal, Moon, Music, Sun, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ItemMenu {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  /** Todas as telas disponíveis para quem está usando (já filtradas por permissão). */
  itens: ItemMenu[];
  /** Id da tela aberta. */
  ativo: string;
  /** Ids que aparecem na barra de baixo (o resto fica no menu "Mais"). */
  principais: string[];
  onSelecionar: (id: string) => void;
  tema: "claro" | "escuro";
  onAlternarTema: () => void;
}

/**
 * Navegação no estilo de app de igreja: barra fixa embaixo (ícone + rótulo, com um
 * pontinho no item ativo), topo limpo com botão de menu à esquerda e título da tela no
 * centro, e menu lateral com todas as funcionalidades.
 */
export function NavegacaoApp({ itens, ativo, principais, onSelecionar, tema, onAlternarTema }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!menuAberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAberto(false);
    }
    window.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [menuAberto]);

  const itemAtivo = itens.find((i) => i.id === ativo);
  const barra = principais
    .map((id) => itens.find((i) => i.id === id))
    .filter((i): i is ItemMenu => !!i);
  // "Mais" fica marcado quando a tela aberta não está na barra de baixo
  const maisAtivo = !barra.some((i) => i.id === ativo);

  function escolher(id: string) {
    onSelecionar(id);
    setMenuAberto(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      {/* Topo */}
      <header className="sticky top-0 z-10 bg-[hsl(var(--background))] no-print">
        <div className="max-w-3xl mx-auto px-4 py-3 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="h-11 w-11 rounded-2xl bg-[hsl(var(--card))] shadow-sm flex items-center justify-center"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-center text-base font-semibold truncate">{itemAtivo?.label ?? ""}</h1>
          <button
            type="button"
            onClick={onAlternarTema}
            aria-label="Alternar tema"
            className="h-11 w-11 rounded-2xl bg-[hsl(var(--card))] shadow-sm flex items-center justify-center"
          >
            {tema === "claro" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Menu lateral */}
      <div
        className={`fixed inset-0 z-40 no-print ${menuAberto ? "" : "pointer-events-none"}`}
        aria-hidden={!menuAberto}
      >
        <div
          onClick={() => setMenuAberto(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            menuAberto ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85%] bg-[hsl(var(--card))] shadow-xl flex flex-col transition-transform duration-200 ${
            menuAberto ? "translate-x-0" : "-translate-x-full invisible"
          }`}
        >
          <div className="flex items-center justify-between gap-2 p-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-2xl bg-[hsl(var(--accent))]/15 flex items-center justify-center">
                <Music className="h-5 w-5 text-[hsl(var(--accent))]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">Gerador de Escalas</p>
                <p className="text-xs text-[hsl(var(--muted))] leading-tight">de Louvor</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="p-2 rounded-xl hover:bg-[hsl(var(--border))]/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
            {itens.map(({ id, label, icon: Icon }) => {
              const marcado = id === ativo;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => escolher(id)}
                  aria-current={marcado ? "page" : undefined}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-medium transition-colors ${
                    marcado
                      ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                      : "hover:bg-[hsl(var(--border))]/40"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>
      </div>

      {/* Barra de baixo */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 inset-x-0 z-20 bg-[hsl(var(--card))] shadow-[0_-4px_20px_rgba(0,0,0,0.07)] pb-[env(safe-area-inset-bottom)] no-print"
      >
        <div className="max-w-3xl mx-auto flex">
          {barra.map(({ id, label, icon: Icon }) => (
            <AbaInferior
              key={id}
              rotulo={label}
              icone={Icon}
              ativo={id === ativo}
              onClick={() => escolher(id)}
            />
          ))}
          <AbaInferior
            rotulo="Mais"
            icone={MoreHorizontal}
            ativo={maisAtivo}
            onClick={() => setMenuAberto(true)}
          />
        </div>
      </nav>
    </>
  );
}

function AbaInferior({
  rotulo,
  icone: Icon,
  ativo,
  onClick,
}: {
  rotulo: string;
  icone: LucideIcon;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`flex-1 min-w-0 flex flex-col items-center gap-1 pt-2.5 pb-2 transition-colors ${
        ativo ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted))]"
      }`}
    >
      <Icon className="h-6 w-6" strokeWidth={ativo ? 2 : 1.6} />
      <span className="text-[11px] leading-none truncate max-w-full px-1">{rotulo}</span>
      <span
        className={`h-1 w-1 rounded-full ${ativo ? "bg-[hsl(var(--primary))]" : "bg-transparent"}`}
      />
    </button>
  );
}
