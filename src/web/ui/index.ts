/** Las primitivas de UI. Antes de escribir un control nuevo, mirá acá: si ya
 *  existe se reusa, y si falta algo se agrega acá, no suelto en una página.
 *  Ninguna conoce el dominio: la lógica la pone la página que las consume. */
export { Avatars } from "./Avatars/Avatars";
export { Button } from "./Button/Button";
export { Chip, chipColor } from "./Chip/Chip";
export { Composer } from "./Composer/Composer";
export { DropdownSelect, type Choice } from "./DropdownSelect/DropdownSelect";
export { DropSlot } from "./DropSlot/DropSlot";
export { FilePicker } from "./FilePicker/FilePicker";
export { Icon, type IconName } from "./Icon/Icon";
export { Menu, MenuItem } from "./Menu/Menu";
export { Modal } from "./Modal/Modal";
export { PanelDialog, type PanelSection } from "./PanelDialog/PanelDialog";
export { SettingRow } from "./SettingRow/SettingRow";
export { Sidebar } from "./Sidebar/Sidebar";
export { SidebarUser } from "./SidebarUser/SidebarUser";
export { Toast } from "./Toast/Toast";
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
} from "./ConfirmProvider/ConfirmProvider";
