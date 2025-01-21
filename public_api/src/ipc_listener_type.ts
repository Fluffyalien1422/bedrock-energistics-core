/**
 * @internal
 */
export const CREATED_LISTENER_PREFIX = "__BECAPI";

/**
 * @internal
 */
export enum IpcListenerType {
  MachineUpdateUiHandler,
  MachineRecieveHandler,
  MachineOnButtonPressedEvent,
  MachineNetworkStatEvent,
  ItemMachineGetIoHandler,
  ItemMachineOnStorageSetEvent,
}
