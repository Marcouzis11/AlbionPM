@AGENTS.md

# Reglas de este proyecto

## Base de datos: nunca borrar ni modificar sin permiso

**No ejecutar `DELETE` ni `UPDATE` contra la base sin pedirle permiso explícito
a Marcos antes.** Vale para `psql`, para el cliente de Supabase, para scripts y
para cualquier código de prueba.

- `SELECT` e `INSERT` de datos propios: no hace falta consultar.
- Cualquier cosa que modifique o destruya datos existentes: se consulta antes,
  mostrando la sentencia exacta y el conteo de filas que afecta (correr primero
  un `SELECT` con el mismo `WHERE`).

**Por qué existe esta regla:** limpiando datos de prueba, un borrado alcanzó
filas que no eran de prueba: el usuario real de Marcos, su contenido y su
composición. No se perdió nada solo porque el filtro era por correo exacto —
fue suerte, no diseño.

**Para datos de prueba:** crearlos con un identificador propio y reconocible, y
borrarlos filtrando por ese identificador y por nada más. Nunca por "lo que
sobra", ni por rangos de fecha, ni por "el último creado". Si aparecen filas
inesperadas, frenar y preguntar.

**No hay respaldos.** El plan gratuito de Supabase no los incluye, así que un
borrado equivocado es definitivo.

## No dejar servidores corriendo

Los servidores de desarrollo o de prueba que se levanten para verificar algo
tienen que apagarse al terminar. La aplicación vive en Vercel; la máquina de
Marcos solo se usa para escribir código.
