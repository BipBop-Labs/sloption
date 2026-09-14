import { implement } from "../kernel";
import { AssetUploaded, AssetViewed } from "./events";
import { assetsRouter } from "./router";
import * as assets from "./services";

export const assetsOrchestrator = implement(assetsRouter, {
  async create(input, { tx, deps }) {
    const asset = await assets.create(tx, deps, input);
    return {
      output: { id: asset.id, url: `/api/assets/${asset.id}` },
      event: AssetUploaded({
        assetId: asset.id,
        mime: asset.mime,
        name: asset.name,
      }),
    };
  },
  async read(_input, { resource }) {
    return { output: resource, event: AssetViewed({ assetId: resource.id }) };
  },
});
