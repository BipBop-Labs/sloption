/** Etiqueta de color. El color sale del id, no de quien la usa: la misma
 *  opción se ve igual en el tablero, en la lista y en el dropdown.
 *
 *  `variant="highlight"` la pinta con el color de énfasis en vez de con uno
 *  derivado del id: es para la que hay que mirar antes que al resto. No
 *  escribas la clase a mano. */
export function chipColor(id: string) {
  let hash = 0;
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}
export function Chip({
  children,
  color,
  variant,
}: {
  children: React.ReactNode;
  color?: number;
  variant?: "highlight";
}) {
  return (
    <span
      className={variant ? `chip chip-${variant}` : "chip"}
      data-color={color}
    >
      {children}
    </span>
  );
}
