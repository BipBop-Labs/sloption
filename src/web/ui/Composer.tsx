/** El campo de "agregar uno más" al pie de una columna o de un grupo. Qué se
 *  crea con el texto lo decide quien lo usa; acá solo se escribe y se envía.
 *
 *  Si `onSubmit` falla, el texto se queda para reintentar en vez de perderse. */
export function Composer({
  label,
  submitLabel,
  placeholder = "+ Nueva tarea",
  onSubmit,
}: {
  label: string;
  submitLabel: string;
  placeholder?: string;
  onSubmit(title: string): void | Promise<void>;
}) {
  return (
    <form
      className="new-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const title = String(new FormData(form).get("title") ?? "").trim();
        if (!title) return;
        try {
          await onSubmit(title);
          form.reset();
        } catch {
          // Quien lo usa ya avisó del error; acá solo se conserva el texto.
        }
      }}
    >
      <input
        name="title"
        aria-label={label}
        placeholder={placeholder}
        required
      />
      <button aria-label={submitLabel}>↵</button>
    </form>
  );
}
