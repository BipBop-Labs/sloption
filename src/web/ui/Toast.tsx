import { createPortal } from "react-dom";

/** El aviso de error. Va dentro del diálogo abierto más arriba, si hay uno:
 *  un modal tapa al resto de la página y ahí el aviso no se vería. */
export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss(): void;
}) {
  return createPortal(
    <div role="alert" className="toast">
      {message}
      <button aria-label="Cerrar mensaje" onClick={onDismiss}>
        ×
      </button>
    </div>,
    Array.from(document.querySelectorAll("dialog[open]")).at(-1) ??
      document.body,
  );
}
