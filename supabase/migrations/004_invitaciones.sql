-- 004: Invitaciones digitales con confirmación (RSVP) por link personal

alter table public.invitados
  add column if not exists telefono      text,
  add column if not exists ola           int not null default 1 check (ola between 1 and 3),
  add column if not exists enviada_en    timestamptz,
  add column if not exists vista_en      timestamptz,
  add column if not exists respondida_en timestamptz,
  add column if not exists confirmados   int not null default 0 check (confirmados >= 0),
  add column if not exists asistentes    text[] not null default '{}',
  add column if not exists mensaje       text;

-- Ola inicial según importancia
update public.invitados set ola = case importancia
  when 'Imprescindible' then 1 when 'Prescindible' then 2 when 'Opcional' then 3 else 1 end;

-- Los que ya estaban marcados como confirmados cuentan con todos sus lugares
update public.invitados set confirmados = adultos + ninos where rsvp = 'Confirmado';

-- Ajustes por defecto de la invitación (editables desde la app)
insert into public.ajustes (clave, valor) values
  ('inv_formato', 'Por definir'),
  ('inv_hora', ''),
  ('inv_itinerario', ''),
  ('inv_vestimenta', ''),
  ('inv_fecha_limite', '2027-03-24'),
  ('inv_capacidad', '100'),
  ('inv_lugar', 'Casa Ávila, El Boquerón'),
  ('inv_maps_url', ''),
  ('inv_waze_url', ''),
  ('inv_mensaje_whatsapp', E'Hola {nombre} 💙\n\nCon mucha alegría queremos invitarte a nuestra boda el 24 de abril de 2027. Reservamos {cupos} para ustedes.\n\nAquí está tu invitación y puedes confirmar tu asistencia:\n{link}\n\nCon cariño,\nAlicia & Harold')
on conflict (clave) do nothing;

-- ---------- Funciones públicas (sin iniciar sesión) ----------
-- Solo devuelven o cambian el grupo dueño del link (token). Nunca listan otros invitados.

create or replace function public.invitacion_obtener(p_token uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invitados;
  cfg json;
begin
  select * into v from public.invitados where token = p_token;
  if not found then return null; end if;

  update public.invitados set vista_en = now() where id = v.id and vista_en is null;

  select coalesce(json_object_agg(clave, valor), '{}'::json) into cfg
  from public.ajustes where clave like 'inv\_%' and clave <> 'inv_mensaje_whatsapp';

  return json_build_object(
    'nombre', v.nombre,
    'cupos', v.adultos + v.ninos,
    'rsvp', v.rsvp,
    'confirmados', v.confirmados,
    'asistentes', v.asistentes,
    'restriccion', v.restriccion,
    'mensaje', v.mensaje,
    'respondida_en', v.respondida_en,
    'config', cfg
  );
end;
$$;

create or replace function public.invitacion_responder(
  p_token uuid,
  p_asiste boolean,
  p_cantidad int,
  p_asistentes text[],
  p_restriccion text,
  p_mensaje text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.invitados;
  limite date;
  cupos int;
begin
  select * into v from public.invitados where token = p_token for update;
  if not found then raise exception 'Invitación no encontrada'; end if;

  select nullif(valor, '')::date into limite from public.ajustes where clave = 'inv_fecha_limite';
  if limite is not null and (now() at time zone 'America/El_Salvador')::date > limite then
    raise exception 'La fecha para confirmar ya pasó';
  end if;

  cupos := v.adultos + v.ninos;
  if p_asiste and (p_cantidad is null or p_cantidad < 1 or p_cantidad > cupos) then
    raise exception 'Cantidad de personas no válida';
  end if;

  update public.invitados set
    rsvp          = case when p_asiste then 'Confirmado' else 'No asiste' end,
    confirmados   = case when p_asiste then p_cantidad else 0 end,
    asistentes    = case when p_asiste then coalesce(
                      (select array_agg(left(trim(x), 80)) from unnest(p_asistentes) x where trim(x) <> ''),
                      '{}') else '{}' end,
    restriccion   = left(nullif(trim(coalesce(p_restriccion, '')), ''), 300),
    mensaje       = left(nullif(trim(coalesce(p_mensaje, '')), ''), 1000),
    respondida_en = now(),
    vista_en      = coalesce(vista_en, now())
  where id = v.id;

  return public.invitacion_obtener(p_token);
end;
$$;

revoke execute on function public.invitacion_obtener(uuid) from public;
revoke execute on function public.invitacion_responder(uuid, boolean, int, text[], text, text) from public;
grant execute on function public.invitacion_obtener(uuid) to anon, authenticated;
grant execute on function public.invitacion_responder(uuid, boolean, int, text[], text, text) to anon, authenticated;

alter publication supabase_realtime add table public.ajustes;
