-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Só ADICIONA duas colunas na tabela integrantes que já existe — não mexe
-- em mais nada (nenhuma policy, nenhuma outra tabela).
--
-- preferencias: ids de Instrumento que a pessoa prefere (usado só pra
-- pontuação no gerador inteligente, nunca bloqueia ninguém).
-- restricoes: bloqueios individuais (função que não pode exercer, e se
-- pode ou não acumular duas funções no mesmo culto).

alter table public.integrantes
  add column if not exists preferencias jsonb not null default '[]'::jsonb,
  add column if not exists restricoes jsonb;
