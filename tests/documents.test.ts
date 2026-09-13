import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { documents, initialDocument } from "../src/backend/adapters/documents/yjs";
function fork(state: string) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(state, "base64"));
  return doc;
}
function append(doc: Y.Doc, content: string) {
  const paragraph = new Y.XmlElement("paragraph");
  const text = new Y.XmlText();
  text.insert(0, content);
  paragraph.insert(0, [text]);
  doc
    .getXmlFragment("default")
    .insert(doc.getXmlFragment("default").length, [paragraph]);
}
function update(doc: Y.Doc) {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
}
describe("collaborative document port", () => {
  it("merges concurrent edits and repeated updates without losing either author", () => {
    const initial = initialDocument("Original");
    const alice = fork(initial);
    const bob = fork(initial);
    append(alice, "Alice");
    append(bob, "Bob");
    const a = documents.merge(initial, "Original", update(alice));
    const b = documents.merge(a.document, a.markdown, update(bob));
    const repeated = documents.merge(b.document, b.markdown, update(alice));
    expect(b.markdown).toContain("Original");
    expect(b.markdown).toContain("Alice");
    expect(b.markdown).toContain("Bob");
    expect(repeated.markdown).toBe(b.markdown);
    alice.destroy();
    bob.destroy();
  });
  it("keeps Markdown formatting and embedded images through initialization", () => {
    const initial = initialDocument(
      "## Context\n\n**Important**\n\n![Example](/api/assets/example)",
    );
    const state = documents.merge(initial, "", update(fork(initial)));
    expect(state.markdown).toContain("## Context");
    expect(state.markdown).toContain("**Important**");
    expect(state.markdown).toContain("/api/assets/example");
  });
});
