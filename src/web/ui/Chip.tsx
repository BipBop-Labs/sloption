/** Etiqueta de color. El color sale del id, no de quien la usa: la misma
 *  opción se ve igual en el tablero, en la lista y en el dropdown. */
export function chipColor(id: string) {
  let hash = 0;
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}
export function Chip({
  children,
  color,
  weekly = false,
}: {
  children: React.ReactNode;
  color?: number;
  weekly?: boolean;
}) {
  return (
    <span className={`chip${weekly ? " chip-week" : ""}`} data-color={color}>
      {children}
    </span>
  );
}
