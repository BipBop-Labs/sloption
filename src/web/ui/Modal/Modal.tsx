import "./Modal.css";
import { useEffect, useRef } from "react";

/** Un `<dialog>` modal: se abre al montarse, devuelve el foco a donde estaba al
 *  cerrarse, y Escape avisa en vez de cerrar por su cuenta — quien lo usa puede
 *  tener algo sin guardar. El contenido es libre. */
export function Modal({
  className,
  label,
  onClose,
  children,
}: {
  className?: string;
  label?: string;
  onClose(): void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={className}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
