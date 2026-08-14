/**
 * Pruebas del evaluador de la calculadora.
 *
 *   npm run test:calc
 *
 * Sin framework de tests: es un único módulo puro y agregar uno solo para esto
 * sería sumar una dependencia y un archivo de configuración para nada.
 *
 * Importa mucho que esto esté bien: la calculadora se usa para repartir loot
 * entre personas reales, y un error de precedencia no se ve — simplemente
 * alguien cobra de menos.
 */

import { evaluar, formatear } from "../src/lib/calc.ts";

type Caso = [expresion: string, esperado: number | null];

const CASOS: Caso[] = [
  // Lo básico
  ["2+2", 4],
  ["10-3", 7],
  ["6*7", 42],
  ["100/4", 25],

  // Precedencia: el error clásico, y el que nadie nota
  ["2+3*4", 14],
  ["10-2*3", 4],
  ["(2+3)*4", 20],
  ["((100+50)*2)/3", 100],

  // Negativos y signos
  ["-5+10", 5],
  ["-(3+2)", -5],
  ["10*-2", -20],
  ["--5", 5],

  // Decimales, con punto y con coma (teclado en español)
  ["1.5+1.5", 3],
  ["1,5+1,5", 3],
  ["0.1+0.2", 0.30000000000000004],

  // Símbolos que la gente escribe de verdad
  ["6×7", 42],
  ["100÷4", 25],

  // Porcentaje
  ["200%", 2],
  ["50%*2", 1],

  // Espacios
  ["  2 +  2 ", 4],

  // Un reparto de loot real: 12 personas, botín de 4.500.000
  ["4500000/12", 375000],
  ["1200000+850000+430000+2100000", 4580000],

  // Errores esperados
  ["", null],
  ["2+", null],
  ["(2+3", null],
  ["2++", null],
  ["10/0", null],
  ["hola", null],
  ["2 3", null],
];

let pasaron = 0;
let fallaron = 0;

for (const [expresion, esperado] of CASOS) {
  const resultado = evaluar(expresion);

  const bien =
    esperado === null
      ? !resultado.ok
      : resultado.ok && Math.abs(resultado.valor - esperado) < 1e-9;

  if (bien) {
    pasaron++;
  } else {
    fallaron++;
    const obtenido = resultado.ok ? resultado.valor : `error: ${resultado.error}`;
    console.error(
      `  FALLA  «${expresion}»  esperado ${esperado ?? "un error"}, obtuve ${obtenido}`,
    );
  }
}

// El formato también importa: son cifras de millones que alguien lee en voz alta.
const FORMATO: [number, string][] = [
  [1000, "1.000"],
  [4500000, "4.500.000"],
  [375000, "375.000"],
];

for (const [valor, esperado] of FORMATO) {
  const obtenido = formatear(valor);
  if (obtenido === esperado) {
    pasaron++;
  } else {
    fallaron++;
    console.error(`  FALLA  formatear(${valor}) dio «${obtenido}», esperaba «${esperado}»`);
  }
}

console.log(`\n${pasaron} pasaron, ${fallaron} fallaron`);
if (fallaron > 0) process.exit(1);
