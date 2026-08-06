/**
 * Which machine UIs are open, and how to reach the container behind one. A
 * machine's UI is the inventory of its backing entity (see machine.ts), so
 * anything that draws or reads a UI needs both of these.
 */

import { Container, Entity, Player } from "@minecraft/server";
import { logWarn } from "../log";

/**
 * The machine UIs that are currently open.
 *
 * key = block uid (see getBlockUniqueId)
 * value = the machine entity and the last player to open it
 */
export const openMachineUis = new Map<
  string,
  { entity: Entity; player: Player }
>();

/**
 * The container that backs a machine's UI, or `undefined` if the machine entity
 * doesn't have one.
 * @remarks
 * A machine entity is defined by the add-on that registered the machine, so an
 * entity without an inventory component is that add-on's mistake. There is no
 * UI to update without a container, so callers skip the entity; warn rather
 * than throw, since this runs every update tick.
 */
export function getMachineUiContainer(entity: Entity): Container | undefined {
  const container = entity.getComponent("inventory")?.container;
  if (!container) {
    logWarn(
      `Failed to update UI for the machine entity '${entity.typeId}'. It does not have an inventory component with a container.`,
    );
  }
  return container;
}
