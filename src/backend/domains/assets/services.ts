import type { Deps, Tx } from "../kernel";
import type { Asset } from "./model";

export const byId = (tx: Tx, assetId: string) => tx.get("assets", assetId);

export async function create(tx: Tx, deps: Deps, input: Omit<Asset, "id">) {
  const asset = { id: deps.newId(), ...input };
  await tx.put("assets", asset);
  return asset;
}
