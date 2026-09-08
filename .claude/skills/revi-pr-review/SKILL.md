---
name: pr-review
description: Pauta de review de PRs de Revi, destilada de cientos de comentarios reales del equipo en revi-mono. Úsala siempre que haya que revisar una PR, un diff, una rama o cambios locales de un repo de Revi ("revisa mi PR", "dale una pasada a este diff", "qué comentarios le harías"), y también como autorevisión antes de abrir una PR propia. Aplica aunque no pidan la pauta por su nombre.
---

# Pauta de review de PRs (Revi)

Checklist generalizada a partir de los comentarios de review que el equipo ha
dejado en PRs de `ia-revi/revi-mono` (257 comentarios de Emerson y Juan hasta
2026-09-01). Cada ítem es un patrón que ya generó al menos un comentario real;
entre paréntesis van los PRs de revi-mono donde apareció, por si se necesita el
contexto original.

## Cómo aplicar la pauta

1. Leer el diff completo antes de comentar. Los ítems de "Alcance e higiene"
   se evalúan mirando la PR entera, no archivo por archivo.
2. Recorrer las categorías y quedarse solo con hallazgos reales del diff. La
   pauta dice qué mirar, no obliga a comentar algo de cada categoría.
3. No comentar lo que un linter o formatter ya atrapa; para eso está el
   pre-commit.
4. Reportar cada hallazgo con: archivo y línea, qué ítem de la pauta aplica,
   por qué importa aquí, y una sugerencia concreta. Separar lo bloqueante de
   lo opcional.
5. En caso de duda de diseño (profundidad de módulos, interfaces, errores),
   complementar con la skill `ousterhout-software-design`; esta pauta es el
   destilado local, esa es la teoría.

El tono de los comentarios: directo y breve, como los originales. Preguntar
("¿por qué necesitamos esto?") es un comentario válido cuando el código no se
explica solo.

## Arquitectura y capas

- Routers delgados: nada de lógica de negocio, queries ni orquestación en los
  routers; todo eso vive en un service y el router queda con la forma HTTP
  (#418, #423, #438, #456, #492, #497, #517, #582)
- Lógica transversal (auth, checks por request) va en un middleware o
  dependency, no repetida en handlers (#582)
- Comportamiento propio de un modelo va como método del modelo, no como helper
  suelto en un service (#582)
- Los imports de un router delatan su acoplamiento: si un router genérico
  importa muchas cosas de un feature específico, la lógica está mal ubicada
  (#423, #438)
- Usar las dependencies centralizadas que ya existen (por ejemplo `get_db`) en
  vez de manejar recursos a mano (#14)
- Todo texto dirigido al LLM (system prompts, fragmentos, mensajes de error de
  tools, mensajes de retry) vive en el dir/módulo de prompts
  (`prompt_templates`), cada prompt en su archivo, nunca inline en la lógica
  (#198, #351, #423, #437, #458, #477, #580)
- Helpers compartidos entre módulos van a un módulo propio y liviano; no
  duplicar el mismo fix ni la misma dependency en dos lugares (#94, #490, #408)
- No usar funciones privadas (`_foo`) de otro módulo; si se necesita afuera,
  promoverla a API pública del módulo correcto (#198)
- Una query dentro de una tool solo se justifica si es un builder que corre una
  vez; si corre en cada invocación, el dato viene de afuera como parámetro
  (#580)
- Los side effects de negocio los aplica el backend (por ejemplo revertir
  estado al borrar un acta), no los orquesta el frontend con múltiples llamadas
  (#576)
- No definir funciones dentro de funciones; extraer los cuerpos de if/else
  largos a funciones con nombre descriptivo (#433, #437)
- Shallow functions prohibidas: una función que solo delega o envuelve una
  línea no paga su costo de interfaz (#582)
- Evitar imports anidados dentro de funciones (#437)
- Si una función pertenece conceptualmente a una clase, que sea método de la
  clase (#437)
- Pasos que "hay que acordarse de hacer" se encapsulan en una función para que
  no dependan de la memoria de nadie (#430)

## Tipado y contratos

- Nada de strings pelados para estados, kinds, keys o categorías: usar enums
  (y sus items, no los strings), y antes de crear uno buscar si ya existe en el
  codebase (#131, #139, #433, #437, #457, #476, #479, #497, #517)
- Nada de dicts crudos ni tuples como contrato: payloads, responses y retornos
  multivalor van con pydantic model, TypedDict o dataclass; lo explícito es más
  fácil para nosotros y para cualquier LLM (#27, #351, #433, #480, #482, #497,
  #576)
- Lo que llega del frontend (resume de HITL, inputs) se wrapea en un pydantic
  para que quede claro su origen y su forma (#198, #433)
- Tipar de verdad: `Any` y `str` para todo no cuenta como tipado (#433)
- Sin números mágicos ni valores mágicos: constantes con nombre, tipos o
  metadata estructurada en vez de frozensets mágicos y sentinels dentro de
  strings (#131, #517)
- Contratos front-back consistentes: si cambia lo que se manda, cambia también
  el contrato del otro lado con el mismo nombre de campo (#172)
- Preferir timestamps sobre booleanos para estados (`reverted_at` en vez de
  `reverted`): guardan cuándo además de si (#576)
- Defaults reveladores: para campos opcionales de telemetría/metadata, un
  default falsy (None, UNKNOWN) permite detectar los llamadores que no lo
  especifican (#14)

## Comentarios y docstrings

- Comentarios económicos: si no aporta una restricción que el código no
  muestra, se borra; si es largo, se reduce a una línea (#424, #458, #497)
- Docstrings sin overexplaining: no narrar lo obvio (#437)
- Comentarios, docs y mensajes internos en inglés (#239, #482)
- Revisar comentarios que quedaron stale tras el cambio y actualizarlos en
  todos los sitios donde se repiten (#408)

## Naming y convenciones

- snake_case en el backend (PEP 8), no camelCase (#458)
- Los nombres describen qué es la cosa, no cuándo se escribió: nada de
  `new_*`, `*_initial` ni módulos con nombre confuso tras un refactor (#438,
  #492, #580)
- Nombres de flags y modos extensibles y descriptivos (un `mode` antes que
  booleanos tipo `advancedMode` que no describen qué hacen por debajo) (#458)
- Nombres confusos se cuestionan (`maybe_*`, `override`): si el nombre necesita
  explicación, se renombra o se rediseña la interfaz (#131, #426)
- Renames sin motivo no entran a la PR; si se renombra, se explica para qué
  (#198)
- Idioma según destinatario: código, ramas y comentarios en inglés; copies
  visibles al usuario en español (#458, #482, #582)

## Alcance e higiene de la PR

- Sacar de la PR todo archivo ajeno al cambio: config local
  (`.claude/launch.json`), resultados de corridas de accuracy, scripts que solo
  eran de desarrollo (#458, #480, #497, #580)
- Sin leftovers: revisar que no queden restos de lo que se movió o eliminó
  (#94, #137)
- Cada cambio debe ser trazable a una tarjeta y poder responder "¿qué ganamos
  con esto?, ¿es necesario?"; si no, se saca (#58, #64, #66, #198, #497)
- Cambios de infra fuera de alcance van en su propia PR; si la PR mezcla dos
  temas, se parte en dos (#233, #480)
- Base correcta: las PRs van contra `stg` (stg a main solo para releases);
  resolver conflictos con la base antes de pedir review (#173, #240, #267)
- Archivos muertos se borran: componentes que ya nadie importa, endpoints y
  features que quedaron obsoletos por el propio cambio (#16, #137, #580)

## Duplicación y simplicidad

- Cuando dos paths construyen lo mismo, extraer un helper para que el
  invariante no pueda driftear en silencio (#408, #440)
- Revisar prompts duplicados dentro del mismo archivo o entre secciones (#440)
- Fixes hardcodeados a un caso se reemplazan por la solución general (una
  heurística, un parámetro) (#36)
- Special cases inesperados se sacan del camino común: función aparte, o el
  llamador pasa la variante desde afuera (#131)
- Simplificar condicionales innecesarios: si un valor puede ser el default, no
  condicionarlo (#373, #580)
- No sobrecomplicar: si una capa o funcionalidad ya se acordó matar, se elimina
  completa (widget, prompt y registro incluidos) (#580)
- Sin estado redundante: no mantener `effective_X` si ya existe `X`; evaluar
  reaccionar a un evento existente en vez de agregar estado nuevo (#497)
- Reutilizar flujos existentes en vez de duplicarlos parcialmente (#576)
- Sin ifs anidados estilo hadouken; aplanar con early returns o funciones
  (#480)
- Sin queries redundantes: si un endpoint siempre hace dos queries donde basta
  una, consolidar (#351)
- Código inexplicable se cuestiona: si un dict, un bloque o un formato no se
  entiende a la primera, o se explica o se reescribe (#198, #351, #426, #480,
  #482, #497, #517, #579)
- No reimplementar a mano lo que la librería ya resuelve (retries y structured
  outputs con langchain, parsing con la lib documentada); buscar la doc antes
  de escribirlo (#94, #430)

## Migraciones, seeds y datos

- Migraciones de alembic: sin nombres duplicados y con head única coordinada
  entre PRs paralelas; dos PRs mergeadas con heads paralelas crashean el
  backend (#115)
- Backfills y correcciones de datos van como migración, no como script suelto
  que alguien tiene que acordarse de correr (#451, #576)
- Seeds consistentes con los existentes: idempotentes, con rollback en el
  except, `ON CONFLICT DO NOTHING` si corren en startup con varios workers, y
  claridad de cuándo y cómo corren en deploy (#492)
- Si un cambio depende de un paso manual de deploy (cron, variable, seed),
  dejarlo explícito en la PR; y antes de crear una variable de entorno,
  verificar si ya existe en el repo o en Coolify (#492, #582)
- Formato de datos según su naturaleza: datos generados por herramienta y
  validados por contrato pueden ir en JSON; lo que se edita a mano sigue el
  patrón `.py` del resto del codebase (#580)

## Tests

- Probar que los tests realmente corren antes de pedir review; dependencias de
  test declaradas (#27)
- Los tests viven en el directorio de tests, no junto al código (#433)
- Al mover lógica entre capas, mover el bloque entero: partir una transacción
  entre router y service puede romper el fix de concurrencia y los tests
  seguirían en verde (#492)
- En deletes y cascadas, verificar que no falte ningún cascade (#576)

## Roles y permisos

- Cubrir todos los roles de usuario en cada flujo nuevo (DOM, asistente, etc.):
  definir qué pasa con cada uno, idealmente resuelto en el backend (#77, #373)
- Flags de features en la entidad correcta: por usuario sirve para el piloto,
  pero al escalar debe poder activarse a nivel de municipalidad (#418)

## Frontend y UX

- Responsive verificado en mobile: sin scroll horizontal, sin elementos que se
  pisan ni descuadres en viewports chicos (#267)
- Consistencia entre elementos gemelos: mismos verbos, mismos iconos y mismo
  estilo en CTAs equivalentes (#267)
- Contraste y visibilidad: nada de logos anulados por filtros ni paneles del
  mismo color que su contenido (#267)
- Un rediseño se aplica consistente en todas las páginas por las que navega el
  usuario, no solo en la principal (#267)
- No perder de vista conversiones y mensajes clave: CTAs importantes visibles,
  componentes que comunican valor no se eliminan sin reemplazo (#267)
- Los copies los revisa quien es dueño del tono antes de mergear (#582)

## Prompts (contenido)

- Ejemplos de prompt que no overfiteen: o sin ejemplo, o un ejemplo que
  describe la forma en vez de un caso concreto sesgado (#580)
- Las reglas de negocio en el prompt deben estar completas: si un flujo (por
  ejemplo un HITL) tiene condiciones de activación, todas quedan escritas
  (#433)
- No inventar taxonomías en los prompts: las clasificaciones internas nuestras
  no se presentan al LLM como si fueran reales (#464)
- Seguir la skill `best-prompting` (mejores prácticas de prompting del equipo,
  en `skills/best-prompting/`) para todo contenido dirigido al LLM (#351)

## Mantención de esta pauta

Cuando un comentario de review se repita y no calce en ningún ítem, agregarlo
a la categoría que corresponda con su referencia de PR. La pauta vale porque
viene de comentarios reales; mantenerla anclada a ellos.
