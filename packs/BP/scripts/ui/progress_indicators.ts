/**
 * The progress indicator element: one container slot showing a frame of an
 * animation, e.g. a furnace's arrow or flame, for a value the machine reports.
 * An optional label is shown as the frame's hover text.
 */

import {
  UiProgressIndicatorElementDefinition,
  UiProgressIndicatorPreset,
} from "@/public_api/src";
import { fitItemNameTag } from "@/public_api/src/name_tag_internal";
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
 * Prefix for label name tags. It resets the styling the client applies to
 * custom-named items, as storage bar labels do.
 */
const LABEL_PREFIX = "§r";

/**
 * Renders a progress indicator (e.g. an arrow or flame) at its frame
 * for `value`. Presets have a fixed frame count; custom indicators list their
 * frames. An out-of-range or non-integer value renders the error item.
 * @param elementDescription Names the element in warnings.
 * @param label Hover text for the frame, set as its name tag. Not applied to
 * the error item.
 */
export function handleProgressIndicator(
  inventory: Container,
  element: UiProgressIndicatorElementDefinition,
  player: Player,
  elementDescription: string,
  value = 0,
  label?: string,
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
    // String() rather than toString(): the value arrives over IPC as JSON, so
    // it can be null (from NaN) despite its type.
    logWarn(
      `Failed to update progress indicator for machine UI. Expected 'value' to be an integer between 0 and ${maxValue.toString()} (inclusive) but got ${String(value)}.`,
    );
    inventory.setItem(
      element.index,
      new ItemStack("fluffyalien_energisticscore:ui_error"),
    );
    return;
  }

  let item: ItemStack;
  if (indicatorIsPreset) {
    item = new ItemStack(
      `fluffyalien_energisticscore:ui_prog_${indicator}${value.toString()}`,
    );
  } else {
    const customItem = tryCreateItemStack(indicator.frames[value]);
    if (!customItem || !isUiItem(customItem)) {
      logWarn(
        `Failed to create progress indicator element. The item '${indicator.frames[value]}' does not have the 'fluffyalien_energisticscore:ui_item' tag or does not exist.`,
      );
      inventory.setItem(
        element.index,
        new ItemStack("fluffyalien_energisticscore:ui_error"),
      );
      return;
    }
    item = customItem;
  }

  if (label !== undefined) {
    item.nameTag = fitItemNameTag(
      LABEL_PREFIX + label,
      elementDescription,
      logWarn,
    );
  }

  inventory.setItem(element.index, item);
}
