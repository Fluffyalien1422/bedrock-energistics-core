/**
 * UI items are the tagged filler items a machine's UI is drawn out of - storage
 * bar segments, progress indicator frames, buttons, empty slot placeholders.
 * They only mean anything inside a machine's container, so everything here is
 * about keeping them from escaping into a player's inventory or the world.
 */

import { Player, world } from "@minecraft/server";
import { isUiItem } from "../data";

/**
 * Removes any leftover UI item from the player's cursor or inventory. Only the
 * first one found is removed, since at most one UI item can leak per
 * interaction (the player can only take one slot at a time); the
 * playerInventoryItemChange handler below sweeps up anything else.
 */
export function clearUiItemsFromPlayer(player: Player): void {
  const playerCursorInventory = player.getComponent("cursor_inventory")!;
  if (playerCursorInventory.item && isUiItem(playerCursorInventory.item)) {
    playerCursorInventory.clear();
    return;
  }

  const playerInventory = player.getComponent("inventory")!.container;
  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerInventory.getItem(i);

    if (item && isUiItem(item)) {
      playerInventory.setItem(i);
      return;
    }
  }
}

world.afterEvents.entitySpawn.subscribe((e) => {
  if (e.entity.typeId !== "minecraft:item" || !e.entity.isValid) return;

  const itemStack = e.entity.getComponent("item")!.itemStack;

  if (isUiItem(itemStack)) {
    e.entity.remove();
  }
});

world.afterEvents.playerInventoryItemChange.subscribe((e) => {
  if (!e.itemStack || !isUiItem(e.itemStack)) return;
  e.player.getComponent("inventory")?.container.setItem(e.slot);
});
