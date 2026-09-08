/** El estilo base del botón vive en styles.css sobre el elemento `button`: un
 *  `<button>` pelado ya sale bien y no necesita envoltorio. Esto solo nombra
 *  las variantes para que no anden clases sueltas por las páginas. */
export function Button({
  variant,
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "danger" }) {
  return (
    <button
      {...props}
      className={[variant, className].filter(Boolean).join(" ") || undefined}
    />
  );
}
