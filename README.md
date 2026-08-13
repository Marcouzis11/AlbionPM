# AlbionPM

**Gestor de partys y composiciones para Albion Online.**

Armá la composición una vez, guardala, reutilizala y compartila con un link. El jugador la abre desde el celular, se busca por su nombre y ve exactamente qué equiparse, en qué grupo va y a quién tiene que seguir.

> Estado: en desarrollo. Ver el [roadmap](#roadmap).

---

## El problema

En Albion Online, organizar contenido en grupo —Gankeo, Castillo, Avaloniana, PVE, Estática, Guerra, CTA— implica que alguien defina qué build lleva cada persona y después comunique eso al resto.

Hoy esa información vive en capturas de pantalla, mensajes de Discord que se pierden entre otros cien, y planillas improvisadas que nadie vuelve a encontrar. El resultado conocido: gente que llega a la CTA sin saber qué armar, que pregunta lo mismo cinco veces, o que directamente aparece con la build equivocada.

Y el jugador común —el que no organiza nada y solo quiere jugar— es el que peor la pasa: no tiene ninguna forma clara de saber qué le toca.

## Qué hace AlbionPM

**Para quien organiza:**

- Organizar el trabajo por **contenido**, con las categorías que vos crees (Gankeo, Castillo, CTA, lo que uses).
- Armar **composiciones de uno o varios grupos de 20**, con rol, build y nombre para cada persona.
- Una **biblioteca de builds** con carpetas anidadas, tags y un color por build que pinta su fila en cualquier composición donde aparezca.
- **Plantillas** reutilizables, incluidas una de gremio único y otra multigremio para coordinar varios gremios en una guerra.
- Duplicar, duplicar sin builds, copiar a otro contenido o vaciar dejando solo la estructura.
- **Disarray estimado** de la composición completa, contando solo a la gente confirmada.
- **Historial** con fecha, hora y descripción libre de cada composición usada.
- Una **calculadora** siempre a mano para sumar el loot.

**Para el jugador:**

- Abre un link, **sin registrarse ni instalar nada**.
- Escribe su nombre y ve su build completa, su rol, su grupo y **quién es el líder de su grupo de 20**.
- También puede ver la composición entera.
- Disponible como link, PDF o imagen, según lo que el organizador elija compartir.

## Lo que AlbionPM no intenta hacer

Armar una composición es un trabajo humano: quién aguanta un rol y quién no, lo sabe el líder, no un algoritmo. La herramienta no intenta decidir eso.

Lo que sí hace es que ese esfuerzo **se haga una sola vez**, quede guardado, se pueda reutilizar y llegue con claridad a quien tiene que ejecutarlo.

Tampoco pretende competir con el Character Builder oficial ni con los planificadores de builds existentes. El foco está en la capa de **gestión y comunicación**, que es donde no hay nada bueno.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth — Discord OAuth + email |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Estado de cliente | Zustand |
| Validación | Zod |
| Drag & drop | dnd-kit |
| Internacionalización | next-intl (español e inglés) |
| Hosting | Vercel |

Las razones detrás de cada elección están en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

**Todo el trabajo del usuario vive en la base de datos.** Podés entrar desde otra computadora, desde el celular o desde otro navegador y encontrar exactamente lo mismo.

## Datos del juego

No se aloja ningún ícono ni se mantiene un catálogo a mano — el juego publica ambas cosas:

- **Catálogo de items:** [`ao-data/ao-bin-dumps`](https://github.com/ao-data/ao-bin-dumps), que incluye los nombres ya traducidos a español e inglés.
- **Íconos:** el [servicio de render oficial](https://wiki.albiononline.com/wiki/API:Render_service) de Albion Online.

---

## Levantarlo en tu máquina

Necesitás Node.js 20 o superior.

```bash
git clone https://github.com/Marcouzis11/AlbionPM.git
cd AlbionPM
npm install
cp .env.example .env.local   # completá las claves de Supabase
npm run dev
```

Queda en `http://localhost:3000`.

Las variables de entorno están documentadas en [`.env.example`](.env.example). Para trabajar en la interfaz sin base de datos podés dejarlas vacías; lo que necesite Supabase no va a funcionar hasta que las completes.

## Hosting

El proyecto está pensado para vivir entero en servicios gratuitos:

| Pieza | Servicio |
|---|---|
| Web | Vercel |
| Base de datos y autenticación | Supabase |
| Íconos de items | Render oficial de Albion |

Cada `git push` a `main` despliega solo. No hay servidor que administrar.

Dos límites que conviene conocer: el plan Hobby de Vercel es **solo para uso no comercial**, y Supabase pausa los proyectos gratuitos tras una semana sin actividad (se despierta con un click, y con usuarios reales no ocurre).

---

## Roadmap

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Documentación, scaffold y deploy | En curso |
| 1 | Auth, esquema de base, temas y navegación | Pendiente |
| 2 | Biblioteca de builds con carpetas, tags y colores | Pendiente |
| 3 | Party maker, Disarray e historial | Pendiente |
| 4 | Compartir y vista pública del jugador | Pendiente |
| 5 | Calculadora | Pendiente |
| 6 | Gremios y roster | Pendiente |
| 7 | Hechizos e integración con Discord | Pendiente |

---

## Licencia

Pendiente de definir.

AlbionPM es un proyecto de fans, sin relación con Sandbox Interactive GmbH. Albion Online y sus recursos son propiedad de sus respectivos dueños.
