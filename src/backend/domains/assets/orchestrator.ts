import { implement } from "../kernel";
import { assetsRouter } from "./router";
import * as assets from "./services";

export const assetsOrchestrator = implement(assetsRouter, {
  async create(input, { tx, deps }) {
    const asset = await assets.create(tx, deps, input);
    return {
      output: { id: asset.id, url: `/api/assets/${asset.id}` },
      event: { assetId: asset.id, mime: asset.mime, name: asset.name },
    };
  },
  async read(_input, { resource }) {
    return { output: resource, event: { entityId: resource.id } };
  },
});
