/** El hueco que se abre donde caería lo que se arrastra. Mide lo mismo que la
 *  pieza levantada, así el resto no se corre al soltarla. Lo usan el arrastre
 *  de tarjetas y el de columnas: si se dibujaran por separado, se irían
 *  despegando. */
import "./DropSlot.css";
export function DropSlot({
  height,
  width,
}: {
  height: number;
  width?: number;
}) {
  return (
    <div
      className="drop-slot"
      style={
        width === undefined ? { height } : { flex: `0 0 ${width}px`, height }
      }
    />
  );
}
