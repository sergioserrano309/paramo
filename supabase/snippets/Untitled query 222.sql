-- Decisión: la tabla observaciones de main exige prospecto (ficha del
-- drawer, on delete cascade). Supervisión y Dashboard también dejan notas de
-- gestión general, sin prospecto. Aflojar el NOT NULL alcanza: no se recrea
-- la tabla ni se cambia el ON DELETE cascade.
--
-- Alternativa descartada: dejar el NOT NULL y rechazar esas notas. El módulo
-- de observaciones ya las envía con prospecto_id null.

begin;

alter table public.observaciones
  alter column prospecto_id drop not null;

comment on column public.observaciones.prospecto_id is
  'Prospecto al que se refiere. Null = observación de gestión general (Dashboard / Supervisión). Si tiene prospecto, se borra en cascada con él.';

commit;
