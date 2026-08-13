# Arquitectura de AlbionPM

Este documento explica **por qué** el proyecto está armado como está. El README cuenta qué hace; acá está el razonamiento, incluidas las cosas que se descartaron y los problemas que hay que evitar.

---

## Índice

- [Principios](#principios)
- [Elección del stack](#elección-del-stack)
- [Modelo de datos](#modelo-de-datos)
- [Permisos y seguridad](#permisos-y-seguridad)
- [Datos del juego](#datos-del-juego)
- [Disarray](#disarray)
- [Colores de build](#colores-de-build)
- [Borrado](#borrado)
- [Fechas y zonas horarias](#fechas-y-zonas-horarias)
- [Temas](#temas)
- [Vista pública](#vista-pública)
- [Trampas conocidas](#trampas-conocidas)

---

## Principios

**1. Todo el trabajo del usuario vive en la base de datos.**
Builds, carpetas, tags, colores, contenidos, composiciones, grupos, personas, roles propios, historial de la calculadora, tema, idioma y preferencias de interfaz. `localStorage` no se usa para nada que el usuario haya producido.

Hay **una sola excepción, y es inevitable**: el nombre que un jugador anónimo busca en la vista pública compartida. Esa persona no tiene cuenta —ese es exactamente el punto de esa pantalla—, así que no hay dónde guardarlo del lado del servidor. Se guarda en su navegador como comodidad; si se pierde, solo vuelve a escribir su nombre. Nada del trabajo del organizador depende de eso.

**2. La vista pública es la razón de ser del proyecto.**
Todo lo demás existe para que esa pantalla sea buena. Se optimiza para un celular con mala señal, cinco minutos antes de que empiece la CTA.

**3. Legibilidad por encima de decoración.**
La estética se inspira en Albion, pero cuando la ornamentación pelea con la claridad, gana la claridad.

**4. Honestidad sobre lo que no se puede saber.**
El Disarray no se puede calcular con exactitud desde fuera del juego. Se muestra como estimación, con el supuesto a la vista. No se promete precisión que no existe.

---

## Elección del stack

| Capa | Elección | Razón |
|---|---|---|
| Framework | **Next.js 16, App Router** | La vista pública se renderiza en el servidor: llega como HTML listo, sin esperar JavaScript. Es la diferencia entre servir a alguien con mala señal o no servirlo. Además, un solo proyecto para front y back. |
| Base de datos | **Supabase (PostgreSQL)** | El modelo es relacional y jerárquico. Postgres aporta integridad referencial, arrays nativos para tags y CTEs recursivas para las carpetas anidadas. |
| Auth | **Supabase Auth** | El provider de Discord se habilita desde el panel, sin escribir el flujo OAuth. La comunidad de Albion vive en Discord. |
| Estilos | **Tailwind v4 + shadcn/ui** | shadcn instala los componentes como código propio del repo, no como dependencia opaca. Cuando haya que modificar un `Dialog`, se modifica. |
| Estado de cliente | **Zustand** | El editor de composición y la calculadora flotante mantienen estado que sobrevive a la navegación. Zustand es mínimo y no necesita provider. Redux sería desproporcionado. |
| Validación | **Zod** | Un mismo esquema valida el formulario, el payload del servidor y la forma del `jsonb`. Una sola fuente de verdad. |
| Drag & drop | **dnd-kit** | Accesible y mantenido. `react-beautiful-dnd` está descontinuado. |
| i18n | **next-intl** | Diseñado para App Router y Server Components. |
| Export PNG | **html-to-image** | Dibuja el DOM ya renderizado. Evita mantener un segundo motor de dibujo que se desincronizaría de la interfaz real. |

### Lo que se decidió NO usar

**ORM (Prisma / Drizzle).** El cliente de Supabase con tipos generados desde el esquema (`supabase gen types typescript`) alcanza, y evita mantener dos definiciones del mismo esquema que inevitablemente se desincronizan. Si en algún momento hacen falta migraciones complejas, Drizzle es la salida natural.

**Generador de PDF en el cliente.** Una hoja de estilos de impresión más el diálogo del navegador da fidelidad total y no suma un solo kilobyte al bundle. Un `jsPDF` habría que mantenerlo en paralelo a la interfaz real.

**Tabla de plantillas separada.** Una plantilla es una composición con una bandera. Duplicar todo el modelo para representar lo mismo no aporta nada.

---

## Modelo de datos

Jerarquía: **Juego → Contenido → Composición → Grupo (máx. 20) → Persona**.

```
games            id, slug ('albion-online'), name, icon

profiles         id (= auth.users.id), display_name, avatar_url, albion_ign,
                 theme ('dark'|'light'|'system'), locale ('es'|'en'), preferences jsonb

calc_history     id, owner_id → profiles, expression, result, created_at

contents         id, owner_id, game_id, name, icon, color, position
                 -- Gankeo, Castillo, Avaloniana, PVE, Estática, Guerra, CTA…

roles            id, owner_id (NULL = catálogo del sistema), game_id,
                 name, icon, color, position

build_folders    id, owner_id, game_id, parent_id → build_folders (NULL = raíz),
                 name, position

builds           id, owner_id, game_id, folder_id → build_folders (nullable),
                 name, role_id → roles, color, tags text[],
                 items jsonb, notes, is_public, created_at, updated_at

compositions     id, owner_id, content_id → contents, name, description,
                 event_at timestamptz, event_tz text,
                 is_archived bool, archived_at,
                 share_slug text unique, visibility, share_formats jsonb,
                 created_at, updated_at

comp_groups      id, composition_id → compositions, position, name, guild_name

comp_slots       id, group_id → comp_groups, position (0-19),
                 role_id → roles, build_id → builds,
                 player_name text, is_leader bool, notes
```

### Decisiones, con su razón

**`builds.items` como `jsonb`.** La forma es estable y conocida: nueve slots de equipo, siempre los mismos.

```jsonc
{
  "mainhand": { "id": "T8_MAIN_SWORD", "ench": 2, "quality": 3 },
  "offhand":  { "id": "T8_OFF_SHIELD", "ench": 1 },
  "head": {…}, "armor": {…}, "shoes": {…},
  "cape": {…}, "food": {…}, "potion": {…}, "mount": {…}
}
```

La alternativa era una tabla `build_items` (nueve joins para leer una build) o nueve pares de columnas (una tabla ancha llena de nulos). El `jsonb` se lee de una y Zod valida su forma antes de escribir.

El **tier no se guarda por separado**: ya está en el prefijo del `UniqueName` (`T8_`). Guardarlo dos veces es garantizar que algún día no coincidan.

**El color vive en la build, no en el slot.** Es lo que hace que el color signifique algo: donde sea que aparezca esa build, la fila se pinta igual. Se cambia en un lugar y se propaga a todas las composiciones. Si el color viviera en el slot, la misma build podría aparecer de cinco colores distintos y el sistema entero perdería sentido.

**`builds.tags` como `text[]` con índice GIN.** Filtrado rápido sin joins, y sin una pantalla de administración de tags que nadie quiere mantener. Postgres soporta arrays de forma nativa; no hay razón para normalizar esto.

**`build_folders.parent_id` auto-referencial.** Subcarpetas con la profundidad que haga falta, leídas de una sola consulta con una CTE recursiva.

**`comp_slots.is_leader` en el slot, no en el grupo.** El líder es una de las 20 personas, no un dato aparte. La vista pública tiene que poder responder "¿quién es mi líder?" y esa pregunta se contesta mirando el grupo de esa persona.

**`comp_slots.player_name` es texto libre, sin clave foránea a `profiles`.** La enorme mayoría de la gente que aparece en una composición no tiene cuenta en la web, y nunca la va a tener. Exigir una cuenta para poder anotar a alguien haría la herramienta inservible. Vincular jugadores reales llega en la Fase 6, y será opcional.

---

## Permisos y seguridad

**RLS habilitado en todas las tablas, desde la primera migración.** En Supabase, una tabla sin RLS es legible por cualquiera que tenga la clave anónima — que está en el JavaScript del navegador, a la vista de todos. No es una optimización a futuro: es la diferencia entre tener seguridad y no tenerla.

- Todo lo del usuario (`contents`, `builds`, `build_folders`, `roles`, `compositions`, `calc_history`…) es legible y escribible **solo por su `owner_id`**.
- `roles` del sistema (`owner_id IS NULL`): lectura para todos, escritura para nadie.
- **Vista pública:** una composición compartida se lee a través de una función `SECURITY DEFINER` que recibe el `share_slug` y devuelve la composición entera ya armada. No se abre `SELECT` público sobre las tablas. Así el acceso anónimo tiene exactamente una puerta, auditable en un solo lugar.

**Prueba obligatoria antes de dar por cerrada la Fase 4:** con una composición privada, intentar leerla desde otra cuenta usando el cliente de Supabase directamente. Debe devolver vacío. Si devuelve datos, la política está mal escrita.

---

## Datos del juego

### Catálogo de items

Fuente: `https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json`

Cada entrada trae `UniqueName` (ej. `T4_MAIN_SWORD`) y `LocalizedNames` con `EN-US` y `ES-ES`. Esto resuelve el buscador bilingüe sin traducir un solo nombre a mano.

El archivo completo es demasiado grande para pedirlo en tiempo real. `scripts/build-items.ts` lo descarga, filtra solo los equipables (armas, off-hands, cabeza, pecho, zapatos, capas, comida, pociones, monturas) y genera un JSON reducido versionado en el repo. El catálogo solo cambia con cada parche del juego, así que regenerarlo es una tarea manual ocasional.

### Íconos

Fuente: `https://render.albiononline.com/v1/item/{UniqueName}.png?quality={1-5}&size={1-217}`

Servicio oficial. El encantamiento va dentro del propio ID (`T4_MAIN_SWORD@2`). No se aloja ninguna imagen.

**Se sirven a través de un proxy propio en `/api/icon/[id]`.** No es opcional ni una optimización: el export a PNG dibuja el DOM en un `<canvas>`, y un canvas que recibió imágenes de otro dominio queda *contaminado* y el navegador prohíbe exportarlo. Sirviendo los íconos desde el mismo origen el problema no existe. Hay que hacerlo desde el principio, no cuando falle el export.

### Jugadores y gremios (Fase 6)

`https://gameinfo.albiononline.com/api/gameinfo/search?q={nombre}` y `/guilds/{id}/members`.

Está documentada como lenta e inestable. Se usa solo en acciones explícitas del usuario, **nunca** durante el render de una página, y con caché.

### Fuera de alcance por ahora

Los hechizos (Q/W/E de cada arma, activo y pasivo de cada armadura) están en los dumps, pero requieren parsear el XML crudo y modelar qué hechizo pertenece a qué item. Es un proyecto en sí mismo. Hasta la Fase 7 se cubren con el campo de notas de cada build.

---

## Disarray

**Lo que hay que entender antes de escribir una línea de código:**

1. El Disarray **no depende de tu composición**, sino de cuántos jugadores de tu alianza hay en el cluster — incluidos los que están en cola para entrar.
2. El debuff es **relativo**: solo penaliza al atacar a alguien con Disarray menor, con un modificador del tipo `(1 - nivelPropio/100) / (1 - nivelRival/100)`.
3. La tabla exacta de jugadores → nivel **no está documentada de forma confiable** en fuentes públicas, y Sandbox Interactive la ha cambiado varias veces entre parches.

**Cómo se resuelve:**

- La curva vive en **`src/data/disarray.ts`**, como tabla de umbrales, con la fuente y el parche de referencia comentados. Cuando SBI la cambie, se edita ese archivo y nada más. Ninguna otra parte del código conoce los números.
- **Solo cuentan los slots con nombre escrito.** Un slot vacío es un lugar previsto, no una persona. Efecto secundario útil: el número se convierte en un indicador en vivo de gente confirmada, y por eso se muestran las dos cifras juntas (`27 jugadores confirmados / 40 lugares`).
- Un campo opcional de **aliados extra en el cluster**, porque la composición es un piso, no el total real.
- Se muestra siempre como **"Disarray estimado"**, con el supuesto explicado en un tooltip.
- También se calcula el **Disarray relativo** contra un tamaño de enemigo que el usuario ingresa, que es la pregunta que un caller realmente se hace.

---

## Colores de build

El color es funcional: pinta la fila de esa persona en todas las composiciones. Por eso el problema real no es elegir un color lindo, sino **no acercarse demasiado a uno ya usado** — dos azules casi iguales vuelven la composición ilegible justo cuando hay que leerla rápido.

El selector, entonces:

- Panel de saturación/brillo con barra de tono (`react-colorful`, 2,8 kB, permite superponer elementos propios).
- **Puntos sobre el panel marcando los colores ya usados**, con tooltip que dice qué build tiene cada uno.
- **Entrada manual de hexadecimal**, tolerante al `#` y a mayúsculas.
- Tira de colores en uso, para elegir uno de un click cuando sí se quiere repetir.
- Aviso discreto de similitud, medido en **OKLCH y no en RGB** — en RGB dos colores numéricamente lejanos pueden verse idénticos.

**Detalle geométrico que hay que resolver bien:** el panel de saturación/brillo representa **un solo tono a la vez**, así que un color de otro tono no tiene posición real ahí. Por eso los marcadores se reparten:

- Sobre la **barra de tono**: todos los colores en uso, en su posición de tono.
- Sobre el **panel de saturación/brillo**: solo los que están dentro de ±15° del tono actual, que son los que realmente se pueden confundir.

El alcance de "colores en uso" es **toda la biblioteca de builds del usuario para ese juego**, no la composición abierta: el color identifica a la build donde sea que aparezca.

---

## Borrado

**Sin papelera. Borrar destruye de verdad.** A cambio, las confirmaciones tienen que decir exactamente qué se pierde.

**Fricción proporcional al daño.** Pedir confirmación para todo entrena a la gente a confirmar sin leer, y ahí es donde se pierde el trabajo importante:

| Nivel | Alcance | Qué pide |
|---|---|---|
| Sin diálogo | Quitar una persona o una build de un slot | Nada. Es trivialmente rehacible |
| Confirmación con detalle | Build, composición, rol propio, grupo con gente | Diálogo que enumera lo que se pierde |
| Confirmación + escribir el nombre | Carpeta con contenido, contenido con composiciones, "Vaciar" | Escribir el nombre exacto para habilitar el botón |

Escribir el nombre es la única barrera que un click distraído no atraviesa. Es lo que exige GitHub para borrar un repositorio, y por el mismo motivo.

**Contenedores: el diálogo informa y deja elegir, no decide.**

- *"Esta carpeta contiene 3 subcarpetas y 12 builds"* → borrar todo, o **rescatar** el contenido moviéndolo a la carpeta padre.
- *"Este contenido tiene 7 composiciones"* → borrar todo, o **moverlas** a otro contenido.

El conteo es **recursivo**: informa el total real, no el primer nivel.

**Builds en uso:** el diálogo avisa en cuántas composiciones se usa, las lista con link, y aclara la consecuencia — los slots quedan **sin build pero conservando el rol y el nombre de la persona**. No se rompe la composición ni se pierde a quién había anotado.

**Las composiciones archivadas no se pueden borrar** sin desarchivarlas primero.

**Respaldo en la base:** las relaciones usan `ON DELETE RESTRICT` donde la aplicación debe preguntar antes, y `ON DELETE CASCADE` solo donde la cascada es obviamente correcta (las personas de un grupo que se borra, los grupos de una composición que se borra). Si un diálogo tuviera un bug, la base rechaza la operación en vez de destruir datos en silencio.

---

## Fechas y zonas horarias

Toda composición lleva fecha y hora, tomadas de la máquina del usuario al crearla y editables después.

**Se guarda también la zona horaria de origen (`event_tz`, formato IANA), no solo el instante.** Una CTA a las 20:30 hora Argentina, abierta desde Brasil o España sin esa información, se leería como 21:30 o 01:30 — y alguien llegaría tarde. Guardando la zona, la vista pública muestra la hora tal como se escribió, con su referencia explícita (`20:30 ART`), y puede ofrecer la conversión a la hora local de quien mira.

Es una columna de texto y elimina el malentendido clásico de las alianzas multipaís.

---

## Temas

- Paleta definida en **variables CSS** sobre `:root` y `[data-theme="dark"]`. Ningún componente escribe un color a mano.
- Tres estados: `dark`, `light` y `system`. Oscuro por defecto.
- **Guardado en `profiles.theme`**, así acompaña al usuario entre dispositivos.
- **Espejado en una cookie** que el servidor lee para pintar el `<html>` correcto en el primer render.

Ese último punto no es un detalle menor: sin la cookie se ve un destello blanco en cada carga antes de que el JavaScript aplique el modo oscuro. Es el error más común de esta funcionalidad. La cookie es caché de render; **la fuente de verdad sigue siendo la base**.

---

## Vista pública

Ruta `/[locale]/p/[shareSlug]`. Sin login. Renderizada en el servidor.

**Restricción que atraviesa todo el diseño de esta pantalla:** se abre desde un celular, con poca señal, muchas veces con la CTA a punto de empezar. La composición entera se entrega en el HTML del servidor **en una sola consulta**, y el buscador filtra sobre datos que ya están en la página. Nada de peticiones adicionales.

### Modo "Mi ficha"

Buscador con foco automático, tolerante a errores (parcial, sin distinguir mayúsculas ni acentos — los nombres de Albion se escriben mal siempre). Devuelve, en este orden de prioridad visual:

1. Su nombre
2. Su grupo, y el gremio si la composición es multigremio
3. **Quién es el líder de su grupo de 20**
4. Su rol
5. Su build completa, ítem por ítem, con nombre en texto además del ícono para poder buscarlo en el mercado
6. Las notas dirigidas a él (las de su slot y las de su build)
7. La información general de la composición
8. Sus compañeros de grupo con sus roles
9. Acceso a la composición completa

### Modo "Composición completa"

Todos los grupos, con las filas pintadas por color de build y el líder de cada grupo marcado. Si el jugador ya se buscó, su fila queda resaltada y la vista arranca posicionada ahí.

### Formatos

Controlados por `share_formats`; el dueño elige cuáles ofrecer:

- **Link** — siempre disponible
- **PDF** — hoja de estilos de impresión y diálogo del navegador
- **PNG** — `html-to-image`, para pegar en Discord

---

## Trampas conocidas

Cosas que van a romper si no se previenen. Están acá para no descubrirlas dos veces.

| Trampa | Prevención |
|---|---|
| El export a PNG sale con los íconos en blanco | Servir los íconos por `/api/icon/[id]`, mismo origen. Un canvas contaminado no se puede exportar |
| Destello blanco al cargar en modo oscuro | Espejar el tema en una cookie y leerla en el servidor antes del primer render |
| La vista pública muestra el líder equivocado | Es el líder **del grupo de esa persona**, no el del grupo 1. Verificarlo explícitamente |
| El historial "miente" sobre lo que se usó ese día | Archivar congela la composición. Editar una comp vieja reescribe el pasado |
| El Disarray cuenta lugares vacíos | Solo cuentan los slots con nombre escrito. Cuidado con los nombres que son solo espacios |
| Una tabla nueva queda sin RLS | RLS en la misma migración que crea la tabla, siempre |
| Dos builds con colores casi idénticos | Marcadores de colores en uso y aviso de similitud medido en OKLCH |
| Una CTA a la que la gente llega una hora tarde | Guardar `event_tz` y mostrar la hora con su referencia |
