import "./SettingRow.css";

/** Una fila de configuración: a la izquierda qué se está configurando, a la
 *  derecha con qué se cambia. No sabe qué hay adentro — un texto y un dropdown,
 *  un input y un botón, lo que sea. Existe para que las pantallas de
 *  configuración se lean como una lista y no como seis maquetados distintos. */
export function SettingRow({ children }: { children: React.ReactNode }) {
  return <div className="setting-row">{children}</div>;
}
