import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { boardErrors } from "../boards/errors";
import { valueErrors } from "../fields/errors";
import { ById } from "../schemas";
import { cardErrors } from "./errors";
import {
  CardArchivedChanged,
  CardBodyEdited,
  CardCreated,
  CardMoved,
  CardUpdated,
  CardViewed,
  CardWeeklyChanged,
} from "./events";
import {
  ArchiveMark,
  Card,
  CardChanges,
  CardPlacement,
  DocumentUpdate,
  NewCard,
  WeeklyMark,
} from "./schemas";
import * as cards from "./services";

/** Toda operación sobre una tarjeta existente la carga el runner y responde NOT_FOUND. */
const card = { load: cards.byId, from: (input: { id: string }) => input.id };

export const cardsRouter = defineRouter({
  name: "cards",
  http: "/api/cards",
  cli: "cards",
  endpoints: {
    read: defineEndpoint({
      doc: "Lee una tarjeta completa: su Markdown, el documento Yjs y la version que pide cards update.",
      access: "member",
      input: ById,
      output: Card,
      scope: card,
      event: CardViewed,
    }),
    create: defineEndpoint({
      doc: "Crea una tarjeta al final del tablero.",
      access: "member",
      input: NewCard,
      output: Card,
      event: CardCreated,
      errors: valueErrors,
    }),
    update: defineEndpoint({
      doc: "Cambia título o valores. Exige la version de la última lectura; si alguien más tocó la tarjeta responde STALE_VERSION: releé y reintentá.",
      access: "member",
      input: CardChanges,
      output: Card,
      scope: card,
      event: CardUpdated,
      errors: { ...cardErrors, ...valueErrors },
    }),
    week: defineEndpoint({
      doc: "Marca o desmarca la tarjeta para esta semana.",
      access: "member",
      input: WeeklyMark,
      output: Card,
      scope: card,
      event: CardWeeklyChanged,
    }),
    archive: defineEndpoint({
      doc: "Archiva o restaura. Al archivar guarda la etapa como etiqueta; al restaurar vuelve a esa etapa si todavía existe.",
      access: "member",
      input: ArchiveMark,
      output: Card,
      scope: card,
      event: CardArchivedChanged,
      errors: boardErrors,
    }),
    move: defineEndpoint({
      doc: "Mueve la tarjeta a la columna optionId (null: sin etapa), antes de beforeId o al final.",
      access: "member",
      input: CardPlacement,
      output: Card,
      scope: card,
      event: CardMoved,
      errors: { ...cardErrors, ...valueErrors, ...boardErrors },
    }),
    applyDocument: defineEndpoint({
      doc: "Edita el cuerpo: recibe una actualización Yjs en base64 y devuelve la tarjeta con el Markdown resultante.",
      access: "member",
      input: DocumentUpdate,
      output: Card,
      scope: card,
      event: CardBodyEdited,
      errors: cardErrors,
    }),
  },
});
