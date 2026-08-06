/**
 * The button element: one container slot holding a button item. There is no
 * "click" to listen for in a container, so a press is inferred from the player
 * having picked the item up.
 */

import {
  Container,
  DimensionLocation,
  Entity,
  ItemStack,
  Player,
} from "@minecraft/server";
import { isUiItem } from "../data";
import { logWarn } from "../log";
import { InternalRegisteredMachine } from "../machine_registry";
import { tryCreateItemStack } from "../utils/item";
import { clearUiItemsFromPlayer } from "./ui_items";

/**
 * Renders a button element and detects presses. A press is inferred when the
 * button item is missing or has been swapped for a non-button item (the player
 * "took" it): the machine's `onButtonPressed` event fires and the button item
 * is restored. On init the button is simply placed.
 */
export function handleButton(
  inventory: Container,
  machine: InternalRegisteredMachine,
  dimensionLocation: DimensionLocation,
  elementId: string,
  index: number,
  entity: Entity,
  player: Player,
  buttonItemId: string,
  init: boolean,
  buttonItemName?: string,
): void {
  if (init) {
    const item = tryCreateItemStack(buttonItemId);
    if (!item || !isUiItem(item)) {
      logWarn(
        `Failed to create button element. The button item '${buttonItemId}' does not have the 'fluffyalien_energisticscore:ui_item' tag or does not exist.`,
      );
      inventory.setItem(
        index,
        new ItemStack("fluffyalien_energisticscore:ui_error"),
      );
      return;
    }

    item.nameTag = buttonItemName;
    inventory.setItem(index, item);
    return;
  }

  const inventoryItem = inventory.getItem(index);
  if (inventoryItem?.typeId === buttonItemId) {
    return;
  }

  if (!inventoryItem || !isUiItem(inventoryItem)) {
    clearUiItemsFromPlayer(player);

    if (inventoryItem) {
      player.dimension.spawnItem(inventoryItem, player.location);
    }

    if (machine.hasCallback("onButtonPressed")) {
      machine.callOnButtonPressedEvent(
        dimensionLocation,
        entity.id,
        player.id,
        elementId,
      );
    }
  }

  let btnItem = tryCreateItemStack(buttonItemId);
  if (btnItem && isUiItem(btnItem)) {
    btnItem.nameTag = buttonItemName;
  } else {
    btnItem = new ItemStack("fluffyalien_energisticscore:ui_error");
  }
  inventory.setItem(index, btnItem);
}
