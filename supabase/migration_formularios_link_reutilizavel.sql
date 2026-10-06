-- Execute este arquivo no SQL Editor do Supabase (depois de migration_formularios_trajetoria.sql).
-- Pode ser executado mais de uma vez sem problema. Não apaga nenhum dado.
-- Depois dele, NÃO rode de novo migration_formularios_cadastro.sql nem
-- migration_formularios_trajetoria.sql (elas recriariam versões antigas da função de envio).
--
-- Links de formulário REUTILIZÁVEIS: um mesmo link pode ser enviado para várias
-- pessoas (ex.: grupo do WhatsApp). O link continua aberto e cada envio cria um
-- cadastro novo na lista. Links antigos (sem esta marca) continuam de uso único.

alter table public.formularios_cadastro
  add column if not exists link_multiplo boolean not null default false,
  add column if not exists link_origem_id uuid references public.formularios_cadastro(id) on delete set null;

create index if not exists formularios_cadastro_link_origem_idx
  on public.formularios_cadastro (link_origem_id);

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
  p_ministerio_nome text default null,
  p_celula_lider text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f public.formularios_cadastro%rowtype;
  v_nome text;
  v_whats text;
  v_insta text;
  v_end text;
  v_ids text[];
  v_cel text;
  v_lider text;
  v_min text;
  v_traj text[];
  v_novo uuid;
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

  v_lider := case when p_participa_celula is true
                  then nullif(btrim(regexp_replace(coalesce(p_celula_lider, ''), '\s+', ' ', 'g')), '')
                  else null end;
  if v_lider is not null and char_length(v_lider) > 100 then
    return jsonb_build_object('ok', false, 'motivo', 'celula_lider_invalido');
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

  if f.link_multiplo then
    -- Link reutilizável: o link continua aberto e cada envio vira um cadastro novo.
    -- Limite de 200 envios por link, para evitar abuso se o link vazar.
    if (select count(*) from public.formularios_cadastro where link_origem_id = f.id) >= 200 then
      return jsonb_build_object('ok', false, 'motivo', 'limite_atingido');
    end if;

    v_novo := gen_random_uuid();
    insert into public.formularios_cadastro (
      id, created_by, origem, status, enviado_em, link_origem_id,
      nome, whatsapp, instagram, endereco, data_aniversario, foto_path,
      participa_celula, celula_nome, celula_lider, trajetoria, serve_ministerio, ministerio_nome
    ) values (
      v_novo, f.created_by, 'link', 'pendente', now(), f.id,
      v_nome, v_whats, v_insta, v_end, p_data_aniversario, p_foto_path,
      p_participa_celula, v_cel, v_lider, v_traj, p_serve_ministerio, v_min
    );

    insert into public.formularios_cadastro_instrumentos (formulario_id, instrumento_id)
    select v_novo, x from unnest(v_ids) as x;
  else
    update public.formularios_cadastro set
      nome = v_nome,
      whatsapp = v_whats,
      instagram = v_insta,
      endereco = v_end,
      data_aniversario = p_data_aniversario,
      foto_path = p_foto_path,
      participa_celula = p_participa_celula,
      celula_nome = v_cel,
      celula_lider = v_lider,
      trajetoria = v_traj,
      serve_ministerio = p_serve_ministerio,
      ministerio_nome = v_min,
      status = 'pendente',
      enviado_em = now()
    where id = f.id;

    insert into public.formularios_cadastro_instrumentos (formulario_id, instrumento_id)
    select f.id, x from unnest(v_ids) as x;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.formulario_publico_enviar(text, text, text, text, text, date, text, text[], boolean, text, text[], boolean, text, text) from public;
grant execute on function public.formulario_publico_enviar(text, text, text, text, text, date, text, text[], boolean, text, text[], boolean, text, text) to anon, authenticated;

-- Com link reutilizável, várias pessoas enviam fotos para a MESMA pasta. Para que
-- ninguém consiga listar as fotos de quem enviou antes, a leitura pelo link passa a
-- valer só para arquivos criados nos últimos 2 minutos (o Storage só precisa "ver" o
-- arquivo no instante do próprio upload). As fotos continuam aparecendo normalmente
-- no app, porque o bucket é público e a equipe lê pela policy "equipe le".
drop policy if exists "fotos-integrantes link publico le propria pasta" on storage.objects;
create policy "fotos-integrantes link publico le propria pasta" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'fotos-integrantes'
    and (storage.foldername(name))[1] = 'formularios'
    and public.formulario_aceita_upload((storage.foldername(name))[2])
    and created_at > now() - interval '2 minutes'
  );
