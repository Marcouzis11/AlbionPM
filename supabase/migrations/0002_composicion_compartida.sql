-- ============================================================================
-- Lectura pública de una composición compartida
--
-- La vista pública no tiene sesión, así que no puede pasar por las políticas
-- RLS normales, que filtran por dueño. En vez de abrir un SELECT anónimo sobre
-- las tablas —lo que dejaría expuesto todo lo demás— se expone UNA función que
-- recibe el slug y devuelve la composición entera ya armada.
--
-- Así el acceso sin sesión tiene exactamente una puerta, y esa puerta se puede
-- auditar leyendo un solo archivo.
--
-- Devuelve todo de una: grupos, personas, rol y build con su equipo completo.
-- La página se abre desde un celular con mala señal cinco minutos antes de una
-- CTA; no puede permitirse tres viajes al servidor.
-- ============================================================================

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
                  'name', b.name, 'color', b.color, 'items', b.items, 'notes', b.notes
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

-- Cualquiera puede llamarla: es justamente el punto. Lo que la protege es que
-- solo devuelve composiciones marcadas como compartidas, y solo por slug.
grant execute on function get_shared_composition(text) to anon, authenticated;

-- Buscar por slug es lo que hace esta función en cada visita.
create index if not exists compositions_share_slug_idx
  on compositions (share_slug)
  where share_slug is not null;
