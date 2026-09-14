import { raise } from "../../lib/errors";
import type { Field } from "../fields/model";
import type { Tx } from "../kernel";
import { boardErrors } from "./errors";
import type { Board } from "./model";

/** Hoy hay un solo tablero. Con varios por organización, esto recibe el id. */
export async function requireMain(tx: Tx) {
  return (await tx.get("boards", "main")) ?? raise(boardErrors, "BOARD_NOT_FOUND");
}

export async function first(tx: Tx) {
  return (await tx.list("boards"))[0] ?? null;
}

export async function groupBy(tx: Tx, board: Board, field: Field) {
  if (field.type !== "select") raise(boardErrors, "GROUPING_NOT_SELECT");
  board.groupingId = field.id;
  await tx.put("boards", board);
  return board;
}
