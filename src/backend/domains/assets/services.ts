import { eq } from "drizzle-orm";
import type { Deps, Tx } from "../kernel";
import { assets } from "./models";
import type { Asset } from "./schemas";

export async function byId(tx: Tx, assetId: string): Promise<Asset | null> {
  const [asset] = await tx.sql.select().from(assets).where(eq(assets.id, assetId));
  return asset ?? null;
}

export async function create(tx: Tx, deps: Deps, input: Omit<Asset, "id">) {
  const asset = { id: deps.newId(), ...input };
  await tx.sql.insert(assets).values(asset);
  return asset;
}
