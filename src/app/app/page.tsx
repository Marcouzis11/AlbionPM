import { redirect } from "next/navigation";

import { listGames } from "@/lib/data/contents";

/**
 * `/app` no muestra nada: manda al juego correspondiente.
 *
 * Con un solo juego cargado esto parece de más, pero es el punto donde después
 * va a decidirse cuál abrir según la preferencia guardada del usuario.
 */
export default async function AppIndex() {
  const games = await listGames();

  if (games.length === 0) {
    return (
      <main className="p-10">
        <p className="text-muted">
          No hay juegos cargados. Falta correr la migración inicial de la base.
        </p>
      </main>
    );
  }

  redirect(`/app/${games[0].slug}`);
}
