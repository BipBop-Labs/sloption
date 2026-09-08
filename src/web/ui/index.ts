/** Las primitivas de UI. Antes de escribir un control nuevo, mirá acá: si ya
 *  existe se reusa, y si falta algo se agrega acá, no suelto en una página.
 *  Ninguna conoce el dominio: la lógica la pone la página que las consume. */
export { Avatars } from "./Avatars";
export { Button } from "./Button";
export { Chip, chipColor } from "./Chip";
export { Composer } from "./Composer";
export { DropdownSelect, type Choice } from "./DropdownSelect";
export { DropSlot } from "./DropSlot";
export { FilePicker } from "./FilePicker";
export { Icon, type IconName } from "./Icon";
export { Modal } from "./Modal";
export { Toast } from "./Toast";
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
} from "./ConfirmProvider";
