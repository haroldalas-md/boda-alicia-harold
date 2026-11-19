-- 006: Avisos (registro de actividad agrupado) y "pedir opinión" en ideas

alter table public.ideas
  add column if not exists opinion_de text check (opinion_de in ('Alicia', 'Harold'));

create table if not exists public.actividad (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,                 -- 'Alicia', 'Harold' o 'Invitado'
  tipo       text not null,                 -- tarea, idea, pago, ahorro, proveedor, presupuesto, invitado, ajustes
  verbo      text not null,
  items      text[] not null default '{}',  -- nombres de lo afectado (sin repetir)
  veces      int not null default 1,
  monto      numeric(10,2) not null default 0,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists actividad_reciente on public.actividad (updated_at desc);
create index if not exists actividad_agrupar on public.actividad (actor, tipo, verbo, updated_at desc);

create table if not exists public.actividad_vista (
  nombre      text primary key check (nombre in ('Alicia', 'Harold')),
  visto_hasta timestamptz not null default now()
);
insert into public.actividad_vista (nombre) values ('Alicia'), ('Harold') on conflict do nothing;

alter table public.actividad enable row level security;
alter table public.actividad_vista enable row level security;
create policy "solo miembros" on public.actividad for all to authenticated
  using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "solo miembros" on public.actividad_vista for all to authenticated
  using ((select public.es_miembro())) with check ((select public.es_miembro()));

-- Quién está haciendo el cambio
create or replace function public.actor_actual()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.nombre from public.miembros m
      where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'Invitado');
$$;

-- Registra un aviso; si la misma persona hizo lo mismo en los últimos 30 minutos, lo agrupa
create or replace function public.registrar_actividad(p_tipo text, p_verbo text, p_item text, p_monto numeric default 0, p_ref uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_actor text := public.actor_actual();
  v_id uuid;
begin
  select id into v_id from public.actividad
  where actor = v_actor and tipo = p_tipo and verbo = p_verbo
    and updated_at > now() - interval '30 minutes'
  order by updated_at desc limit 1
  for update;

  if v_id is not null then
    update public.actividad set
      items = case when p_item is null or p_item = any(items) then items else items || p_item end,
      veces = veces + 1,
      monto = monto + coalesce(p_monto, 0),
      ref_id = coalesce(p_ref, ref_id),
      updated_at = now()
    where id = v_id;
  else
    insert into public.actividad (actor, tipo, verbo, items, monto, ref_id)
    values (v_actor, p_tipo, p_verbo, case when p_item is null then '{}' else array[p_item] end, coalesce(p_monto, 0), p_ref);
  end if;
end;
$$;

-- ---------- Triggers por tabla ----------

create or replace function public.av_tareas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then perform public.registrar_actividad('tarea', 'agregó', new.titulo);
  elsif tg_op = 'DELETE' then perform public.registrar_actividad('tarea', 'borró', old.titulo);
  elsif new.hecha and not old.hecha then perform public.registrar_actividad('tarea', 'completó', new.titulo);
  elsif old.hecha and not new.hecha then perform public.registrar_actividad('tarea', 'reabrió', new.titulo);
  elsif new.fecha_limite is distinct from old.fecha_limite then perform public.registrar_actividad('tarea', 'cambió la fecha de', new.titulo);
  elsif (new.titulo, new.notas, new.responsable, new.tipo, new.categoria_id)
        is distinct from (old.titulo, old.notas, old.responsable, old.tipo, old.categoria_id) then
    perform public.registrar_actividad('tarea', 'editó', new.titulo);
  end if;
  return null;
end; $$;

create or replace function public.av_ideas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_quien text; v_gusta boolean;
begin
  if tg_op = 'INSERT' then
    if new.opinion_de is not null then perform public.registrar_actividad('idea', 'pide tu opinión sobre', new.titulo, 0, new.id);
    else perform public.registrar_actividad('idea', 'agregó', new.titulo, 0, new.id); end if;
  elsif tg_op = 'DELETE' then perform public.registrar_actividad('idea', 'borró', old.titulo);
  elsif old.opinion_de is not null and new.opinion_de is null then
    v_gusta := case when old.opinion_de = 'Alicia' then new.gusta_alicia else new.gusta_harold end;
    perform public.registrar_actividad('idea', 'opinó sobre', new.titulo || case when v_gusta then ' · ❤️ le gusta' else ' · 🤔 no le convence' end, 0, new.id);
  elsif old.opinion_de is null and new.opinion_de is not null then
    perform public.registrar_actividad('idea', 'pide tu opinión sobre', new.titulo, 0, new.id);
  elsif (new.gusta_alicia and not old.gusta_alicia) or (new.gusta_harold and not old.gusta_harold) then
    perform public.registrar_actividad('idea', 'le dio ❤️ a', new.titulo, 0, new.id);
  elsif new.estado is distinct from old.estado then
    perform public.registrar_actividad('idea', case new.estado when 'la_queremos' then 'aprobó' when 'descartada' then 'descartó' else 'regresó a evaluar' end, new.titulo, 0, new.id);
  elsif (new.titulo, new.notas, new.categoria_id, new.imagen_path, new.enlace)
        is distinct from (old.titulo, old.notas, old.categoria_id, old.imagen_path, old.enlace) then
    perform public.registrar_actividad('idea', 'editó', new.titulo, 0, new.id);
  end if;
  return null;
end; $$;

create or replace function public.av_pagos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_concepto text;
begin
  select concepto into v_concepto from public.proveedores where id = coalesce(new.proveedor_id, old.proveedor_id);
  if tg_op = 'INSERT' then perform public.registrar_actividad('pago', 'registró', coalesce(v_concepto, 'Proveedor'), new.monto);
  elsif tg_op = 'DELETE' then perform public.registrar_actividad('pago', 'borró', coalesce(v_concepto, 'Proveedor'), old.monto);
  end if;
  return null;
end; $$;

create or replace function public.av_ahorro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_actividad('ahorro', case when new.tipo = 'abono' then 'abonó' else 'retiró' end, nullif(new.nota, ''), new.monto);
  elsif tg_op = 'DELETE' then
    perform public.registrar_actividad('ahorro', 'borró un movimiento', nullif(old.nota, ''), old.monto);
  end if;
  return null;
end; $$;

create or replace function public.av_proveedores() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then perform public.registrar_actividad('proveedor', 'agregó', new.concepto);
  elsif tg_op = 'DELETE' then perform public.registrar_actividad('proveedor', 'borró', old.concepto);
  elsif (new.concepto, new.nombre, new.costo_total, new.fecha_limite, new.estado, new.responsable, new.categoria_id, new.notas, new.documento_path)
        is distinct from (old.concepto, old.nombre, old.costo_total, old.fecha_limite, old.estado, old.responsable, old.categoria_id, old.notas, old.documento_path) then
    perform public.registrar_actividad('proveedor', 'editó', new.concepto);
  end if;
  return null;
end; $$;

create or replace function public.av_categorias() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then perform public.registrar_actividad('presupuesto', 'editó', old.nombre);
  elsif tg_op = 'INSERT' or (new.nombre, new.emoji, new.presupuesto) is distinct from (old.nombre, old.emoji, old.presupuesto) then
    perform public.registrar_actividad('presupuesto', 'editó', new.nombre);
  end if;
  return null;
end; $$;

create or replace function public.av_invitados() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor text := public.actor_actual();
begin
  if tg_op = 'INSERT' then perform public.registrar_actividad('invitado', 'agregó', new.nombre);
  elsif tg_op = 'DELETE' then perform public.registrar_actividad('invitado', 'quitó', old.nombre);
  elsif v_actor = 'Invitado' then
    -- Respuestas desde la invitación (abrir el link no genera aviso)
    if new.respondida_en is distinct from old.respondida_en then
      if new.rsvp = 'Confirmado' then
        perform public.registrar_actividad('invitado', 'confirmó', new.nombre || ' (' || new.confirmados || ')');
      else
        perform public.registrar_actividad('invitado', 'no asistirá', new.nombre);
      end if;
    end if;
  elsif old.enviada_en is null and new.enviada_en is not null then
    perform public.registrar_actividad('invitado', 'envió la invitación a', new.nombre);
  elsif (new.nombre, new.lado, new.importancia, new.ola, new.adultos, new.ninos, new.rsvp, new.confirmados, new.telefono, new.mesa, new.notas, new.restriccion)
        is distinct from (old.nombre, old.lado, old.importancia, old.ola, old.adultos, old.ninos, old.rsvp, old.confirmados, old.telefono, old.mesa, old.notas, old.restriccion) then
    perform public.registrar_actividad('invitado', 'editó', new.nombre);
  end if;
  return null;
end; $$;

create or replace function public.av_ajustes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.clave like 'inv\_%' and (tg_op = 'INSERT' or new.valor is distinct from old.valor) then
    perform public.registrar_actividad('ajustes', 'cambió', 'los ajustes de la invitación');
  elsif new.clave = 'portada' and (tg_op = 'INSERT' or new.valor is distinct from old.valor) then
    perform public.registrar_actividad('ajustes', 'cambió', 'la foto de portada');
  end if;
  return null;
end; $$;

create trigger av_tareas after insert or update or delete on public.tareas for each row execute function public.av_tareas();
create trigger av_ideas after insert or update or delete on public.ideas for each row execute function public.av_ideas();
create trigger av_pagos after insert or delete on public.pagos for each row execute function public.av_pagos();
create trigger av_ahorro after insert or delete on public.ahorro_movimientos for each row execute function public.av_ahorro();
create trigger av_proveedores after insert or update or delete on public.proveedores for each row execute function public.av_proveedores();
create trigger av_categorias after insert or update or delete on public.categorias for each row execute function public.av_categorias();
create trigger av_invitados after insert or update or delete on public.invitados for each row execute function public.av_invitados();
create trigger av_ajustes after insert or update on public.ajustes for each row execute function public.av_ajustes();

-- Ninguna de estas funciones se llama directamente desde la app
revoke execute on function public.actor_actual() from public, anon, authenticated;
revoke execute on function public.registrar_actividad(text, text, text, numeric, uuid) from public, anon, authenticated;
revoke execute on function public.av_tareas(), public.av_ideas(), public.av_pagos(), public.av_ahorro(),
  public.av_proveedores(), public.av_categorias(), public.av_invitados(), public.av_ajustes() from public, anon, authenticated;

alter publication supabase_realtime add table public.actividad, public.actividad_vista;
