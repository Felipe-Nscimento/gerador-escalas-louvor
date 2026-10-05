"use client";

import {
  chaveMesDia,
  FormularioCadastro,
  formatarDataBR,
  formatarInstagram,
  formatarWhatsapp,
  NOMES_MESES,
  STATUS_FORMULARIO_LABEL,
} from "@/lib/formularios";
import type { InstrumentoOpcao } from "./FormularioCadastroForm";

export type TipoRelatorio = "completo" | "aniversario" | "contato";

export const TIPOS_RELATORIO: { id: TipoRelatorio; titulo: string; descricao: string }[] = [
  {
    id: "completo",
    titulo: "Completo",
    descricao: "Foto, nome, WhatsApp, Instagram, endereço, aniversário, instrumentos e status",
  },
  {
    id: "aniversario",
    titulo: "Aniversário",
    descricao: "Foto, nome e data de aniversário, ordenado por mês e dia",
  },
  {
    id: "contato",
    titulo: "WhatsApp / Instagram",
    descricao: "Foto, nome, WhatsApp e Instagram",
  },
];

const TITULO_POR_TIPO: Record<TipoRelatorio, string> = {
  completo: "Relatório completo",
  aniversario: "Aniversariantes",
  contato: "Contatos (WhatsApp / Instagram)",
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Foto({ f }: { f: FormularioCadastro }) {
  const nome = f.nome ?? "?";
  if (f.foto_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={f.foto_url}
        alt={nome}
        style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 999, display: "block" }}
      />
    );
  }
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: "#ede9fe",
        color: "#6d28d9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {iniciais(nome)}
    </span>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#555",
  borderBottom: "2px solid #ccc",
};
const td: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 11,
  verticalAlign: "middle",
  borderBottom: "1px solid #e5e5e5",
};

interface Props {
  tipo: TipoRelatorio;
  itens: FormularioCadastro[];
  instrumentos: InstrumentoOpcao[];
  descricaoFiltros: string;
  nomeEquipe?: string;
}

export function FormulariosRelatorio({
  tipo,
  itens,
  instrumentos,
  descricaoFiltros,
  nomeEquipe,
}: Props) {
  const nomeInstrumento = new Map(instrumentos.map((i) => [i.id, `${i.emoji} ${i.nome}`]));
  const geradoEm = new Date().toLocaleDateString("pt-BR");

  const ordenados = [...itens].sort((a, b) => {
    if (tipo === "aniversario") {
      const d = chaveMesDia(a.data_aniversario) - chaveMesDia(b.data_aniversario);
      if (d !== 0) return d;
    }
    return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR");
  });

  // Linhas; no relatório de aniversário entram cabeçalhos de mês (calendário).
  const linhas: { chave: string; mes?: string; item?: FormularioCadastro }[] = [];
  if (tipo === "aniversario") {
    let mesAtual = "";
    for (const f of ordenados) {
      const mes = f.data_aniversario
        ? NOMES_MESES[Number(f.data_aniversario.slice(5, 7)) - 1]
        : "Sem data de aniversário";
      if (mes !== mesAtual) {
        mesAtual = mes;
        linhas.push({ chave: `mes-${mes}`, mes });
      }
      linhas.push({ chave: f.id, item: f });
    }
  } else {
    for (const f of ordenados) linhas.push({ chave: f.id, item: f });
  }

  const colunas =
    tipo === "completo"
      ? ["Foto", "Nome", "WhatsApp", "Instagram", "Endereço", "Aniversário", "Instrumentos", "Status"]
      : tipo === "aniversario"
      ? ["Foto", "Nome", "Data de aniversário"]
      : ["Foto", "Nome", "WhatsApp", "Instagram"];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          #print-area { padding: 0 !important; border: 0 !important; border-radius: 0 !important; }
          #print-area tr { break-inside: avoid; }
          #print-area { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div
        id="print-area"
        style={{
          background: "#fff",
          color: "#111",
          padding: 20,
          borderRadius: 16,
          border: "1px solid #ddd",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          Cadastro de Integrantes — {nomeEquipe?.trim() || "Equipe de Louvor"}
        </h1>
        <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
          {TITULO_POR_TIPO[tipo]} · Gerado em {geradoEm} · {itens.length}{" "}
          {itens.length === 1 ? "cadastro" : "cadastros"}
        </p>
        {descricaoFiltros && (
          <p style={{ fontSize: 11, color: "#777", margin: "2px 0 0" }}>Filtros: {descricaoFiltros}</p>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c} style={th}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              if (l.mes) {
                return (
                  <tr key={l.chave}>
                    <td
                      colSpan={colunas.length}
                      style={{
                        padding: "8px 8px 4px",
                        fontSize: 12,
                        fontWeight: 700,
                        background: "#f5f3ff",
                        color: "#5b21b6",
                        borderBottom: "1px solid #ddd6fe",
                      }}
                    >
                      {l.mes}
                    </td>
                  </tr>
                );
              }
              const f = l.item as FormularioCadastro;
              const insts = f.instrumentos.map((id) => nomeInstrumento.get(id)).filter(Boolean);
              return (
                <tr key={l.chave}>
                  <td style={{ ...td, width: 52 }}>
                    <Foto f={f} />
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{f.nome}</td>
                  {tipo === "completo" && (
                    <>
                      <td style={td}>{formatarWhatsapp(f.whatsapp) || "—"}</td>
                      <td style={td}>{formatarInstagram(f.instagram) || "—"}</td>
                      <td style={td}>{f.endereco || "—"}</td>
                      <td style={td}>{formatarDataBR(f.data_aniversario) || "—"}</td>
                      <td style={td}>{insts.length > 0 ? insts.join(", ") : "—"}</td>
                      <td style={td}>{STATUS_FORMULARIO_LABEL[f.status]}</td>
                    </>
                  )}
                  {tipo === "aniversario" && (
                    <td style={td}>{formatarDataBR(f.data_aniversario) || "—"}</td>
                  )}
                  {tipo === "contato" && (
                    <>
                      <td style={td}>{formatarWhatsapp(f.whatsapp) || "—"}</td>
                      <td style={td}>{formatarInstagram(f.instagram) || "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
