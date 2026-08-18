/**
 * Pruebas del formato de exportación e importación.
 *
 *   npm run test:transferencia
 *
 * El archivo que se exporta es un contrato con el afuera: alguien lo guarda hoy
 * y lo abre dentro de seis meses, o se lo pasa a otra persona con otra cuenta.
 * Estas pruebas cubren lo que tiene que aguantar ese contrato, y sobre todo lo
 * que tiene que RECHAZAR, porque un archivo lo edita cualquiera con un editor
 * de texto y de ahí sale directo a escribir en la base.
 */

import assert from "node:assert/strict";

import catalogo from "@/data/items.json" with { type: "json" };
import { ID_DE_ITEM } from "@/lib/items.ts";

import {
  archivoSchema,
  esImportados,
  importadosAlFinal,
  nombreDeArchivo,
  VERSION,
} from "../src/lib/transferencia.ts";

let pasadas = 0;

function prueba(nombre: string, fn: () => void) {
  try {
    fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    console.error(`  FALLA ${nombre}`);
    console.error(`        ${(error as Error).message.split("\n")[0]}`);
    process.exitCode = 1;
  }
}

const composicionValida = {
  albionpm: VERSION,
  tipo: "composicion",
  exportado: "2026-08-17T12:00:00.000Z",
  composicion: {
    name: "CTA del sábado",
    description: "ZvZ en Martlock",
    event_tz: "America/Argentina/Buenos_Aires",
    grupos: [
      {
        position: 0,
        name: "Grupo 1",
        guild_name: null,
        lugares: [
          {
            position: 0,
            player_name: "Morvran",
            is_leader: true,
            notes: null,
            rol: "Tanque",
            build: "b1",
          },
        ],
      },
    ],
  },
  builds: [
    {
      ref: "b1",
      name: "Maza pesada",
      color: "#F0B429",
      tags: ["zvz"],
      items: { mainhand: { id: "T8_MAIN_MACE", ench: 3 } },
      notes: null,
      rol: "Tanque",
      carpeta: "Tanques",
    },
  ],
};

console.log("\nFormato de transferencia\n");

prueba("una composición completa se acepta", () => {
  const leido = archivoSchema.safeParse(composicionValida);
  assert.equal(leido.success, true);
});

prueba("la build queda enganchada con su lugar por la referencia", () => {
  const leido = archivoSchema.parse(composicionValida);
  assert.equal(leido.tipo, "composicion");
  if (leido.tipo !== "composicion") return;
  const ref = leido.composicion.grupos[0].lugares[0].build;
  assert.ok(leido.builds.some((build) => build.ref === ref));
});

prueba("los campos opcionales toman su valor por omisión", () => {
  const minima = {
    albionpm: VERSION,
    tipo: "builds",
    exportado: "2026-08-17T12:00:00.000Z",
    builds: [{ ref: "x", name: "Sin nada" }],
  };
  const leido = archivoSchema.parse(minima);
  assert.equal(leido.tipo, "builds");
  if (leido.tipo !== "builds") return;
  assert.equal(leido.builds[0].color, null);
  assert.deepEqual(leido.builds[0].tags, []);
  assert.deepEqual(leido.builds[0].items, {});
  assert.equal(leido.origen, null);
});

prueba("un archivo de otra versión se rechaza", () => {
  const otra = { ...composicionValida, albionpm: 99 };
  assert.equal(archivoSchema.safeParse(otra).success, false);
});

prueba("un tipo desconocido se rechaza", () => {
  const raro = { ...composicionValida, tipo: "otra-cosa" };
  assert.equal(archivoSchema.safeParse(raro).success, false);
});

prueba("un identificador de item inventado se rechaza", () => {
  const sucio = structuredClone(composicionValida);
  sucio.builds[0].items = { mainhand: { id: "rm -rf /" } } as never;
  assert.equal(archivoSchema.safeParse(sucio).success, false);
});

/**
 * Esta prueba nació de un error real: el filtro de identificadores estaba
 * escrito mirando solo los ids con tier (`T8_MAIN_MACE`), así que rechazaba las
 * monturas de cristal, oro y plata —que no llevan tier— y las seis que traen el
 * encantamiento pegado. Guardar una build con cualquiera de esas fallaba con
 * «formato inválido», sin decir cuál de los nueve slots tenía el problema.
 *
 * Se prueba contra el catálogo entero y no contra tres ejemplos: el catálogo se
 * regenera desde los dumps del juego, y el día que aparezca una familia nueva
 * de identificadores esto tiene que avisar antes que un usuario.
 */
prueba("todos los items del catálogo se pueden guardar", () => {
  const rechazados = catalogo
    .filter((item) => !ID_DE_ITEM.test(item.id))
    .map((item) => item.id);

  assert.deepEqual(rechazados, [], `el catálogo trae ids que el filtro rechaza`);
});

prueba("una montura sin tier y una con encantamiento fijo se aceptan", () => {
  for (const id of ["UNIQUE_MOUNT_BEHEMOTH_CRYSTAL", "T5_MOUNT_COUGAR_KEEPER@1"]) {
    const archivo = structuredClone(composicionValida);
    archivo.builds[0].items = { mount: { id } } as never;
    assert.equal(archivoSchema.safeParse(archivo).success, true, id);
  }
});

prueba("un color que no es hexadecimal se rechaza", () => {
  const sucio = structuredClone(composicionValida);
  sucio.builds[0].color = "javascript:alert(1)";
  assert.equal(archivoSchema.safeParse(sucio).success, false);
});

prueba("un grupo con más de veinte lugares se rechaza", () => {
  const sucio = structuredClone(composicionValida);
  sucio.composicion.grupos[0].lugares = Array.from({ length: 21 }, (_, i) => ({
    position: 0,
    player_name: `p${i}`,
    is_leader: false,
    notes: null,
    rol: null,
    build: null,
  }));
  assert.equal(archivoSchema.safeParse(sucio).success, false);
});

prueba("una posición fuera del grupo se rechaza", () => {
  const sucio = structuredClone(composicionValida);
  sucio.composicion.grupos[0].lugares[0].position = 20;
  assert.equal(archivoSchema.safeParse(sucio).success, false);
});

prueba("el nombre del archivo sobrevive a acentos y barras", () => {
  assert.equal(nombreDeArchivo("CTA del sábado"), "CTA-del-sabado.albionpm.json");
  assert.equal(nombreDeArchivo("a/b\\c:d"), "abcd.albionpm.json");
  assert.equal(nombreDeArchivo("¿?¡!"), "albionpm.albionpm.json");
});


prueba("«Importados» queda al final sin desordenar el resto", () => {
  const antes = [
    { name: "Importados" },
    { name: "CTA" },
    { name: "Gankeo" },
  ];
  assert.deepEqual(
    importadosAlFinal(antes).map((x) => x.name),
    ["CTA", "Gankeo", "Importados"],
  );
});

prueba("el nombre se reconoce sin importar mayúsculas ni espacios", () => {
  assert.equal(esImportados("  importados "), true);
  assert.equal(esImportados("Importados de Juan"), false);
});

console.log(`\n${pasadas} pruebas pasadas\n`);
