/** Elegir un archivo con cara de botón. El `<input type="file">` no se puede
 *  maquillar, así que va escondido dentro del `<label>`: el label ya lo activa
 *  con teclado y con lector de pantalla, y `sr-only` lo esconde sin sacarlo del
 *  foco como haría `display: none`. */
export function FilePicker({
  children,
  accept,
  onPick,
}: {
  children: React.ReactNode;
  accept: string;
  onPick(file: File): void;
}) {
  return (
    <label className="button">
      {children}
      <input
        className="sr-only"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
