-- Decisión: la retroalimentación y la degustación ahora se registran desde la ficha del
-- prospecto, así que cada opinión queda asociada a un prospecto y a un producto o a
-- «General» (comentario sobre los productos en conjunto). Se resuelve con dos cambios en
-- `producto_feedback`, sin tabla nueva:
--   · `prospecto_id` (columna nueva): a qué prospecto pertenece. Las opiniones anteriores
--     quedan en null y siguen visibles en el producto por su texto `cliente`.
--   · `producto_id` pasa a admitir null: null = «General».
-- Al borrar un prospecto la opinión se conserva (on delete set null): el valor para el
-- producto no debe perderse; el nombre del cliente queda en `cliente`.

begin;

alter table public.producto_feedback
  alter column producto_id drop not null;

alter table public.producto_feedback
  add column if not exists prospecto_id uuid
    references public.prospectos (id) on delete set null;

comment on column public.producto_feedback.producto_id is
  'Producto evaluado. null = comentario general (sobre los productos en conjunto).';
comment on column public.producto_feedback.prospecto_id is
  'Prospecto al que pertenece la opinión (ficha del prospecto). null en las anteriores a esta columna.';

-- Opiniones de un prospecto, más recientes primero (ficha del prospecto).
create index if not exists producto_feedback_prospecto_idx
  on public.producto_feedback (prospecto_id, fecha desc)
  where prospecto_id is not null;

commit;
