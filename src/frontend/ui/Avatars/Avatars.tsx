/** Iniciales de las personas elegidas. Recibe la lista completa porque el
 *  valor guardado son ids, no nombres. Sin fotos: no hay de dónde sacarlas. */
import "./Avatars.css";
export function Avatars({
  ids,
  people,
}: {
  ids: string[];
  people: { id: string; name: string }[];
}) {
  return (
    <span className="avatars">
      {ids.map((id) => {
        const person = people.find((person) => person.id === id);
        return (
          <span className="avatar" key={id} title={person?.name}>
            {person?.name.slice(0, 1)}
          </span>
        );
      })}
    </span>
  );
}
