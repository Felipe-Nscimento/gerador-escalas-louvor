"use client";

import { Card, CardContent } from "./ui/Card";
import { Select } from "./ui/Select";
import { Checkbox } from "./ui/Checkbox";
import { ConfiguracaoEscala, Regras } from "@/lib/types";
import { contarDomingosDoMes } from "@/lib/scheduleGenerator";
import { MESES } from "@/lib/whatsapp";

interface Props {
  config: ConfiguracaoEscala;
  setConfig: (fn: (prev: ConfiguracaoEscala) => ConfiguracaoEscala) => void;
}

const REGRAS_LABEL: Record<keyof Regras, string> = {
  permitirDomingoSolo: "Permitir domingo solo",
  felipePodeSozinho: "Felipe pode tocar sozinho",
  violaoDispensaBaixo: "Quando o violonista estiver tocando, não precisa de baixo",
  maxDuasVozes: "Apenas duas vozes por culto",
  balancearParticipacoes: "Balancear participações",
  evitarRepetirMesAnterior: "Evitar repetir a mesma escala do mês anterior",
};

export function SettingsPanel({ config, setConfig }: Props) {
  const domingosReais = contarDomingosDoMes(config.mes, config.ano);
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Configurações</h2>
        <p className="text-sm text-[hsl(var(--muted))]">
          Defina o período e as regras antes de gerar a escala.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mês</label>
              <Select
                value={config.mes}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, mes: Number(e.target.value) }))
                }
              >
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Ano</label>
              <Select
                value={config.ano}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, ano: Number(e.target.value) }))
                }
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Quantidade de domingos ({domingosReais} neste mês)
            </label>
            <Select
              value={config.quantidadeDomingos}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  quantidadeDomingos: Number(e.target.value) as 4 | 5,
                  domingoSolo:
                    c.domingoSolo && c.domingoSolo > Number(e.target.value)
                      ? null
                      : c.domingoSolo,
                }))
              }
            >
              <option value={4}>4 domingos</option>
              {domingosReais >= 5 && <option value={5}>5 domingos</option>}
            </Select>
          </div>

          {config.regras.permitirDomingoSolo && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Domingo do solo
              </label>
              <div className="flex flex-wrap gap-2">
                {["Nenhum", "Primeiro", "Segundo", "Terceiro", "Quarto", "Quinto"]
                  .slice(0, config.quantidadeDomingos + 1)
                  .map((label, i) => (
                    <button
                      key={label}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          domingoSolo: i === 0 ? null : i,
                        }))
                      }
                      className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                        (i === 0 && config.domingoSolo === null) ||
                        config.domingoSolo === i
                          ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                          : "border-[hsl(var(--border))] hover:bg-[hsl(var(--border))]/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-medium mb-2">Regras gerais</h3>
          <div className="grid gap-1">
            {(Object.keys(REGRAS_LABEL) as (keyof Regras)[]).map((key) => (
              <Checkbox
                key={key}
                label={REGRAS_LABEL[key]}
                checked={config.regras[key]}
                onChange={() =>
                  setConfig((c) => ({
                    ...c,
                    regras: { ...c.regras, [key]: !c.regras[key] },
                  }))
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
