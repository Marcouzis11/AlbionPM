-- ============================================================================
-- AlbionPM — esquema inicial
--
-- Jerarquía: Juego → Contenido → Composición → Grupo (máx. 20) → Persona
-- Aparte: biblioteca de builds con carpetas anidadas, tags y colores.
--
-- Dos reglas que atraviesan todo el archivo:
--
--   1. RLS habilitado en TODAS las tablas, en la misma migración que las crea.
--      En Supabase, una tabla sin RLS es legible por cualquiera que tenga la
--      clave publicable, y esa clave está en el JavaScript del navegador.
--
--   2. ON DELETE RESTRICT donde la aplicación debe preguntar antes de borrar,
--      y CASCADE solo donde la cascada es evidentemente correcta. Si un
--      diálogo de confirmación tuviera un bug, la base rechaza la operación
--      en vez de destruir datos en silencio.
-- ============================================================================

-- ─── Tipos ──────────────────────────────────────────────────────────────────

create type theme_preference as enum ('dark', 'light', 'system');
create type locale_preference as enum ('es', 'en');
create type composition_visibility as enum ('private', 'unlisted', 'public');

-- ─── Utilidades ─────────────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── games ──────────────────────────────────────────────────────────────────
-- Datos de referencia. Hoy solo Albion Online, pero el selector de juego se
-- construye de verdad: agregarlo ahora es barato y retrofitearlo, carísimo.

create table games (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  icon       text,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

alter table games enable row level security;

-- Catálogo público: cualquiera lo lee, nadie lo escribe desde la aplicación.
create policy "games son legibles por todos"
  on games for select
  using (true);

-- ─── profiles ───────────────────────────────────────────────────────────────

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  -- Nombre del personaje en el juego. Opcional: sirve para autocompletarse
  -- en las composiciones, no para identificarse.
  albion_ign   text,
  theme        theme_preference  not null default 'dark',
  locale       locale_preference not null default 'es',
  -- Preferencias de interfaz: posición de la calculadora, último juego
  -- elegido, paneles abiertos. Nada de esto debe vivir en el navegador.
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "cada quien lee su perfil"
  on profiles for select using (auth.uid() = id);

create policy "cada quien edita su perfil"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create trigger profiles_touch
  before update on profiles
  for each row execute function touch_updated_at();

-- El perfil se crea solo al registrarse, con lo que haya dado Discord.
-- SECURITY DEFINER porque corre en el contexto de auth, no del usuario.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── contents ───────────────────────────────────────────────────────────────
-- Gankeo, Castillo, Avaloniana, PVE, Estática, Guerra, CTA… los crea cada
-- usuario para mantener su propio orden.

create table contents (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles on delete cascade,
  game_id    uuid not null references games on delete restrict,
  name       text not null,
  icon       text,
  color      text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contents_owner_game_idx on contents (owner_id, game_id, position);

alter table contents enable row level security;

create policy "contents propios" on contents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger contents_touch
  before update on contents
  for each row execute function touch_updated_at();

-- ─── roles ──────────────────────────────────────────────────────────────────
-- owner_id NULL identifica al catálogo del sistema, que se precarga más
-- abajo. Cada usuario puede además crear los suyos.

create table roles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references profiles on delete cascade,
  game_id    uuid not null references games on delete restrict,
  name       text not null,
  icon       text,
  color      text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create index roles_owner_idx on roles (owner_id, game_id, position);

alter table roles enable row level security;

create policy "roles del sistema y propios son legibles" on roles
  for select using (owner_id is null or auth.uid() = owner_id);

-- Ojo: `owner_id is not null` en el WITH CHECK impide que alguien inserte un
-- rol con owner_id NULL y se cuele en el catálogo del sistema.
create policy "roles propios se crean" on roles
  for insert with check (auth.uid() = owner_id and owner_id is not null);

create policy "roles propios se editan" on roles
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "roles propios se borran" on roles
  for delete using (auth.uid() = owner_id);

-- ─── build_folders ──────────────────────────────────────────────────────────
-- parent_id auto-referencial: subcarpetas con la profundidad que haga falta.
-- RESTRICT a propósito: borrar una carpeta con contenido tiene que pasar por
-- el diálogo que ofrece rescatar lo de adentro.

create table build_folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles on delete cascade,
  game_id    uuid not null references games on delete restrict,
  parent_id  uuid references build_folders on delete restrict,
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index build_folders_owner_idx on build_folders (owner_id, game_id, parent_id, position);

alter table build_folders enable row level security;

create policy "carpetas propias" on build_folders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger build_folders_touch
  before update on build_folders
  for each row execute function touch_updated_at();

-- ─── builds ─────────────────────────────────────────────────────────────────

create table builds (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles on delete cascade,
  game_id    uuid not null references games on delete restrict,
  folder_id  uuid references build_folders on delete restrict,
  name       text not null,
  role_id    uuid references roles on delete set null,
  -- El color vive en la build, no en el slot: es lo que hace que signifique
  -- algo. Donde sea que se use esta build, la fila se pinta igual.
  color      text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tags       text[] not null default '{}',
  -- Los nueve slots de equipo. Forma estable y conocida, validada con Zod
  -- antes de escribir. Ver docs/ARQUITECTURA.md.
  items      jsonb  not null default '{}'::jsonb,
  notes      text,
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index builds_owner_idx  on builds (owner_id, game_id);
create index builds_folder_idx on builds (folder_id);
create index builds_tags_idx   on builds using gin (tags);

alter table builds enable row level security;

create policy "builds propias" on builds
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger builds_touch
  before update on builds
  for each row execute function touch_updated_at();

-- ─── compositions ───────────────────────────────────────────────────────────

create table compositions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles on delete cascade,
  content_id  uuid not null references contents on delete restrict,
  name        text not null,
  -- Texto libre, sin estructura impuesta: "Alianza Garcia vs Alianza
  -- Guerreros". Es lo que hace reconocible una comp dentro de seis meses.
  description text,
  -- Fecha y hora tomadas de la máquina del usuario, editables.
  event_at    timestamptz not null default now(),
  -- Y su zona horaria de origen. Sin esto, una CTA a las 20:30 hora Argentina
  -- se lee como 01:30 desde España y alguien llega tarde.
  event_tz    text not null default 'America/Argentina/Buenos_Aires',
  -- Archivar congela la composición para que el historial no mienta sobre lo
  -- que se usó ese día.
  is_archived boolean not null default false,
  archived_at timestamptz,
  share_slug  text unique,
  visibility  composition_visibility not null default 'private',
  -- Qué formatos ofrece la vista pública: {"link":true,"pdf":true,"png":true}
  share_formats jsonb not null default '{"link": true, "pdf": true, "png": true}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index compositions_owner_idx   on compositions (owner_id, event_at desc);
create index compositions_content_idx on compositions (content_id, event_at desc);

alter table compositions enable row level security;

create policy "composiciones propias" on compositions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger compositions_touch
  before update on compositions
  for each row execute function touch_updated_at();

-- Una composición archivada no se edita ni se borra sin desarchivarla antes.
-- Va en la base y no solo en la interfaz: el candado protege el historial de
-- un borrado distraído, y una protección que solo vive en el front no es una
-- protección.
create or replace function guard_archived_composition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_archived then
      raise exception 'La composición está archivada. Desarchivala antes de borrarla.';
    end if;
    return old;
  end if;

  -- Se permite el update que justamente desarchiva.
  if old.is_archived and new.is_archived then
    raise exception 'La composición está archivada. Desarchivala antes de editarla.';
  end if;

  return new;
end;
$$;

create trigger compositions_guard_archived
  before update or delete on compositions
  for each row execute function guard_archived_composition();

-- ─── comp_groups ────────────────────────────────────────────────────────────
-- CASCADE es correcto acá: los grupos de una composición que se borra no
-- tienen sentido por separado.

create table comp_groups (
  id             uuid primary key default gen_random_uuid(),
  composition_id uuid not null references compositions on delete cascade,
  position       int  not null default 0,
  name           text,
  -- Solo se usa en la plantilla multigremio, para el líder que coordina
  -- varios gremios en una guerra.
  guild_name     text,
  created_at     timestamptz not null default now()
);

create index comp_groups_composition_idx on comp_groups (composition_id, position);

alter table comp_groups enable row level security;

create policy "grupos de composiciones propias" on comp_groups
  for all
  using (exists (
    select 1 from compositions c
    where c.id = comp_groups.composition_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from compositions c
    where c.id = comp_groups.composition_id and c.owner_id = auth.uid()
  ));

-- ─── comp_slots ─────────────────────────────────────────────────────────────
-- Una persona dentro de un grupo.

create table comp_slots (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references comp_groups on delete cascade,
  position    int  not null default 0 check (position >= 0 and position < 20),
  role_id     uuid references roles  on delete set null,
  -- SET NULL, no RESTRICT: al borrar una build en uso, el slot queda sin
  -- equipo pero conserva el rol y el nombre de la persona. No se rompe la
  -- composición ni se pierde a quién había anotado.
  build_id    uuid references builds on delete set null,
  -- Texto libre, sin clave foránea a profiles: la enorme mayoría de la gente
  -- que aparece en una composición no tiene cuenta en la web, y exigirla
  -- haría la herramienta inservible.
  player_name text,
  is_leader   boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create index comp_slots_group_idx on comp_slots (group_id, position);

-- Un solo líder por grupo. La vista pública tiene que poder responder
-- "¿quién es mi líder?" sin ambigüedad.
create unique index comp_slots_one_leader_per_group
  on comp_slots (group_id) where is_leader;

alter table comp_slots enable row level security;

create policy "personas de composiciones propias" on comp_slots
  for all
  using (exists (
    select 1 from comp_groups g
    join compositions c on c.id = g.composition_id
    where g.id = comp_slots.group_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from comp_groups g
    join compositions c on c.id = g.composition_id
    where g.id = comp_slots.group_id and c.owner_id = auth.uid()
  ));

-- ─── calc_history ───────────────────────────────────────────────────────────
-- El historial de la calculadora también va a la base: si sumaste el loot de
-- una CTA desde la PC, lo tenés desde el celular.

create table calc_history (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles on delete cascade,
  expression text not null,
  result     text not null,
  created_at timestamptz not null default now()
);

create index calc_history_owner_idx on calc_history (owner_id, created_at desc);

alter table calc_history enable row level security;

create policy "historial de calculadora propio" on calc_history
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================================
-- Datos iniciales
-- ============================================================================

insert into games (slug, name, icon, position)
values ('albion-online', 'Albion Online', 'albion', 0);

-- Catálogo de roles del sistema (owner_id NULL). Son los típicos de ZvZ;
-- cada usuario puede crear los suyos además de estos.
insert into roles (owner_id, game_id, name, icon, color, position)
select
  null,
  (select id from games where slug = 'albion-online'),
  r.name, r.icon, r.color, r.position
from (values
  ('Tank',         'shield',      '#4A90D9', 10),
  ('Main Tank',    'shield-plus', '#2E6DA4', 20),
  ('Healer',       'heart',       '#5CB85C', 30),
  ('Main Healer',  'heart-plus',  '#3D8B3D', 40),
  ('DPS Cuerpo',   'sword',       '#D9534F', 50),
  ('DPS Distancia','crosshair',   '#C9302C', 60),
  ('Support',      'sparkles',    '#9B59B6', 70),
  ('Battlemount',  'rabbit',      '#E67E22', 80),
  ('Scout',        'eye',         '#F0AD4E', 90),
  ('Caller',       'megaphone',   '#E8C547', 100)
) as r(name, icon, color, position);
