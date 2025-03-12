/**
 * @internal
 */
export enum BecIpcListener {
  RegisterMachine = "fluffyalien_energisticscore:ipc.registerMachine",
  RegisterStorageType = "fluffyalien_energisticscore:ipc.registerStorageType",
  RegisterItemMachine = "fluffyalien_energisticscore:ipc.registerItemMachine",
  SetMachineSlot = "fluffyalien_energisticscore:ipc.setMachineSlot",
  GetMachineSlot = "fluffyalien_energisticscore:ipc.getMachineSlot",
  DestroyNetwork = "fluffyalien_energisticscore:ipc.destroyNetwork",
  NetworkQueueSend = "fluffyalien_energisticscore:ipc.networkQueueSend",
  Generate = "fluffyalien_energisticscore:ipc.generate",
  EstablishNetwork = "fluffyalien_energisticscore:ipc.establishNetwork",
  GetNetworkWith = "fluffyalien_energisticscore:ipc.getNetworkWith",
  GetAllNetworksWith = "fluffyalien_energisticscore:ipc.getAllNetworksWith",
  GetOrEstablishNetwork = "fluffyalien_energisticscore:ipc.getOrEstablishNetwork",
  IsPartOfNetwork = "fluffyalien_energisticscore:ipc.isPartOfNetwork",
  GetRegisteredMachine = "fluffyalien_energisticscore:ipc.getRegisteredMachine",
  GetRegisteredStorageType = "fluffyalien_energisticscore:ipc.getRegisteredStorageType",
  GetRegisteredItemMachine = "fluffyalien_energisticscore:ipc.getRegisteredItemMachine",
  GetAllRegisteredStorageTypes = "fluffyalien_energisticscore:ipc.getAllRegisteredStorageTypes",
  GetNetworkLink = "fluffyalien_energisticscore:ipc.getNetworkLink",
  AddNetworkLink = "fluffyalien_energisticscore:ipc.addNetworkLink",
  RemoveNetworkLink = "fluffyalien_energisticscore:ipc.removeNetworkLink",
  DestroyNetworkLink = "fluffyalien_energisticscore:ipc.destroyNetworkLink",
  GetItemMachineStorage = "fluffyalien_energisticscore:ipc.getItemMachineStorage",
  SetItemMachineStorage = "fluffyalien_energisticscore:ipc.setItemMachineStorage",
  GetItemMachineIo = "fluffyalien_energisticscore:ipc.getItemMachineIo",
}
