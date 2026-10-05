-- Execute este arquivo no SQL Editor do Supabase (depois de migration_formularios_cadastro.sql).
-- Pode ser executado mais de uma vez sem problema. Não apaga nenhum dado.
-- Depois deste arquivo, NÃO rode migration_formularios_cadastro.sql de novo (ela
-- recriaria a versão antiga da função de envio).
--
-- Acrescenta ao Formulário de Cadastro:
--   * se participa de célula e qual
--   * trajetória na igreja (checklist): Acompanhamento inicial, Café com pastor,
--     Estação DNA e Batismo
--   * se serve em algum ministério da igreja e qual

alter table public.formularios_cadastro
  add column if not exists participa_celula boolean,
  add column if not exists celula_nome text,
  add column if not exists trajetoria text[] not null default '{}',
  add column if not exists serve_ministerio boolean,
  add column if not exists ministerio_nome text;

alter table public.formularios_cadastro drop constraint if exists formularios_celula_ok;
alter table public.formularios_cadastro add constraint formularios_celula_ok
  check (celula_nome is null or char_length(celula_nome) <= 100);

alter table public.formularios_cadastro drop constraint if exists formularios_ministerio_ok;
alter table public.formularios_cadastro add constraint formularios_ministerio_ok
  check (ministerio_nome is null or char_length(ministerio_nome) <= 100);

alter table public.formularios_cadastro drop constraint if exists formularios_trajetoria_ok;
alter table public.formularios_cadastro add constraint formularios_trajetoria_ok
  check (trajetoria <@ array['acompanhamento_inicial', 'cafe_com_pastor', 'estacao_dna', 'batismo']::text[]);

-- A função pública de envio ganha 5 parâmetros novos (com valor padrão, então
-- páginas antigas abertas no celular continuam conseguindo enviar).
drop function if exists public.formulario_publico_enviar(text, text, text, text, text, date, text, text[]);

create or replace function public.formulario_publico_enviar(
  p_token text,
  p_nome text,
  p_whatsapp text,
  p_instagram text,
  p_endereco text,
  p_data_aniversario date,
  p_foto_path text,
  p_instrumentos text[],
  p_participa_celula boolean default null,
  p_celula_nome text default null,
  p_trajetoria text[] default '{}',
  p_serve_ministerio boolean default null,
  p_ministerio_nome text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f public.formularios_cadastro%rowtype;
  v_nome text;
  v_whats text;
  v_insta text;
  v_end text;
  v_ids text[];
  v_cel text;
  v_min text;
  v_traj text[];
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;

  select * into f from public.formularios_cadastro where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  if f.status <> 'aguardando' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_enviado');
  end if;
  if f.link_expira_em is not null and f.link_expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;

  v_nome := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  if char_length(v_nome) < 2 or char_length(v_nome) > 120 then
    return jsonb_build_object('ok', false, 'motivo', 'nome_invalido');
  end if;

  v_whats := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  if v_whats is not null and length(v_whats) in (12, 13) and left(v_whats, 2) = '55' then
    v_whats := substr(v_whats, 3);
  end if;
  if v_whats is not null and v_whats !~ '^[0-9]{10,11}$' then
    return jsonb_build_object('ok', false, 'motivo', 'whatsapp_invalido');
  end if;

  v_insta := nullif(regexp_replace(btrim(coalesce(p_instagram, '')), '^@+', ''), '');
  if v_insta is not null and v_insta !~ '^[A-Za-z0-9._]{1,30}$' then
    return jsonb_build_object('ok', false, 'motivo', 'instagram_invalido');
  end if;

  v_end := nullif(btrim(coalesce(p_endereco, '')), '');
  if v_end is not null and char_length(v_end) > 300 then
    return jsonb_build_object('ok', false, 'motivo', 'endereco_invalido');
  end if;

  if p_data_aniversario is not null
     and (p_data_aniversario < date '1900-01-01' or p_data_aniversario > current_date) then
    return jsonb_build_object('ok', false, 'motivo', 'data_invalida');
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_instrumentos, '{}'::text[])) as x);
  if coalesce(array_length(v_ids, 1), 0) > 30 then
    return jsonb_build_object('ok', false, 'motivo', 'instrumento_inexistente');
  end if;
  if exists (
    select 1 from unnest(v_ids) as x
    where not exists (select 1 from public.instrumentos i where i.id = x)
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'instrumento_inexistente');
  end if;

  -- Célula, trajetória e ministério (campos opcionais).
  v_cel := case when p_participa_celula is true
                then nullif(btrim(regexp_replace(coalesce(p_celula_nome, ''), '\s+', ' ', 'g')), '')
                else null end;
  if v_cel is not null and char_length(v_cel) > 100 then
    return jsonb_build_object('ok', false, 'motivo', 'celula_invalida');
  end if;

  v_min := case when p_serve_ministerio is true
                then nullif(btrim(regexp_replace(coalesce(p_ministerio_nome, ''), '\s+', ' ', 'g')), '')
                else null end;
  if v_min is not null and char_length(v_min) > 100 then
    return jsonb_build_object('ok', false, 'motivo', 'ministerio_invalido');
  end if;

  v_traj := array(select distinct x from unnest(coalesce(p_trajetoria, '{}'::text[])) as x);
  if not (v_traj <@ array['acompanhamento_inicial', 'cafe_com_pastor', 'estacao_dna', 'batismo']::text[]) then
    return jsonb_build_object('ok', false, 'motivo', 'trajetoria_invalida');
  end if;

  -- A foto, se existir, precisa estar na pasta DESTE cadastro e já ter sido enviada.
  if p_foto_path is not null then
    if left(p_foto_path, length('formularios/' || f.id::text || '/')) <> 'formularios/' || f.id::text || '/'
       or position('..' in p_foto_path) > 0
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'fotos-integrantes' and o.name = p_foto_path
       ) then
      return jsonb_build_object('ok', false, 'motivo', 'foto_invalida');
    end if;
  end if;

  update public.formularios_cadastro set
    nome = v_nome,
    whatsapp = v_whats,
    instagram = v_insta,
    endereco = v_end,
    data_aniversario = p_data_aniversario,
    foto_path = p_foto_path,
    participa_celula = p_participa_celula,
    celula_nome = v_cel,
    trajetoria = v_traj,
    serve_ministerio = p_serve_ministerio,
    ministerio_nome = v_min,
    status = 'pendente',
    enviado_em = now()
  where id = f.id;

  insert into public.formularios_cadastro_instrumentos (formulario_id, instrumento_id)
  select f.id, x from unnest(v_ids) as x;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.formulario_publico_enviar(text, text, text, text, text, date, text, text[], boolean, text, text[], boolean, text) from public;
grant execute on function public.formulario_publico_enviar(text, text, text, text, text, date, text, text[], boolean, text, text[], boolean, text) to anon, authenticated;
