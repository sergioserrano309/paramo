-- Pendiente de validar al aplicar esta migración: la app de main escribe el
-- historial en prospectos.actividad (jsonb). Esta migración igual crea
-- prospecto_actividad. Hay que comprobar en Supabase si esa tabla recibe filas
-- o queda vacía, y si prospecto_productos y producto_feedback responden en
-- interés y retroalimentación. No se unificó el historial en este merge.
--
-- Decisión: tres tablas pequeñas que completan la ficha del prospecto y del producto.
-- Cada una es una relación real (muchas filas por prospecto o producto) que se consulta
-- agregada en SQL, por eso no caben como columna ni como jsonb (AGENTS.md §3.2):
--
--   prospecto_actividad  Historial del prospecto (llamadas, visitas, cambios de etapa,
--                        compromisos cumplidos). Alimenta «Historial» de la ficha y en
--                        Supervisión los KPI «Contactos con clientes» (empresas distintas
--                        y filas por período) y «Avances en el funnel». En el as-is era un
--                        arreglo dentro del documento del prospecto, imposible de sumar.
--   prospecto_productos  Productos de interés del prospecto (muchos a muchos). Permite
--                        contar «interesados» por producto.
--   producto_feedback    Retroalimentación y degustaciones por producto (calificación 1–5).
--
-- Borrado: al eliminar un prospecto o un producto se van sus filas (`on delete cascade`),
-- como el as-is (el borrado del prospecto arrastraba sus compromisos y su historial).
--
-- Sin INSERT de datos.

begin;

create table if not exists public.prospecto_actividad (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null references public.prospectos (id) on delete cascade,
  fecha date not null default (timezone('America/Bogota', now()))::date,
  tipo text not null,
  texto text not null default '',
  usuario_id uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint prospecto_actividad_tipo_check
    check (length(trim(tipo)) > 0 and char_length(tipo) <= 40),
  constraint prospecto_actividad_texto_len check (char_length(texto) <= 1000)
);

comment on table public.prospecto_actividad is
  'Historial del prospecto (as-is prospecto.actividad): contactos, cambios de etapa y de estado.';
comment on column public.prospecto_actividad.tipo is
  'Llamada, Visita, WhatsApp, Correo, Degustación, Reunión, Nota, Etapa (cambio de etapa), Estado (inactivar / reactivar) o el tipo del compromiso cumplido.';
comment on column public.prospecto_actividad.texto is
  'Qué pasó. Sin datos personales de terceros.';

-- Historial de un prospecto (ficha), del más reciente al más antiguo.
create index if not exists prospecto_actividad_prospecto_idx
  on public.prospecto_actividad (prospecto_id, creado_en desc);
-- KPI de Supervisión: actividad del período.
create index if not exists prospecto_actividad_fecha_idx
  on public.prospecto_actividad (fecha);

alter table public.prospecto_actividad enable row level security;
revoke all on public.prospecto_actividad from anon, authenticated;

create table if not exists public.prospecto_productos (
  prospecto_id uuid not null references public.prospectos (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  creado_por uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  primary key (prospecto_id, producto_id)
);

comment on table public.prospecto_productos is
  'Productos de interés de cada prospecto (as-is prospecto.productosInteres).';

-- «Interesados» de un producto (ficha del producto, Dashboard).
create index if not exists prospecto_productos_producto_idx
  on public.prospecto_productos (producto_id);

alter table public.prospecto_productos enable row level security;
revoke all on public.prospecto_productos from anon, authenticated;

create table if not exists public.producto_feedback (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  fecha date not null default (timezone('America/Bogota', now()))::date,
  tipo text not null,
  cliente text not null default '',
  calif smallint not null default 0,
  texto text not null default '',
  usuario_id uuid references public.profiles (id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint producto_feedback_tipo_check check (
    tipo in ('Degustación', 'Comentario de cliente', 'Pedido piloto', 'Prueba interna')
  ),
  constraint producto_feedback_calif_check check (calif >= 0 and calif <= 5),
  constraint producto_feedback_cliente_len check (char_length(cliente) <= 200),
  constraint producto_feedback_texto_len check (char_length(texto) <= 1000)
);

comment on table public.producto_feedback is
  'Retroalimentación y degustaciones de un producto (as-is producto.feedback).';
comment on column public.producto_feedback.calif is
  '0 = sin calificar; 1 a 5 estrellas.';
comment on column public.producto_feedback.cliente is
  'Empresa o prospecto, texto libre (as-is f.cliente).';

-- Opiniones de un producto, más recientes primero.
create index if not exists producto_feedback_producto_idx
  on public.producto_feedback (producto_id, fecha desc);

alter table public.producto_feedback enable row level security;
revoke all on public.producto_feedback from anon, authenticated;

commit;
