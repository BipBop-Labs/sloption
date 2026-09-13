/** Iconos de línea, heredan color y tamaño del texto. Se agregan cuando se
 *  usan: no hay una librería entera esperando. */
import "./Icon.css";
const paths = {
  archive: "M3 6h18M5 6v13h14V6M9 11h6",
  restore: "M3 6h18M5 6v13h14V6M12 15V9m0 0-2.5 2.5M12 9l2.5 2.5",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M9 7V5h6v2M6 7v13h12V7M10 11v5M14 11v5",
  board: "M4 5h16v14H4zM10 5v14M16 5v14",
  history: "M3 12a9 9 0 1 0 2.6-6.4M3 4v4.5h4.5M12 7.5V12l3 2",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  exit: "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M20 12h-9m9 0-3-3m3 3-3 3",
  menu: "M4 7h16M4 12h16M4 17h16",
  copy: "M9 9h11v11H9zM15 9V4H4v11h5",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
