-- ============================================================================
-- El color heredado también llega a la vista pública
-- ----------------------------------------------------------------------------
-- Desde la migración 0004 una carpeta de builds puede tener color, y una build
-- sin color propio hereda el de su carpeta. La aplicación ya resuelve esa
-- prioridad (`colorEfectivo`), pero la vista pública no pasa por ahí: se arma
-- entera dentro de `get_shared_composition`, que devolvía el color propio de la
-- build y nada más.
--
-- El resultado era que la misma build se veía pintada para quien organiza y
-- gris para el jugador que abre el link, que es justamente a quien el color
-- tiene que servirle.
--
-- Esta migración no borra ni modifica ningún dato: reemplaza la definición de
-- una función y agrega otra.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Sube por la cadena de carpetas y devuelve el primer color que encuentra.
--
-- No se le da permiso de ejecución a nadie a propósito. La llama
-- `get_shared_composition`, que es `security definer` y por lo tanto corre como
-- su dueño; concederla a `anon` dejaría consultar el color de cualquier carpeta
-- teniendo su identificador, y eso no lo necesita nadie.
-- ----------------------------------------------------------------------------
create or replace function color_heredado_de_carpeta(p_folder uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with recursive cadena as (
    select f.id, f.parent_id, f.color, 1 as nivel
      from build_folders f
     where f.id = p_folder

    union all

    -- El tope de 50 no es decorativo: si un dato inconsistente dejara un ciclo
    -- de carpetas, sin él la consulta no terminaría nunca y se llevaría puesta
    -- la vista pública entera.
    select f.id, f.parent_id, f.color, c.nivel + 1
      from build_folders f
      join cadena c on f.id = c.parent_id
     where c.nivel < 50
  )
  select color
    from cadena
   where color is not null
   order by nivel
   limit 1;
$$;

-- ----------------------------------------------------------------------------
-- La función de siempre. Lo único que cambia es el color de la build.
-- ----------------------------------------------------------------------------
create or replace function get_shared_composition(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', c.name,
    'description', c.description,
    'event_at', c.event_at,
    'event_tz', c.event_tz,
    'is_archived', c.is_archived,
    'share_formats', c.share_formats,
    'groups', coalesce((
      select jsonb_agg(g order by g.position)
      from (
        select
          cg.position,
          cg.name,
          cg.guild_name,
          coalesce((
            select jsonb_agg(s order by s.position)
            from (
              select
                cs.position,
                cs.player_name,
                cs.is_leader,
                cs.notes,
                case when r.id is null then null else jsonb_build_object(
                  'name', r.name, 'icon', r.icon, 'color', r.color
                ) end as role,
                case when b.id is null then null else jsonb_build_object(
                  'name', b.name,
                  -- Acá está el cambio: el propio, y si no tiene, el heredado.
                  'color', coalesce(b.color, color_heredado_de_carpeta(b.folder_id)),
                  'items', b.items,
                  'notes', b.notes
                ) end as build
              from comp_slots cs
              left join roles  r on r.id = cs.role_id
              left join builds b on b.id = cs.build_id
              where cs.group_id = cg.id
            ) s
          ), '[]'::jsonb) as slots
        from comp_groups cg
        where cg.composition_id = c.id
      ) g
    ), '[]'::jsonb)
  )
  from compositions c
  where c.share_slug = p_slug
    -- 'private' queda afuera aunque alguien adivine el slug.
    and c.visibility in ('public', 'unlisted')
  limit 1;
$$;

grant execute on function get_shared_composition(text) to anon, authenticated;
