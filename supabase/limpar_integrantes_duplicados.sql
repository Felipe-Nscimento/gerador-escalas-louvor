-- LIMPEZA dos integrantes duplicados (rode DEPOIS de publicar a correção do app).
-- Não é uma migration: é um script para você rodar uma vez, em dois passos.
--
-- Como os duplicados foram criados: o app reenviava para o banco a lista antiga que ficava
-- guardada no navegador ("Daniel", "Karine", "Maduh"...), porque no banco os nomes já eram
-- completos ("Daniel Lima Andrade"). O cadastro MAIS ANTIGO é o verdadeiro; o mais novo,
-- com nome curto, é o duplicado.

-- ============================================================
-- PASSO 1 — só LISTA os suspeitos. Nada é apagado aqui.
-- Confira linha por linha: "nome_duplicado" é o que será apagado e "nome_original" é o
-- cadastro que fica. Se aparecer um par que NÃO é a mesma pessoa, me avise antes do passo 2.
-- A coluna "usado_em_escala_nuvem" mostra se o duplicado aparece em alguma escala salva na
-- nuvem; esses NÃO são apagados no passo 2.
-- ============================================================
with base as (
  select id, nome, nome_exibicao, created_at,
         lower(btrim(nome)) as n,
         lower(btrim(coalesce(nome_exibicao, ''))) as ne
  from public.integrantes
),
suspeitos as (
  select d.id   as id_duplicado,
         d.nome as nome_duplicado,
         d.created_at as criado_em,
         o.id   as id_original,
         o.nome as nome_original
  from base d
  join base o
    on o.id <> d.id
   and o.created_at < d.created_at
   and d.ne = ''                                   -- os duplicados vieram sem nome de exibição
   and ( o.n = d.n                                 -- mesmo nome
      or o.n like d.n || ' %'                      -- "Daniel" x "Daniel Lima Andrade"
      or (o.ne <> '' and o.ne = d.n) )             -- "Maduh" é o nome de exibição do original
)
select s.*,
       exists (select 1 from public.escalas_aprovacao e
               where e.payload::text like '%' || s.id_duplicado || '%') as usado_em_escala_nuvem
from suspeitos s
order by s.nome_duplicado, s.criado_em;

-- ============================================================
-- PASSO 2 — APAGA os duplicados listados acima (menos os usados em escala da nuvem).
-- Só rode depois de conferir o passo 1. Para rodar, selecione SÓ o bloco abaixo no
-- SQL Editor e clique em Run.
-- ============================================================
/*
with base as (
  select id, nome, nome_exibicao, created_at,
         lower(btrim(nome)) as n,
         lower(btrim(coalesce(nome_exibicao, ''))) as ne
  from public.integrantes
),
suspeitos as (
  select distinct d.id as id_duplicado
  from base d
  join base o
    on o.id <> d.id
   and o.created_at < d.created_at
   and d.ne = ''
   and ( o.n = d.n
      or o.n like d.n || ' %'
      or (o.ne <> '' and o.ne = d.n) )
)
delete from public.integrantes i
using suspeitos s
where i.id = s.id_duplicado
  and not exists (select 1 from public.escalas_aprovacao e
                  where e.payload::text like '%' || i.id || '%');
*/
