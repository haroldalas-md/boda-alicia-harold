# Nuestra Boda · Alicia & Harold

App web (instalable en iPhone) para planear la boda del 24 de abril de 2027:
**Ideas** tipo Pinterest, **Tareas**, **Dinero** (ahorro, pagos, presupuesto, cotizaciones) e **Invitados**.

- Frontend: React + Vite → Netlify
- Datos, login y archivos: Supabase (solo los correos en la tabla `miembros` pueden entrar)
- `supabase/functions/pin-preview`: trae la imagen de un link de Pinterest y la guarda

## Variables de entorno (Netlify → Site configuration → Environment variables)

```
VITE_SUPABASE_URL=https://qrqktdipgonfittvimye.supabase.co
VITE_SUPABASE_ANON_KEY=<clave publishable de Supabase>
```

## Desarrollo local

```
npm install
cp .env.example .env   # y llenar los valores
npm run dev
```

## Base de datos

El esquema está en `supabase/migrations/001_esquema.sql`. Para dar acceso a otro correo:

```sql
insert into public.miembros (email, nombre) values ('correo@ejemplo.com', 'Alicia');
```
