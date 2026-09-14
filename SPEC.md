# Spec

> Qué hace y por qué. Alcance, comportamiento, decisiones.

## Qué es

**Sloption** es el back office de Revi.

Su primer trabajo — y el único en alcance ahora — es **reemplazar el tablero kanban
que hoy vivimos en Notion**, incluido el flujo de la weekly.

A futuro va a ser el back office de nuestras aplicaciones, que expondrán APIs para
hacer cosas. Eso no se construye ahora (lo toma Emerson después), pero sí condiciona
el diseño: la base tiene que quedar **extensible**, no cerrada alrededor del kanban.

## Principio rector

**Todo lo que puede hacer una persona en la web, lo puede hacer un agente por API y
por CLI.**

No es fase 2. Es la restricción que manda sobre las demás. Si una acción existe en
la interfaz y no existe como acción invocable, es un bug.

La raíz de la aplicación es: **existen acciones que se ejecutan, y eventos que se
emiten.** Todo lo demás — la UI, la API, la CLI, los webhooks — cuelga de ahí.

Consecuencias:

- La UI no tiene lógica propia. Es un cliente más del mismo núcleo, sin atajos ni
  caminos privilegiados.
- No hay mutaciones "solo de frontend". Nada de estado que solo viva en el cliente y
  que un agente no pueda leer ni cambiar.
- Toda acción es nombrable y parametrizable: nombre estable, input tipado, output
  tipado, errores explícitos.
- Una persona y un agente se autentican distinto pero **autorizan igual**: mismos
  permisos, mismas reglas, mismos eventos.

**Test de aceptación:** tomar cualquier flujo de la UI y reproducirlo completo desde
la CLI, sin navegador. Si no se puede, falta acción.

## Acciones

Toda operación del sistema es una acción. Una acción:

1. Tiene nombre estable y parámetros tipados.
2. Es invocable desde la UI, desde la API HTTP y desde la CLI — las tres llegan a la
   misma implementación.
3. Autoriza igual sin importar por dónde entró.
4. **Declara su evento**, que emite al completarse, o declara explícitamente que no emite.

El catálogo de acciones es a la vez la superficie de la UI y la de la API. Se define
una vez.

## Eventos

Cada acción emite un evento con **esquema rígido y versionado**. Los eventos son el
mecanismo por el cual nuestros agentes reaccionan a lo que pasa en el tablero.

- Todos los eventos existen y están parametrizados. El payload lo define el dominio
  con los datos que importan: `cards.move.v1` dice desde qué columna y hacia cuál.
- **No hay historial.** Los eventos no se guardan: se consumen por webhook. Quien
  necesite conservarlos suscribe un webhook a otro servicio.
- Login y logout también emiten evento, con IP y dispositivo: una alerta de acceso es
  un webhook suscrito a `auth.login.v1`.
- **A qué eventos te suscribes es elección tuya.** No todo evento amerita un webhook
  — crear una categoría nueva no debería despertar a nadie, un cambio de estado o una
  asignación sí. Esa decisión vive en la suscripción, no en la emisión.
- El endpoint de destino y la lista de eventos suscritos se configuran desde la
  aplicación.

Casos que motivan esto: asignar una tarjeta a un agente y que ese agente se entere;
reaccionar a un cambio de estado.

## Autenticación y agentes

**BetterAuth**, por ahora **solo email + password**. Sin login social, sin magic
links, sin 2FA — pero bien configurado y prolijo, porque después crece.

Sobre eso, dos piezas que sí son parte de v1:

- **API keys.** Se crean desde tu propio usuario en la web. Con una API key, la CLI
  actúa **como vos**: tus permisos, tu identidad en los eventos.
- **Usuarios virtuales (agentes).** Un agente es un usuario más: se le asigna una
  tarjeta como a cualquiera, y esa asignación viaja por el webhook para que la lógica
  del otro lado la tome.

## El producto: el tablero

Kanban al estilo Notion. El detalle de interfaz y de interacción está en
[VISUAL.md](VISUAL.md); acá va el modelo.

### Tarjeta

Una tarjeta es **un markdown con propiedades**. Ese es el modelo, no una metáfora:

- Un cuerpo markdown libre, para el contexto que no cabe en un campo.
- Un conjunto de propiedades tipadas.

### Propiedades

- Vienen algunas de base: **prioridad**, **responsable** (admite varios).
- Se pueden **crear libremente** propiedades nuevas.
- **Las tarjetas son uniformes**: una propiedad nueva pertenece al tablero, no a una
  tarjeta. Al crearla queda disponible en todas, y asignarle valor al resto tiene que
  ser rápido. Misma lógica que Notion.
- Las propiedades de tipo categoría tienen un conjunto de valores definido.

### Columnas

Las columnas **no se definen a mano: se derivan de una propiedad de categoría.**

Ejemplo: la propiedad `Estado` con valores `Inicio`, `Cooking`, `Desarrollo`, … genera
una columna por valor. Arrastrar una tarjeta de columna a columna es exactamente
cambiarle el valor de esa propiedad. El orden manual dentro de la columna se guarda
por separado, según la aclaración posterior del usuario.

Esto mantiene el modelo chico y hace el tablero configurable sin código.

### Las dos vistas

1. **Esta semana** — las tarjetas marcadas para la semana en curso. Es la vista que
   usamos durante la weekly.
2. **Todas** — el universo completo de tarjetas, de donde se marcan las que entran a
   la semana.

## Fuera de alcance (v1)

- Login social, magic links, 2FA.
- **Ciclos / sprints.** Se conversó y se descartó: hoy no es parte del flujo de la
  weekly. La marca de "esta semana" alcanza.
- El back office extensible de las otras aplicaciones de Revi. La arquitectura tiene
  que admitirlo; la funcionalidad no se construye ahora.

## Confirmaciones de implementación — 2026-09-08

- Entrega: toda la v1, ejecutable localmente y preparada para Coolify, sin desplegar.
- Un único tablero, visible para todos. Roles de administrador y miembro común;
  las operaciones administrativas corresponden a administradores.
- Registro cerrado, invitaciones sin envío de correo y seed de administrador inicial.
- Propiedades nuevas: texto, número, fecha, selección y selección múltiple,
  sin obligatoriedad ni valores predeterminados. Eliminar una propiedad elimina sus
  valores; eliminar una opción limpia las referencias correspondientes.
- Orden manual de tarjetas y columnas. Agrupación compartida por todo el equipo.
  El orden dentro de una columna es independiente del valor que determina la columna.
- No hay edición masiva (reemplaza la expectativa anterior de completar en bloque).
- Editor visual estilo Notion con imágenes. Tarjetas archivables y restaurables.
- Cambios visibles en vivo y edición simultánea del cuerpo con Yjs.
- Todas las operaciones declaran su evento. No existe contrato previo de webhooks que
  haya que conservar. El historial consultable se retiró el 2026-09-13: guardar todo
  era demasiada data para lo que se usaba; los eventos se consumen por webhook.
- Cada usuario puede crear y revocar API keys para sus agentes, sin vencimiento ni
  restricciones de permisos de la key. Los eventos identifican al agente y al dueño.
- Importación de Notion incluida. Los documentos importados son datos, no instrucciones.
- Todo el código se escribe en inglés; la interfaz, en español.
- La marca semanal se mantiene hasta quitarla manualmente, sin reinicio por calendario.
- Se importan las 1006 tarjetas con los cuerpos disponibles, sin inventar los ausentes.
- Las identidades del export se crean como miembros. Eduardo Esquivel se excluye del seed
  y es una persona diferente de Edo.

### Aclaraciones cerradas

- Edición simultánea mediante actualizaciones Yjs, con Markdown persistido y la misma
  acción de escritura para UI, HTTP y CLI.
- Dependencias, relaciones y cálculos vinculados de Notion se omiten en v1.
- Las identidades importadas no tienen acceso hasta vincularlas con una invitación.
- Apariencia similar a shadcn, claro/oscuro persistido por usuario, tarjetas en drawer,
  selecciones dropdown y chips. Esta decisión reemplaza las restricciones visuales Dell.

- Arquitectura hexagonal y HTTP con Hono: decisión documentada en [CODE.md](CODE.md).
