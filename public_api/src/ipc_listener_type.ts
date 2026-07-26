/**
 * @internal
 */
export enum IpcListenerType {
  MachineUpdateUiHandler,
  MachineReceiveHandler,
  MachineOnButtonPressedEvent,
  MachineNetworkStatEvent,
  MachineOnStorageSetEvent,
  ItemMachineGetIoHandler,
  ItemMachineOnStorageSetEvent,
}

/**
 * @internal
 */
export function makeIpcListenerName(id: string, type: IpcListenerType): string {
  const [namespace, shortId] = id.split(/:(.*)/);
  return `${namespace}:BECAPI${type.toString(36)}${shortId}`;
}
