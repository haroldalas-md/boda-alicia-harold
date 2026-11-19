-- 005: quién paga cada proveedor
alter table public.proveedores
  add column if not exists responsable text not null default 'Ambos' check (responsable in ('Harold', 'Alicia', 'Ambos'));
update public.proveedores set responsable = 'Harold' where concepto = 'Alianzas de matrimonio';
