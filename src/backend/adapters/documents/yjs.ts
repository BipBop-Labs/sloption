import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { MarkdownManager } from "@tiptap/markdown";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";
import type { Documents } from "../../core/ports";

const extensions = [StarterKit, Image];
const schema = getSchema(extensions);
const markdown = new MarkdownManager({ extensions });
export function initialDocument(content: string): string {
  const doc = prosemirrorJSONToYDoc(schema, markdown.parse(content), "default");
  const result = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  doc.destroy();
  return result;
}
export const documents: Documents = {
  initialize: initialDocument,
  merge(current, content, update) {
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(
        doc,
        Buffer.from(current ?? initialDocument(content), "base64"),
      );
      Y.applyUpdate(doc, Buffer.from(update, "base64"));
      const json = yDocToProsemirrorJSON(doc, "default");
      schema.nodeFromJSON(json).check();
      return {
        document: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
        markdown: markdown.serialize(json),
      };
    } finally {
      doc.destroy();
    }
  },
};
