-- ============================================================================
-- Color heredado: una carpeta de builds puede tener el suyo
-- ----------------------------------------------------------------------------
-- Hasta acá el color vivía solo en la build. Eso obliga a pintar una por una
-- las veinte builds de "Tanques" para que se reconozcan como grupo, y a
-- repetir el trabajo cada vez que se agrega una.
--
-- Con esta columna el color puede vivir en la carpeta, y cada build lo hereda
-- salvo que tenga uno propio. La prioridad la resuelve la aplicación
-- (`colorEfectivo` en src/lib/builds-shared.ts): color de la build, si no el de
-- la subcarpeta, si no el de la carpeta de más arriba que tenga uno.
--
-- Es aditiva: agrega una columna que admite nulos y no toca ninguna fila
-- existente. Todas las carpetas quedan sin color, que es como se comportan hoy.
-- ============================================================================

alter table build_folders
  add column if not exists color text
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
