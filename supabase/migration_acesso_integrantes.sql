-- Execute este arquivo no SQL Editor do Supabase.
-- Pode ser executado mais de uma vez sem problema. NÃO apaga nenhum dado.
--
-- ACESSO DOS INTEGRANTES À ABA ESCALA (página /escala do app)
-- O integrante entra com o NOME e uma SENHA = data de aniversário só com números
-- (ddmmaaaa, ex.: 15/10/1990 -> 15101990). Sem criar usuário no Supabase.
--
-- Segurança: as tabelas continuam fechadas para quem não está logado. A página /escala
-- só consegue chamar a função abaixo, que confere nome + senha e devolve APENAS o
-- necessário para montar os cards (cultos, quem toca o quê, nome, foto, instrumentos e
-- dia/mês de aniversário). Telefone, e-mail, endereço, ano de nascimento e demais dados
-- das escalas NÃO saem do banco. Há limite de tentativas contra adivinhação de senha.

create table if not exists public.acesso_integrantes_falhas (
  id bigint generated always as identity primary key,
  chave text not null,
  tentou_em timestamptz not null default now()
);
create index if not exists acesso_integrantes_falhas_idx
  on public.acesso_integrantes_falhas (chave, tentou_em);

-- Sem nenhuma policy de propósito: ninguém lê/escreve direto, só a função abaixo.
alter table public.acesso_integrantes_falhas enable row level security;

-- Texto sem acento, minúsculo e com espaços simples (para comparar nomes).
create or replace function public.norm_texto(t text)
returns text language sql immutable as $$
  select lower(translate(
    btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  ))
$$;

create or replace function public.escala_para_integrante(p_nome text, p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := public.norm_texto(p_nome);
  v_senha text := regexp_replace(coalesce(p_senha, ''), '\D', '', 'g');
  v_achou record;
  v_escalas jsonb;
  v_txt text;
  v_pessoas jsonb;
  v_instrumentos jsonb;
  v_ordem jsonb := null;
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 80 or char_length(v_senha) <> 8 then
    return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  -- Limite de tentativas (15 min): por nome e no total.
  delete from public.acesso_integrantes_falhas where tentou_em < now() - interval '1 day';
  if (select count(*) from public.acesso_integrantes_falhas
        where chave = v_nome and tentou_em > now() - interval '15 minutes') >= 8
     or (select count(*) from public.acesso_integrantes_falhas
        where tentou_em > now() - interval '15 minutes') >= 300 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  -- Nome (completo, de exibição ou só o primeiro nome) + data de aniversário.
  select i.id, coalesce(nullif(btrim(i.nome_exibicao), ''), i.nome) as nome
    into v_achou
  from public.integrantes i
  where i.ativo
    and i.data_aniversario is not null
    and to_char(i.data_aniversario, 'DDMMYYYY') = v_senha
    and (
      public.norm_texto(i.nome) = v_nome
      or public.norm_texto(i.nome_exibicao) = v_nome
      or split_part(public.norm_texto(i.nome), ' ', 1) = v_nome
    )
  limit 1;

  if not found then
    insert into public.acesso_integrantes_falhas (chave) values (v_nome);
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;

  -- Escalas aprovadas/publicadas, só com o que o card usa (datas, títulos e ids).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'atualizadoEm', coalesce(e.payload->>'atualizadoEm', e.approved_at::text, e.created_at::text),
      'domingos', case when jsonb_typeof(e.payload->'domingos') = 'array' then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'data', d->>'data',
          'numero', d->'numero',
          'escalacao', jsonb_build_object(
            'solo', coalesce((d->'escalacao'->'solo') = 'true'::jsonb, false),
            'atribuicoes', case when jsonb_typeof(d->'escalacao'->'atribuicoes') = 'object'
                                then d->'escalacao'->'atribuicoes' else '{}'::jsonb end
          )
        )), '[]'::jsonb)
        from jsonb_array_elements(e.payload->'domingos') d
      ) else '[]'::jsonb end,
      'cultosExtras', case when jsonb_typeof(e.payload->'cultosExtras') = 'array' then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', x->>'id',
          'data', x->>'data',
          'titulo', x->>'titulo',
          'escalacao', jsonb_build_object(
            'solo', coalesce((x->'escalacao'->'solo') = 'true'::jsonb, false),
            'atribuicoes', case when jsonb_typeof(x->'escalacao'->'atribuicoes') = 'object'
                                then x->'escalacao'->'atribuicoes' else '{}'::jsonb end
          )
        )), '[]'::jsonb)
        from jsonb_array_elements(e.payload->'cultosExtras') x
      ) else '[]'::jsonb end
    ) order by e.created_at
  ), '[]'::jsonb)
  into v_escalas
  from public.escalas_aprovacao e
  where e.status in ('aprovada', 'publicada');

  -- Só as pessoas que aparecem nessas escalas. Aniversário: apenas dia e mês.
  v_txt := v_escalas::text;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'nome', i.nome,
    'nomeExibicao', i.nome_exibicao,
    'foto', i.foto,
    'ativo', true,
    'dataAniversario', case when i.data_aniversario is null then null
                            else '2000-' || to_char(i.data_aniversario, 'MM-DD') end
  )), '[]'::jsonb)
  into v_pessoas
  from public.integrantes i
  where strpos(v_txt, '"' || i.id || '"') > 0;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'emoji', s.emoji)), '[]'::jsonb)
  into v_instrumentos
  from public.instrumentos s;

  -- Ordem das funções escolhida pelo líder (se a tabela existir).
  begin
    select p.valor into v_ordem from public.preferencias_app p where p.chave = 'ordem_funcoes';
  exception when others then
    v_ordem := null;
  end;

  return jsonb_build_object(
    'ok', true,
    'nome', v_achou.nome,
    'escalas', v_escalas,
    'integrantes', v_pessoas,
    'instrumentos', v_instrumentos,
    'ordemFuncoes', v_ordem
  );
end;
$$;

revoke all on function public.escala_para_integrante(text, text) from public;
grant execute on function public.escala_para_integrante(text, text) to anon, authenticated;
