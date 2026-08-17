/**
 * Las novedades del sistema.
 *
 * Solo funcionalidades nuevas: cosas que antes no se podían hacer y ahora sí.
 * Las correcciones no entran, por más trabajo que hayan costado. A quien usa
 * esto no le sirve enterarse de que una barra de scroll dejó de tapar un borde;
 * le sirve enterarse de que ahora puede pintar veinte builds de una.
 *
 * Van a mano y no salen del historial de cambios. Un historial de cambios está
 * escrito para quien programa —dice qué se tocó y por qué— y esto está escrito
 * para quien organiza una CTA: dice qué puede hacer distinto a partir de hoy.
 *
 * De lo más nuevo a lo más viejo. La fecha es la del día en que quedó publicada.
 */

export type Novedad = {
  /** `YYYY-MM-DD`. Ordena la lista y decide qué es nuevo para cada persona. */
  fecha: string;
  titulo: string;
  /** Qué podés hacer ahora que antes no. En una o dos oraciones. */
  detalle: string;
  /** Dónde encontrarlo. */
  donde: "Party Maker" | "Builds" | "Composición" | "Historial" | "Compartir" | "Todo";
};

export const NOVEDADES: Novedad[] = [
  {
    fecha: "2026-08-17",
    titulo: "Exportar e importar",
    detalle:
      "Bajás una composición a un archivo y se lleva las builds que usa. Quien lo importa las recibe enganchadas, en un contenido «Importados» y una carpeta con el nombre de la composición. También se pueden exportar carpetas de builds sueltas.",
    donde: "Todo",
  },
  {
    fecha: "2026-08-17",
    titulo: "Novedades",
    detalle:
      "Esta misma pantalla. Cada vez que se agregue algo nuevo va a aparecer acá, con un punto en la barra hasta que lo leas.",
    donde: "Todo",
  },
  {
    fecha: "2026-08-15",
    titulo: "Todo responde en el acto",
    detalle:
      "Crear, mover, renombrar, pintar, borrar, agregar gente a un grupo: el cambio se ve apenas lo hacés, sin esperar al servidor. Si algo falla, se deshace solo y te avisa.",
    donde: "Todo",
  },
  {
    fecha: "2026-08-15",
    titulo: "Nueve plantillas para arrancar",
    detalle:
      "Además de las de siempre, ahora hay gankeo de 5, media party de 10, y de dos a cinco grupos. Cada una se dibuja en chiquito para que se vea qué trae antes de elegirla.",
    donde: "Party Maker",
  },
  {
    fecha: "2026-08-15",
    titulo: "Elegir la build viendo el equipo",
    detalle:
      "El selector de una persona abre un menú con tus carpetas, un buscador por nombre y el equipo completo de cada build. Ya no hay que acordarse de cuál era «Maza 2».",
    donde: "Composición",
  },
  {
    fecha: "2026-08-15",
    titulo: "Duplicar y borrar composiciones desde su carpeta",
    detalle:
      "Sin entrar en la composición. Duplicar deja la copia al lado con «(duplicado)» en el nombre, y borrar te muestra antes qué se pierde.",
    donde: "Party Maker",
  },
  {
    fecha: "2026-08-15",
    titulo: "El historial guarda lo que compartiste",
    detalle:
      "Una composición entra al historial cuando la compartís, que es cuando deja de ser un borrador. Las pruebas a medio armar ya no ensucian la lista.",
    donde: "Historial",
  },
  {
    fecha: "2026-08-14",
    titulo: "Pintar una carpeta pinta sus builds",
    detalle:
      "Ponele color a «Tanques» y lo heredan las veinte builds de adentro, y las de sus subcarpetas. Una build puntual puede tener el suyo propio y se respeta.",
    donde: "Builds",
  },
  {
    fecha: "2026-08-14",
    titulo: "Arrastrar para mover y ordenar",
    detalle:
      "Builds entre carpetas, carpetas dentro de otras, composiciones entre contenidos, y personas entre grupos. Mientras arrastrás ves dónde va a quedar. Desde el celular está el menú «Mover a», que hace lo mismo.",
    donde: "Todo",
  },
  {
    fecha: "2026-08-14",
    titulo: "La corona del caller",
    detalle:
      "Reemplaza a la estrella: una por grupo, y se le pasa a otra persona tocándola. Un grupo no se queda sin caller por accidente.",
    donde: "Composición",
  },
  {
    fecha: "2026-08-14",
    titulo: "Builds como árbol y tarjetas",
    detalle:
      "Las carpetas son un árbol con sangría, como el explorador de un editor, y cada build es una tarjeta con su equipo acomodado igual que en el panel del juego.",
    donde: "Builds",
  },
  {
    fecha: "2026-08-14",
    titulo: "Renombrar y elegir el color de tus carpetas",
    detalle:
      "Los contenidos y las carpetas de builds se renombran donde están, y el color se elige al crearlos o después, con la paleta completa.",
    donde: "Todo",
  },
  {
    fecha: "2026-08-14",
    titulo: "El link del jugador muestra todo el equipo",
    detalle:
      "Quien abre el link ve las nueve piezas de su build, no cinco, acomodadas como en el juego. Vale igual para la imagen y el PDF.",
    donde: "Compartir",
  },
];

/** La más reciente. Sirve para saber si hay algo sin leer. */
export function ultimaNovedad(): string {
  return NOVEDADES[0]?.fecha ?? "";
}
