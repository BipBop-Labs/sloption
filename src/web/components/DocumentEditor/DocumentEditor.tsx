import "./DocumentEditor.css";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { action, errorMessage, queryClient } from "@/web/lib/api";
import type { Card } from "@/core/model";
import { FilePicker } from "@/web/ui";

const decode = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const encode = (value: Uint8Array) => {
  let text = "";
  for (const byte of value) text += String.fromCharCode(byte);
  return btoa(text);
};
export default function DocumentEditor({
  card,
  onError,
  onPendingChange,
}: {
  card: Card;
  onError(message: string): void;
  onPendingChange(pending: boolean): void;
}) {
  const [doc] = useState(() => {
    const doc = new Y.Doc();
    if (card.document) Y.applyUpdate(doc, decode(card.document));
    return doc;
  });
  const [pending, setPending] = useState(false);
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);
  const [failed, setFailed] = useState(false);
  const saveRef = useRef<() => void>(() => {});
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Image,
      Collaboration.configure({ document: doc }),
    ],
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Contenido de la tarjeta",
        class: "document-editor",
      },
    },
  });
  useEffect(() => {
    if (card.document) Y.applyUpdate(doc, decode(card.document), "remote");
  }, [card.document, doc]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let saving = false;
    let dirty = false;
    let disposed = false;
    const save = async () => {
      if (saving || !dirty) return;
      saving = true;
      dirty = false;
      setPending(true);
      try {
        const result = await action<Card>("document.apply", {
          id: card.id,
          update: encode(Y.encodeStateAsUpdate(doc)),
        });
        if (!disposed) {
          queryClient.setQueryData(["card", card.id], result);
          setFailed(false);
        }
      } catch (error) {
        dirty = true;
        if (!disposed) {
          setFailed(true);
          onError(errorMessage(error));
        }
      } finally {
        saving = false;
        if (!disposed) setPending(dirty);
      }
    };
    saveRef.current = () => {
      void save();
    };
    const listener = (_update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      dirty = true;
      setPending(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        void save();
      }, 300);
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || saving) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    doc.on("update", listener);
    const interval = setInterval(() => {
      if (dirty && !saving) void save();
    }, 2000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(interval);
      doc.off("update", listener);
      window.removeEventListener("beforeunload", warn);
      if (dirty) void save();
    };
  }, [card.id, doc, onError]);
  async function upload(file: File) {
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const result = await action<{ url: string }>("asset.create", {
        name: file.name,
        mime: file.type,
        content: encode(buffer),
      });
      editor
        ?.chain()
        .focus()
        .setImage({ src: result.url, alt: file.name })
        .run();
    } catch (error) {
      onError(errorMessage(error));
    }
  }
  return (
    <section className="editor-shell">
      <div className="editor-toolbar" aria-label="Formato">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-label="Negrita"
        >
          <b>B</b>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-label="Cursiva"
        >
          <i>I</i>
        </button>
        <button
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          Título
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          Lista
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          Lista numerada
        </button>
        <FilePicker
          accept="image/png,image/jpeg,image/gif,image/webp"
          onPick={(file) => void upload(file)}
        >
          Imagen
        </FilePicker>
        <span aria-live="polite">{pending ? "Guardando…" : "Guardado"}</span>
        {failed && (
          <button onClick={() => saveRef.current()}>Reintentar</button>
        )}
      </div>
      <EditorContent editor={editor} />
    </section>
  );
}
