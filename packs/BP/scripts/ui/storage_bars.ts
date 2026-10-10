/**
 * The storage bar element: a vertical gauge, several container slots tall,
 * showing how much of one storage type a machine holds.
 */

import {
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
} from "@/public_api/src";
import { fitItemNameTag } from "@/public_api/src/name_tag_internal";
import {
  Container,
  DimensionLocation,
  ItemStack,
  Player,
} from "@minecraft/server";
import { getMachineStorage, isUiItem } from "../data";
import { logWarn } from "../log";
import { InternalRegisteredStorageType } from "../storage_type_registry";
import { tryCreateItemStack } from "../utils/item";
import { clearUiItemsFromPlayer } from "./ui_items";

/**
 * How many fill levels one slot of a bar has when its texture doesn't say. This
 * is what the built-in textures use: they are 16 pixels tall and fill a pixel
 * at a time.
 */
const DEFAULT_BAR_SEGMENTS = 16;

const STORAGE_TYPE_COLOR_TO_FORMATTING_CODE: Record<
  StorageTypeTexturePreset,
  string
> = {
  ammonia: "g",
  black: "8",
  blue: "1",
  carbon: "4",
  energy: "e",
  green: "2",
  hydrogen: "w",
  lava: "v",
  liquid_exp: "a",
  nitrogen: "u",
  oil: "t",
  orange: "v",
  oxygen: "f",
  pink: "d",
  purple: "u",
  red: "4",
  steam: "7",
  water: "9",
  white: "f",
  yellow: "6",
};

/** Fills a storage bar's slots with the greyed-out "disabled" segment. */
function fillDisabledUiBar(
  inventory: Container,
  startIndex: number,
  size: number,
  elementDescription: string,
  label?: string,
): void {
  const itemStack = new ItemStack(
    "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
  );
  itemStack.nameTag = fitItemNameTag(
    "§r" + (label ?? "Disabled"),
    elementDescription,
    logWarn,
  );

  for (let i = startIndex; i < startIndex + size; i++) {
    inventory.setItem(i, itemStack);
  }
}

/**
 * Renders a filled storage bar across `size` slots. A bar has
 * `size * segmentsPerSlot` pips total; each slot shows `0` to
 * `segmentsPerSlot` of them via a per-count segment item (`<baseId><count>`).
 * The fill amount is converted to a pip count and laid out from the bottom slot
 * up. Every segment shares one name tag showing the label (or the
 * `amount/maxStorage` readout) tinted with the storage type's colour.
 */
function fillUiBar(
  segmentItemBaseId: string,
  labelColorCode: string,
  name: string,
  inventory: Container,
  amount: number,
  startIndex: number,
  maxStorage: number,
  size: number,
  segmentsPerSlot: number,
  elementDescription: string,
  label?: string,
): void {
  // How many pips are filled in total, across all slots of the bar.
  let remainingSegments = Math.floor(
    amount / (maxStorage / (size * segmentsPerSlot)),
  );

  // The label, the storage type's name and the colour code all come from
  // add-ons, so any of them can make this too long to set.
  const formattingCodes = "§r§" + labelColorCode.split("").join("§");
  const nameTag = fitItemNameTag(
    formattingCodes +
      (label ?? `${amount.toString()}/${maxStorage.toString()} ${name}`),
    elementDescription,
    logWarn,
  );

  for (let i = startIndex + (size - 1); i >= startIndex; i--) {
    const filledSegments = Math.min(segmentsPerSlot, remainingSegments);
    remainingSegments -= filledSegments;

    const segmentId = segmentItemBaseId + filledSegments.toString();

    let itemStack =
      tryCreateItemStack(
        segmentId,
        undefined,
        `Failed to create storage bar segment element (Item ID: '${segmentId}')`,
      ) ??
      new ItemStack(
        "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
      );

    if (!isUiItem(itemStack)) {
      logWarn(
        `Failed to create storage bar segment element. The item '${segmentId}' does not have the 'fluffyalien_energisticscore:ui_item' tag.`,
      );
      itemStack = new ItemStack(
        "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
      );
    }

    itemStack.nameTag = nameTag;

    inventory.setItem(i, itemStack);
  }
}

/**
 * Renders a storage bar element: reclaims any real item a player slipped into
 * the bar's slots, then draws either the disabled bar or the type's filled bar.
 * The special type `"_disabled"` draws the greyed-out bar.
 * @param elementDescription Names the element in warnings.
 */
export function handleBarItems(
  location: DimensionLocation,
  inventory: Container,
  startIndex: number,
  player: Player,
  elementDescription: string,
  size = 4,
  maxStorage: number,
  type = "_disabled",
  label?: string,
  textureOverride?: StorageTypeTextureDescription | StorageTypeTexturePreset,
): void {
  // If any bar slot holds something that isn't a UI item, the player managed to
  // drop a real item in - give it back and clear it before redrawing. One stray
  // item is enough to trigger the cleanup, hence the break.
  for (let i = startIndex; i < startIndex + size; i++) {
    const inventoryItem = inventory.getItem(i);
    if (inventoryItem && isUiItem(inventoryItem)) {
      continue;
    }

    clearUiItemsFromPlayer(player);

    if (inventoryItem) {
      player.dimension.spawnItem(inventoryItem, player.location);
    }

    break;
  }

  if (type === "_disabled") {
    fillDisabledUiBar(inventory, startIndex, size, elementDescription, label);
    return;
  }

  const storageTypeOptions =
    InternalRegisteredStorageType.forceGetInternal(type);

  const texture = textureOverride ?? storageTypeOptions.texture;
  const usesCustomTexture = typeof texture === "object";

  fillUiBar(
    usesCustomTexture
      ? texture.baseId
      : `fluffyalien_energisticscore:ui_sbar_seg_${texture}`,
    usesCustomTexture
      ? (texture.formattingCode ?? "f")
      : STORAGE_TYPE_COLOR_TO_FORMATTING_CODE[texture],
    storageTypeOptions.name,
    inventory,
    getMachineStorage(location, type),
    startIndex,
    maxStorage,
    size,
    // The presets are all generated at the default resolution.
    usesCustomTexture
      ? (texture.segments ?? DEFAULT_BAR_SEGMENTS)
      : DEFAULT_BAR_SEGMENTS,
    elementDescription,
    label,
  );
}
