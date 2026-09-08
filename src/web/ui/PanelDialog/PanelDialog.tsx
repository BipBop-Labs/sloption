import { useState } from "react";
import { Modal } from "../Modal/Modal";
import "./PanelDialog.css";

export type PanelSection = { id: string; label: string };

/** Un modal de dos paneles: a la izquierda la lista de secciones, a la derecha
 *  la que esté activa. El contenido lo pone quien lo usa — recibe el id activo
 *  y devuelve lo que va en el panel; así una sección puede aparecer o no según
 *  quién mire, sin que el modal sepa por qué. En teléfono la lista pasa a ser
 *  una tira horizontal arriba. */
export function PanelDialog({
  title,
  sections,
  onClose,
  children,
}: {
  title: string;
  sections: PanelSection[];
  onClose(): void;
  children(active: string): React.ReactNode;
}) {
  const [chosen, setChosen] = useState("");
  // Si la sección elegida desaparece de la lista, cae en la primera en vez de
  // dejar el panel en blanco.
  const active = sections.some((section) => section.id === chosen)
    ? chosen
    : sections[0]!.id;
  return (
    <Modal className="panel-dialog" label={title} onClose={onClose}>
      <div className="panel-rail">
        <div className="panel-rail-head">
          <h2>{title}</h2>
        </div>
        <nav aria-label={`Secciones de ${title.toLowerCase()}`}>
          {sections.map((section) => (
            <button
              key={section.id}
              className={
                section.id === active ? "panel-tab active" : "panel-tab"
              }
              aria-current={section.id === active ? "page" : undefined}
              onClick={() => setChosen(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="panel-content">
        <button
          className="dialog-close"
          onClick={onClose}
          aria-label={`Cerrar ${title.toLowerCase()}`}
        >
          ×
        </button>
        <div className="panel-body">{children(active)}</div>
      </div>
    </Modal>
  );
}
