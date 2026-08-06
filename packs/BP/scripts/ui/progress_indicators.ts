/**
 * The progress indicator element: one container slot showing a frame of an
 * animation, e.g. a furnace's arrow or flame, for a value the machine reports.
 */

import {
  UiProgressIndicatorElementDefinition,
  UiProgressIndicatorPreset,
} from "@/public_api/src";
import { Container, ItemStack, Player } from "@minecraft/server";
import { isUiItem } from "../data";
import { logWarn } from "../log";
import { tryCreateItemStack } from "../utils/item";
import { clearUiItemsFromPlayer } from "./ui_items";

const PROGRESS_INDICATOR_PRESET_MAX_VALUES: Record<
  UiProgressIndicatorPreset,
  number
> = {
  arrow: 16,
  flame: 13,
};

/**
 * Renders a progress indicator (e.g. an arrow or flame) at its frame
 * for `value`. Presets have a fixed frame count; custom indicators list their
 * frames. An out-of-range or non-integer value renders the error item.
 */
export function handleProgressIndicator(
  inventory: Container,
  element: UiProgressIndicatorElementDefinition,
  player: Player,
  value = 0,
): void {
  const indicator = element.indicator;
  const indicatorIsPreset = typeof indicator === "string";
  // The highest value that can be rendered, inclusive. The preset table already
  // stores it that way, but a custom indicator's frames are indexed by the
  // value, so its last usable value is one less than the frame count.
  const maxValue = indicatorIsPreset
    ? PROGRESS_INDICATOR_PRESET_MAX_VALUES[indicator]
    : indicator.frames.length - 1;
  const invalidValue =
    value < 0 || value > maxValue || !Number.isInteger(value);

  const inventoryItem = inventory.getItem(element.index);
  if (!inventoryItem || !isUiItem(inventoryItem)) {
    clearUiItemsFromPlayer(player);

    if (inventoryItem) {
      player.dimension.spawnItem(inventoryItem, player.location);
    }
  }

  if (invalidValue) {
    logWarn(
      `Failed to update progress indicator for machine UI. Expected 'value' to be an integer between 0 and ${maxValue.toString()} (inclusive) but got ${value.toString()}.`,
    );
    inventory.setItem(
      element.index,
      new ItemStack("fluffyalien_energisticscore:ui_error"),
    );
    return;
  }

  if (indicatorIsPreset) {
    inventory.setItem(
      element.index,
      new ItemStack(
        `fluffyalien_energisticscore:ui_prog_${indicator}${value.toString()}`,
      ),
    );
    return;
  }

  const item = tryCreateItemStack(indicator.frames[value]);
  if (!item || !isUiItem(item)) {
    logWarn(
      `Failed to create progress indicator element. The item '${indicator.frames[value]}' does not have the 'fluffyalien_energisticscore:ui_item' tag or does not exist.`,
    );
    inventory.setItem(
      element.index,
      new ItemStack("fluffyalien_energisticscore:ui_error"),
    );
    return;
  }

  inventory.setItem(element.index, item);
}
