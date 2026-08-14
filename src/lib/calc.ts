/**
 * Evaluador aritmético de la calculadora.
 *
 * Escrito a mano y no con `eval()`. La expresión la escribe el usuario, pero
 * también puede llegar desde el historial guardado en la base: `eval()` sobre
 * texto que viajó por la red es ejecutar código arbitrario en el navegador de
 * quien mire. No hay ninguna razón para correr ese riesgo por cuatro
 * operaciones.
 *
 * Analizador descendente recursivo, con la precedencia habitual:
 *
 *   expresion  := termino (('+' | '-') termino)*
 *   termino    := unario (('*' | '/' | '%') unario)*
 *   unario     := ('-' | '+')? primario
 *   primario   := numero | '(' expresion ')'
 */

export type ResultadoCalculo =
  | { ok: true; valor: number }
  | { ok: false; error: string };

/** Símbolos que la gente escribe y que hay que aceptar igual. */
const EQUIVALENCIAS: Record<string, string> = {
  "×": "*",
  "·": "*",
  "÷": "/",
  ",": ".", // el teclado numérico en español escribe coma
  "−": "-", // guion largo de algunos teclados
};

export function evaluar(expresion: string): ResultadoCalculo {
  // Los espacios NO se quitan de entrada: se saltan entre símbolo y símbolo.
  // Borrarlos convertiría «2 3» —dos números sin operador, que es un error—
  // en «23», y la calculadora devolvería un resultado en vez de avisar.
  const texto = [...expresion]
    .map((caracter) => EQUIVALENCIAS[caracter] ?? caracter)
    .join("")
    .trim();

  if (!texto) return { ok: false, error: "Vacío" };

  let i = 0;

  function saltarEspacios(): void {
    while (i < texto.length && /\s/.test(texto[i])) i++;
  }

  function espiar(): string | undefined {
    saltarEspacios();
    return texto[i];
  }

  function expresionCompleta(): number {
    let valor = termino();
    for (;;) {
      const c = espiar();
      if (c === "+") {
        i++;
        valor += termino();
      } else if (c === "-") {
        i++;
        valor -= termino();
      } else {
        return valor;
      }
    }
  }

  function termino(): number {
    let valor = unario();
    for (;;) {
      const c = espiar();
      if (c === "*") {
        i++;
        valor *= unario();
      } else if (c === "/") {
        i++;
        const divisor = unario();
        if (divisor === 0) throw new Error("No se puede dividir por cero");
        valor /= divisor;
      } else if (c === "%") {
        // Porcentaje al estilo calculadora: `200%` es 2, y `50+10%` suma 10%
        // de 50. Se resuelve como "dividido cien" porque es lo que espera
        // alguien que viene de la calculadora de Windows.
        i++;
        valor /= 100;
      } else {
        return valor;
      }
    }
  }

  function unario(): number {
    const c = espiar();
    if (c === "-") {
      i++;
      return -unario();
    }
    if (c === "+") {
      i++;
      return unario();
    }
    return primario();
  }

  function primario(): number {
    const c = espiar();

    if (c === "(") {
      i++;
      const valor = expresionCompleta();
      if (espiar() !== ")") throw new Error("Falta cerrar un paréntesis");
      i++;
      return valor;
    }

    saltarEspacios();

    const inicio = i;
    // El bucle se corta ante un espacio, así que «2 3» deja el «3» sin
    // consumir y termina reportándose como sobrante.
    while (i < texto.length && /[0-9.]/.test(texto[i])) i++;

    if (i === inicio) {
      throw new Error(`No entiendo «${c ?? "el final"}»`);
    }

    const crudo = texto.slice(inicio, i);
    const numero = Number(crudo);
    if (!Number.isFinite(numero)) throw new Error(`«${crudo}» no es un número`);

    return numero;
  }

  try {
    const valor = expresionCompleta();

    if (i < texto.length) {
      return { ok: false, error: `Sobra «${texto.slice(i)}»` };
    }
    if (!Number.isFinite(valor)) {
      return { ok: false, error: "El resultado no es un número" };
    }

    return { ok: true, valor };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Expresión inválida",
    };
  }
}

/**
 * Formatea un resultado para mostrarlo.
 *
 * Con separador de miles, porque esto se usa para sumar plata de Albion y
 * `12456789` es ilegible de un vistazo mientras alguien te dicta números.
 */
export function formatear(valor: number): string {
  if (Number.isInteger(valor)) return valor.toLocaleString("es-AR");
  return valor.toLocaleString("es-AR", { maximumFractionDigits: 6 });
}
