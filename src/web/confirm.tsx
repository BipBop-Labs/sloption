import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Pinta el botón como destructivo y le da el foco al de cancelar. */
  destructive?: boolean;
}

/** Pregunta y espera la respuesta. Devuelve false si se cancela o se cierra. */
type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask>(async () => false);

/** Una confirmación para todas las acciones que no se pueden deshacer solas.
 *  Cada sitio que borra o archiva pide lo mismo y se ve igual. */
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const settle = useRef<((confirmed: boolean) => void) | null>(null);

  const ask = useCallback<Ask>(
    (next) =>
      new Promise((resolve) => {
        // Si ya había una pregunta abierta, la anterior se cancela.
        settle.current?.(false);
        settle.current = resolve;
        setOptions(next);
      }),
    [],
  );

  useEffect(() => {
    if (options) dialog.current?.showModal();
  }, [options]);

  function answer(confirmed: boolean) {
    settle.current?.(confirmed);
    settle.current = null;
    dialog.current?.close();
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {options && (
        <dialog
          ref={dialog}
          className="confirm-dialog"
          aria-labelledby="confirm-title"
          // Escape y clic fuera cuentan como cancelar, nunca como confirmar.
          onCancel={(event) => {
            event.preventDefault();
            answer(false);
          }}
          onClose={() => answer(false)}
        >
          <h2 id="confirm-title">{options.title}</h2>
          {options.message && <p>{options.message}</p>}
          <div className="confirm-actions">
            <button onClick={() => answer(false)} autoFocus>
              Cancelar
            </button>
            <button
              className={options.destructive ? "danger" : "primary"}
              onClick={() => answer(true)}
            >
              {options.confirmLabel}
            </button>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}
