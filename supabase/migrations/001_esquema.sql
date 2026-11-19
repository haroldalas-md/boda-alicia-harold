-- Boda Alicia & Harold — esquema principal
-- Solo los correos registrados en "miembros" pueden ver o modificar datos.

create extension if not exists pgcrypto;

-- ---------- Miembros (lista de acceso) ----------
create table public.miembros (
  email  text primary key,
  nombre text not null check (nombre in ('Alicia', 'Harold'))
);

create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Bloquea registros de correos que no estén en la lista
create or replace function public.bloquear_no_miembros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.miembros m where lower(m.email) = lower(new.email)) then
    raise exception 'Este correo no tiene acceso a la app de la boda';
  end if;
  return new;
end;
$$;

create trigger solo_miembros_pueden_registrarse
  before insert on auth.users
  for each row execute function public.bloquear_no_miembros();

-- ---------- Categorías + presupuesto ----------
create table public.categorias (
  id          serial primary key,
  nombre      text not null unique,
  emoji       text not null default '✨',
  presupuesto numeric(10,2) not null default 0,
  orden       int not null default 0
);

-- ---------- Ideas (tablero tipo Pinterest) ----------
create table public.ideas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  imagen_path   text,            -- archivo en Storage (bucket "boda")
  imagen_url    text,            -- imagen externa o estática
  enlace        text,            -- link original (Pinterest, Instagram…)
  categoria_id  int references public.categorias(id) on delete set null,
  estado        text not null default 'por_evaluar'
                check (estado in ('por_evaluar', 'la_queremos', 'descartada')),
  gusta_alicia  boolean not null default false,
  gusta_harold  boolean not null default false,
  notas         text,
  creada_por    text,
  created_at    timestamptz not null default now()
);

-- ---------- Tareas ----------
create table public.tareas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  notas         text,
  responsable   text not null default 'Juntos'
                check (responsable in ('Alicia', 'Harold', 'Juntos')),
  tipo          text not null default 'hacer'
                check (tipo in ('hacer', 'diy', 'reservar', 'comprar')),
  categoria_id  int references public.categorias(id) on delete set null,
  fecha_limite  date,
  hecha         boolean not null default false,
  hecha_en      date,
  idea_id       uuid references public.ideas(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- Proveedores y cotizaciones ----------
create table public.proveedores (
  id            uuid primary key default gen_random_uuid(),
  concepto      text not null,          -- ej. "Banquete"
  nombre        text,                   -- ej. "Patys"
  contacto      text,
  categoria_id  int references public.categorias(id) on delete set null,
  costo_total   numeric(10,2) not null default 0,
  fecha_limite  date,
  estado        text not null default 'contratado'
                check (estado in ('cotizando', 'contratado', 'descartado')),
  documento_path text,
  notas         text,
  created_at    timestamptz not null default now()
);

-- ---------- Pagos a proveedores ----------
create table public.pagos (
  id            uuid primary key default gen_random_uuid(),
  proveedor_id  uuid not null references public.proveedores(id) on delete cascade,
  monto         numeric(10,2) not null check (monto > 0),
  fecha         date not null default current_date,
  origen        text not null check (origen in ('Harold', 'Alicia', 'Ahorro')),
  nota          text,
  recibo_path   text,
  created_at    timestamptz not null default now()
);

-- ---------- Cuenta de ahorro ----------
create table public.ahorro_movimientos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('abono', 'retiro')),
  monto       numeric(10,2) not null check (monto > 0),
  fecha       date not null default current_date,
  persona     text not null default 'Juntos' check (persona in ('Harold', 'Alicia', 'Juntos')),
  nota        text,
  created_at  timestamptz not null default now()
);

-- ---------- Invitados ----------
create table public.invitados (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  lado               text check (lado in ('Alicia', 'Harold', 'Ambos')),
  importancia        text check (importancia in ('Imprescindible', 'Prescindible', 'Opcional')),
  adultos            int not null default 1 check (adultos >= 0),
  ninos              int not null default 0 check (ninos >= 0),
  rsvp               text not null default 'Pendiente' check (rsvp in ('Pendiente', 'Confirmado', 'No asiste')),
  restriccion        text,
  mesa               text,
  invitacion_enviada boolean not null default false,
  notas              text,
  token              uuid not null default gen_random_uuid() unique,  -- para el RSVP público (fase 2)
  created_at         timestamptz not null default now()
);

-- ---------- Seguridad: RLS ----------
alter table public.miembros           enable row level security;
alter table public.categorias         enable row level security;
alter table public.ideas              enable row level security;
alter table public.tareas             enable row level security;
alter table public.proveedores        enable row level security;
alter table public.pagos              enable row level security;
alter table public.ahorro_movimientos enable row level security;
alter table public.invitados          enable row level security;

create policy "miembros leen miembros" on public.miembros
  for select to authenticated using ((select public.es_miembro()));

do $$
declare t text;
begin
  foreach t in array array['categorias','ideas','tareas','proveedores','pagos','ahorro_movimientos','invitados'] loop
    execute format(
      'create policy "solo miembros" on public.%I for all to authenticated
         using ((select public.es_miembro())) with check ((select public.es_miembro()))', t);
  end loop;
end $$;

-- Índices para llaves foráneas
create index on public.ideas (categoria_id);
create index on public.tareas (categoria_id);
create index on public.tareas (idea_id);
create index on public.proveedores (categoria_id);
create index on public.pagos (proveedor_id);

-- ---------- Storage (fotos de ideas, recibos, cotizaciones) ----------
insert into storage.buckets (id, name, public)
values ('boda', 'boda', false)
on conflict (id) do nothing;

create policy "miembros leen archivos" on storage.objects
  for select to authenticated using (bucket_id = 'boda' and (select public.es_miembro()));
create policy "miembros suben archivos" on storage.objects
  for insert to authenticated with check (bucket_id = 'boda' and (select public.es_miembro()));
create policy "miembros cambian archivos" on storage.objects
  for update to authenticated using (bucket_id = 'boda' and (select public.es_miembro()));
create policy "miembros borran archivos" on storage.objects
  for delete to authenticated using (bucket_id = 'boda' and (select public.es_miembro()));

-- ---------- Tiempo real (los cambios de uno aparecen en el teléfono del otro) ----------
alter publication supabase_realtime add table
  public.categorias, public.ideas, public.tareas, public.proveedores,
  public.pagos, public.ahorro_movimientos, public.invitados;

-- 002: permisos de funciones
revoke execute on function public.bloquear_no_miembros() from public, anon, authenticated;
revoke execute on function public.es_miembro() from public, anon;
grant execute on function public.es_miembro() to authenticated;

-- 003: ajustes (foto de portada, etc.)
create table public.ajustes (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);
alter table public.ajustes enable row level security;
create policy "solo miembros" on public.ajustes for all to authenticated
  using ((select public.es_miembro())) with check ((select public.es_miembro()));
