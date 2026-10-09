"use client";

import { useEffect, useRef } from "react";

interface Props {
  nome: string;
  /** Aniversário em dd/mm (sem o ano). */
  diaMes: string;
  /** Frase de felicitação (cada pessoa recebe uma diferente). */
  mensagem: string;
  onFechar: () => void;
}

interface Confete {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  cor: string;
  balanco: number;
}

interface Foguete {
  x: number;
  y: number;
  vy: number;
  alvoY: number;
  cor: string;
}

interface Faisca {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  cor: string;
}

const CORES = ["#f43f5e", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#facc15", "#ec4899"];
const DURACAO_MS = 7000;

function sortear<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}

/**
 * Tela de parabéns: confetes caindo, rojões explodindo e a mensagem para o
 * aniversariante com a data (dd/mm). Fecha ao tocar, com Esc ou sozinha depois de alguns segundos.
 */
export function EfeitoAniversario({ nome, diaMes, mensagem, onFechar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fecharEm = window.setTimeout(onFechar, DURACAO_MS + 1500);
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.clearTimeout(fecharEm);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  useEffect(() => {
    // quem prefere menos movimento vê só a mensagem
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.scale(dpr, dpr);

    const confetes: Confete[] = [];
    const foguetes: Foguete[] = [];
    const faiscas: Faisca[] = [];
    const inicio = performance.now();
    let ultimoFoguete = 0;
    let ultimoConfete = 0;
    let quadro = 0;

    function novoConfete(): Confete {
      return {
        x: Math.random() * largura,
        y: -12,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        w: 6 + Math.random() * 5,
        h: 9 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        cor: sortear(CORES),
        balanco: Math.random() * Math.PI * 2,
      };
    }

    function novoFoguete(): Foguete {
      const alvoY = altura * (0.15 + Math.random() * 0.3);
      const g = 0.12;
      return {
        x: largura * (0.15 + Math.random() * 0.7),
        y: altura,
        vy: -Math.sqrt(2 * g * (altura - alvoY)),
        alvoY,
        cor: sortear(CORES),
      };
    }

    function explodir(f: Foguete) {
      const quantidade = 60;
      for (let i = 0; i < quantidade; i++) {
        const angulo = (Math.PI * 2 * i) / quantidade + Math.random() * 0.2;
        const forca = 1.5 + Math.random() * 3.5;
        faiscas.push({
          x: f.x,
          y: f.y,
          vx: Math.cos(angulo) * forca,
          vy: Math.sin(angulo) * forca,
          vida: 1,
          cor: Math.random() < 0.3 ? "#ffffff" : f.cor,
        });
      }
    }

    function desenhar(agora: number) {
      const decorrido = agora - inicio;
      ctx!.clearRect(0, 0, largura, altura);

      // confetes (nascem até ~4,5 s)
      if (decorrido < 4500 && agora - ultimoConfete > 40) {
        for (let i = 0; i < 3; i++) confetes.push(novoConfete());
        ultimoConfete = agora;
      }
      // rojões (sobem e explodem até ~4 s)
      if (decorrido < 4000 && agora - ultimoFoguete > 550) {
        foguetes.push(novoFoguete());
        ultimoFoguete = agora;
      }

      for (let i = confetes.length - 1; i >= 0; i--) {
        const c = confetes[i];
        c.balanco += 0.06;
        c.x += c.vx + Math.sin(c.balanco) * 0.8;
        c.y += c.vy;
        c.rot += c.vr;
        if (c.y > altura + 20) {
          confetes.splice(i, 1);
          continue;
        }
        ctx!.save();
        ctx!.translate(c.x, c.y);
        ctx!.rotate(c.rot);
        ctx!.fillStyle = c.cor;
        ctx!.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx!.restore();
      }

      for (let i = foguetes.length - 1; i >= 0; i--) {
        const f = foguetes[i];
        f.vy += 0.12;
        f.y += f.vy;
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = "#ffffff";
        ctx!.beginPath();
        ctx!.arc(f.x, f.y, 2.2, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = f.cor;
        ctx!.globalAlpha = 0.5;
        ctx!.beginPath();
        ctx!.arc(f.x, f.y + 6, 2, 0, Math.PI * 2);
        ctx!.fill();
        if (f.vy >= -0.5 || f.y <= f.alvoY) {
          explodir(f);
          foguetes.splice(i, 1);
        }
      }

      for (let i = faiscas.length - 1; i >= 0; i--) {
        const s = faiscas[i];
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + 0.05;
        s.x += s.vx;
        s.y += s.vy;
        s.vida -= 0.012;
        if (s.vida <= 0) {
          faiscas.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = Math.max(0, s.vida);
        ctx!.fillStyle = s.cor;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      const acabou = decorrido > 4500 && confetes.length === 0 && foguetes.length === 0 && faiscas.length === 0;
      if (!acabou && decorrido < DURACAO_MS + 3000) {
        quadro = requestAnimationFrame(desenhar);
      }
    }

    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Feliz aniversário, ${nome}`}
      onClick={onFechar}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-6 no-print"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-[hsl(var(--card))] p-7 text-center shadow-2xl"
      >
        <div className="text-6xl" aria-hidden="true">
          🎂
        </div>
        <h2 className="mt-3 text-2xl font-bold leading-tight">Feliz aniversário, {nome}! 🎉</h2>
        <p className="mt-2 inline-block rounded-full bg-[hsl(var(--accent))]/15 px-4 py-1 text-lg font-semibold text-[hsl(var(--accent))]">
          {diaMes}
        </p>
        <p className="mt-3 text-[hsl(var(--muted))]">{mensagem}</p>
        <button
          type="button"
          onClick={onFechar}
          className="mt-5 rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 font-semibold text-white"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
