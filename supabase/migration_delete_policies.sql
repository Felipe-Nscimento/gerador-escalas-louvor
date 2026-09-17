-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Só ADICIONA duas policies novas — não recria tabelas, não mexe em
-- nenhuma policy existente de select/insert/update.
--
-- Motivo: até agora não existia policy de delete de propósito (pra não
-- incentivar apagar gente que já apareceu em escala). Mas isso também
-- bloqueou a limpeza de cadastros duplicados — então liberamos exclusão
-- física para quem estiver autenticado. Continua seguro: escalas antigas
-- guardam uma cópia do integrante/instrumento congelada dentro do próprio
-- payload, não uma referência viva a estas tabelas, então excluir aqui
-- nunca quebra uma escala já salva.

create policy "authenticated can delete integrantes"
  on public.integrantes for delete to authenticated using (true);

create policy "authenticated can delete instrumentos"
  on public.instrumentos for delete to authenticated using (true);
