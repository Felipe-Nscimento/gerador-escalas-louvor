import type { Metadata } from "next";
import { FormularioPublico } from "@/components/FormularioPublico";

// Página pública: não deve aparecer em buscadores nem ser indexada.
export const metadata: Metadata = {
  title: "Cadastro da equipe de louvor",
  robots: { index: false, follow: false },
};

export default function PaginaFormularioPublico({ params }: { params: { token: string } }) {
  return <FormularioPublico token={params.token} />;
}
