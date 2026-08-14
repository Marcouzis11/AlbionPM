-- ============================================================================
-- Orden manual de las builds dentro de su carpeta
-- ----------------------------------------------------------------------------
-- Hasta acá las builds se listaban por nombre. Alfabético es un orden que la
-- computadora entiende y la persona no: dentro de "Tanques / ZvZ" el orden útil
-- es el de la comp (primero el principal, después los de relleno), y ese no lo
-- puede adivinar nadie. Con esta columna se arrastran y quedan como uno quiera.
--
-- Es aditiva: agrega una columna con valor por omisión y no toca ninguna otra.
-- El UPDATE del final solo escribe la columna nueva, que hasta este momento
-- vale 0 en todas las filas.
-- ============================================================================

alter table builds
  add column if not exists position int not null default 0;

-- El listado siempre pide "las de esta carpeta, en orden".
create index if not exists builds_folder_position_idx
  on builds (folder_id, position);

-- Reparto inicial: se respeta el orden en que fueron creadas dentro de cada
-- carpeta. Sin esto todas quedarían en 0 y el primer arrastre las mezclaría,
-- porque no habría ningún orden previo que conservar.
with orden as (
  select
    id,
    row_number() over (
      partition by folder_id
      order by created_at, id
    ) - 1 as n
  from builds
)
update builds
   set position = orden.n
  from orden
 where builds.id = orden.id
   and builds.position = 0;
