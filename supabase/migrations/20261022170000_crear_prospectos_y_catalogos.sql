-- Decisión: normalizar catálogos (canales, fuentes, tipos_cliente, etapas_funnel)
-- como tablas propias con FK desde prospectos, en lugar de texto libre o solo CHECK
-- en la app. Así se evita inconsistencia ortográfica, se reutilizan en funnel/
-- cotizaciones/ventas y el seed versiona los valores del as-is sin meter INSERT
-- en migraciones.
--
-- Contacto vive en columnas de prospectos (un contacto principal, como el as-is).
-- Alternativa descartada ahora: tabla contactos 1:N — conviene cuando el negocio
-- pida varios contactos por empresa (documentado en docs/app/04-prospectos.md).
--
-- Sin UNIQUE en empresa: decisión de producto (duplicados permitidos).
--
-- bitacora: solo esquema, listo para Supervisión. No se escribe desde la API de
-- prospectos en este hito. Campos alineados al log() del as-is (ts, uid, rol, a, d, ref).

begin;

-- ---------------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------------

create table if not exists public.canales (
  codigo text primary key,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  constraint canales_nombre_key unique (nombre)
);

comment on table public.canales is
  'Catálogo de canales comerciales (as-is CANALES).';
comment on column public.canales.codigo is
  'Clave estable usada en FKs y API (snake_case).';
comment on column public.canales.nombre is
  'Etiqueta visible en formularios y listados.';

create table if not exists public.fuentes (
  codigo text primary key,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  constraint fuentes_nombre_key unique (nombre)
);

comment on table public.fuentes is
  'Catálogo de fuentes de origen del prospecto (as-is FUENTES).';

create table if not exists public.tipos_cliente (
  codigo text primary key,
  nombre text not null,
  descuento_pct_default numeric(5, 2) not null default 0
    check (descuento_pct_default >= 0 and descuento_pct_default <= 100),
  orden integer not null default 0,
  activo boolean not null default true,
  constraint tipos_cliente_nombre_key unique (nombre)
);

comment on table public.tipos_cliente is
  'Tipos de cliente para listas de precios (as-is TIPOS_CLIENTE).';
comment on column public.tipos_cliente.descuento_pct_default is
  'Porcentaje de referencia sobre PVP; la config operativa puede vivir aparte.';

create table if not exists public.etapas_funnel (
  codigo text primary key,
  nombre text not null,
  probabilidad integer not null default 0
    check (probabilidad >= 0 and probabilidad <= 100),
  orden integer not null default 0,
  en_pipeline boolean not null default true,
  activo boolean not null default true,
  constraint etapas_funnel_nombre_key unique (nombre)
);

comment on table public.etapas_funnel is
  'Etapas del funnel comercial (as-is STAGES).';
comment on column public.etapas_funnel.en_pipeline is
  'true = etapa de gestión activa (as-is ACTIVE); false = ganado/perdido.';
comment on column public.etapas_funnel.probabilidad is
  'Ponderación del pipeline (as-is STAGES[].p).';

alter table public.canales enable row level security;
alter table public.fuentes enable row level security;
alter table public.tipos_cliente enable row level security;
alter table public.etapas_funnel enable row level security;

revoke all on public.canales from anon, authenticated;
revoke all on public.fuentes from anon, authenticated;
revoke all on public.tipos_cliente from anon, authenticated;
revoke all on public.etapas_funnel from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prospectos
-- ---------------------------------------------------------------------------

create table if not exists public.prospectos (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  nit text not null default '',
  contacto text not null default '',
  cargo text not null default '',
  telefono text not null default '',
  email text not null default '',
  ciudad text not null default '',
  canal_codigo text references public.canales (codigo) on delete set null,
  tipo_cliente_codigo text references public.tipos_cliente (codigo) on delete set null,
  fuente_codigo text references public.fuentes (codigo) on delete set null,
  etapa_codigo text not null default 'prospecto'
    references public.etapas_funnel (codigo) on delete restrict,
  valor_mensual_estimado numeric(14, 0) not null default 0
    check (valor_mensual_estimado >= 0),
  calificacion smallint not null default 0
    check (calificacion >= 0 and calificacion <= 3),
  notas text not null default '',
  activo boolean not null default true,
  motivo_perdida text not null default '',
  motivo_inactivo text not null default '',
  inactivo_en date,
  etapa_desde date not null default (timezone('America/Bogota', now()))::date,
  ultimo_contacto date,
  ganado_en date,
  responsable_id uuid not null
    references public.profiles (id) on delete restrict,
  creado_por uuid references public.profiles (id) on delete set null,
  actualizado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint prospectos_empresa_no_vacia check (length(trim(empresa)) > 0)
);

comment on table public.prospectos is
  'Cuentas / prospectos del CRM. Contacto principal en columnas (no tabla contactos aún).';
comment on column public.prospectos.empresa is
  'Nombre de la empresa. Sin UNIQUE: se permiten homónimos.';
comment on column public.prospectos.contacto is
  'Nombre del contacto principal. Futuro: tabla contactos 1:N si hay varios.';
comment on column public.prospectos.cargo is
  'Cargo del contacto principal.';
comment on column public.prospectos.telefono is
  'Teléfono del contacto principal.';
comment on column public.prospectos.email is
  'Correo del contacto principal.';
comment on column public.prospectos.valor_mensual_estimado is
  'Venta mensual estimada en COP (as-is valor).';
comment on column public.prospectos.calificacion is
  '0=sin calificar … 3=potencial alto (as-is calif).';
comment on column public.prospectos.responsable_id is
  'Usuario de profiles responsable de la gestión.';
comment on column public.prospectos.activo is
  'false = inactivo (fuera del funnel); no es borrado.';

-- Listado filtrado por etapa / canal / responsable / activos.
create index if not exists prospectos_etapa_codigo_idx
  on public.prospectos (etapa_codigo);
create index if not exists prospectos_canal_codigo_idx
  on public.prospectos (canal_codigo)
  where canal_codigo is not null;
create index if not exists prospectos_responsable_id_idx
  on public.prospectos (responsable_id);
create index if not exists prospectos_activo_idx
  on public.prospectos (activo);
-- Búsqueda por nombre de empresa en listados.
create index if not exists prospectos_empresa_lower_idx
  on public.prospectos (lower(empresa));

alter table public.prospectos enable row level security;
revoke all on public.prospectos from anon, authenticated;

create or replace function public.set_prospectos_actualizado_en()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

revoke all on function public.set_prospectos_actualizado_en()
  from public, anon, authenticated;

drop trigger if exists prospectos_set_actualizado_en on public.prospectos;
create trigger prospectos_set_actualizado_en
  before update on public.prospectos
  for each row
  execute function public.set_prospectos_actualizado_en();

-- ---------------------------------------------------------------------------
-- Bitácora (esquema listo; escritura en hito de Supervisión)
-- ---------------------------------------------------------------------------

create table if not exists public.bitacora (
  id uuid primary key default gen_random_uuid(),
  ocurrido_en timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  rol text not null,
  accion text not null,
  detalle text not null default '',
  ref_tabla text,
  ref_id uuid,
  constraint bitacora_rol_check check (rol in ('comercial', 'supervisor')),
  constraint bitacora_accion_no_vacia check (length(trim(accion)) > 0),
  constraint bitacora_detalle_len check (char_length(detalle) <= 400)
);

comment on table public.bitacora is
  'Auditoría operativa (as-is bitacora). Solo esquema en este hito; sin writes aún.';
comment on column public.bitacora.ocurrido_en is
  'Timestamp del evento (as-is ts).';
comment on column public.bitacora.actor_id is
  'Usuario que ejecutó la acción (as-is uid); null si ya no existe el perfil.';
comment on column public.bitacora.rol is
  'Rol del actor al momento del evento.';
comment on column public.bitacora.accion is
  'Etiqueta corta de la acción (as-is a), ej. Prospecto creado.';
comment on column public.bitacora.detalle is
  'Detalle legible acotado a 400 caracteres (as-is d).';
comment on column public.bitacora.ref_tabla is
  'Tabla de dominio referenciada (as-is ref.col), ej. prospectos.';
comment on column public.bitacora.ref_id is
  'Id opaco del registro referenciado (as-is ref.id).';

-- Consulta típica: bitácora reciente en Supervisión.
create index if not exists bitacora_ocurrido_en_idx
  on public.bitacora (ocurrido_en desc);
create index if not exists bitacora_actor_id_idx
  on public.bitacora (actor_id)
  where actor_id is not null;
create index if not exists bitacora_ref_idx
  on public.bitacora (ref_tabla, ref_id)
  where ref_tabla is not null and ref_id is not null;

alter table public.bitacora enable row level security;
revoke all on public.bitacora from anon, authenticated;

commit;
