/** Iconos de línea, heredan color y tamaño del texto. Se agregan cuando se
 *  usan: no hay una librería entera esperando. */
const paths = {
  archive: "M3 6h18M5 6v13h14V6M9 11h6",
  restore: "M3 6h18M5 6v13h14V6M12 15V9m0 0-2.5 2.5M12 9l2.5 2.5",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M9 7V5h6v2M6 7v13h12V7M10 11v5M14 11v5",
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
