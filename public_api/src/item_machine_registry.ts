import { ipcSend } from "./ipc_wrapper.js";
import { RegisteredItemMachineData } from "./item_machine_registry_internal.js";
import { ItemMachineDefinition } from "./item_machine_registry_types.js";
import { raise } from "./log.js";
import { isRegistrationAllowed } from "./registration_allowed.js";

/**
 * Registers an item machine. This function should be called in the `worldInitialize` after event.
 * @beta
 * @throws Throws if registration has been closed.
 */
export function registerItemMachine(definition: ItemMachineDefinition): void {
  if (!isRegistrationAllowed()) {
    raise(
      `Attempted to register item machine '${definition.description.id}' after registration was closed.`,
    );
  }

  const payload: RegisteredItemMachineData = {
    id: definition.description.id,
    maxStorage: definition.description.maxStorage,
    loreDisplay: definition.description.loreDisplay,
  };

  ipcSend("fluffyalien_energisticscore:ipc.registerItemMachine", payload);
}
