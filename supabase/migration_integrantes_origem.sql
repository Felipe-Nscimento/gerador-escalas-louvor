-- Execute este arquivo no SQL Editor do Supabase.
-- Pode ser executado mais de uma vez sem problema. NÃO apaga nenhum cadastro.
--
-- PROBLEMA QUE ESTE ARQUIVO RESOLVE
-- Integrantes apagados voltavam sozinhos (duplicados). A causa era uma versão antiga do
-- app, aberta em algum aparelho/navegador com dados antigos guardados, que reenviava
-- esses dados para o banco toda vez que alguém entrava. Apagar no banco não adiantava,
-- porque o aparelho mandava tudo de novo.
--
-- COMO RESOLVE
-- A partir de agora o banco só aceita NOVOS integrantes enviados pela versão atual do app,
-- que marca o cadastro com origem = 'app-v2'. Versões antigas (sem a marca) passam a ser
-- recusadas e não conseguem mais recriar nada. Editar e excluir continuam como sempre.

alter table public.integrantes add column if not exists origem text;

-- Remove TODAS as policies de INSERT atuais da tabela (qualquer nome) e cria a nova.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'integrantes' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.integrantes', p.policyname);
  end loop;
end $$;

create policy "authenticated can insert integrantes"
  on public.integrantes for insert to authenticated
  with check (origem = 'app-v2');

-- ----------------------------------------------------------------------------------
-- (OPCIONAL) Para conferir se ainda sobram duplicados, rode esta consulta e apague
-- na tela de Integrantes do app os que forem repetidos. Ela só LISTA, não apaga:
--
--   select id, nome, nome_exibicao, created_at
--   from public.integrantes
--   order by lower(split_part(nome, ' ', 1)), created_at;
-- ----------------------------------------------------------------------------------
