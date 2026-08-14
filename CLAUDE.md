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

**Al terminar cualquier tanda de trabajo, revisar que no quede nada corriendo**
(`ps -eo pid,args | grep -E "next|node|sleep"`) y matar lo propio. Ya pasó dos
veces que quedaran procesos colgados y los tuviera que señalar Marcos.

### El bucle de espera que nunca termina

No usar `pgrep -f` para esperar a que termine un proceso propio:

```bash
# MAL: el bucle se encuentra a sí mismo y espera para siempre.
until ! pgrep -f "mi-script.mts"; do sleep 15; done
```

`pgrep -f` busca en la línea de comando completa de todos los procesos,
incluida la del propio bucle, que contiene ese mismo texto. El bucle nunca
termina, aunque el proceso real haya terminado hace rato.

Para esperar a algo que se lanzó en segundo plano, usar la notificación de la
herramienta, que llega sola cuando el comando sale. Si hace falta un bucle,
esperar por un efecto observable —un archivo que aparece, un puerto que
responde— y no por la ausencia de un proceso.
