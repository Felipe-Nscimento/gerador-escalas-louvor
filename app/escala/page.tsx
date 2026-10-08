import type { Metadata } from "next";
import { EscalaIntegrante } from "@/components/EscalaIntegrante";

export const metadata: Metadata = {
  title: "Escala do Louvor",
};

export default function PaginaEscalaIntegrante() {
  return <EscalaIntegrante />;
}
