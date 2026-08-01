/**
 * A machine's UI is the container of its backing entity (see machine.ts). Each
 * UI element (storage bar, item slot, progress indicator, button) occupies one
 * or more container slots and is (re)rendered from the machine's current state
 * on every UI update. Filler slots hold tagged "UI items" so real items placed
 * by the player can be told apart and removed.
 */

import {
  MachineItemStack,
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
  UiButtonElementUpdateOptions,
  UiItemSlotElementDefinition,
  UiProgressIndicatorElementDefinition,
  UiProgressIndicatorPreset,
  UiStorageBarElementUpdateOptions,
  MACHINE_ENTITY_NO_UPDATE_UI_TAG,
} from "@/public_api/src";
import {
  Block,
  Container,
  DimensionLocation,
  Entity,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";
import {
  getBlockUniqueId,
  getMachineSlotItem,
  getMachineStorage,
  isUiItem,
  optionalMachineItemStackToItemStack,
  setMachineSlotItem,
} from "./data";
import { getMachineEntityBlockUniqueId } from "@/public_api/src/machine_data_internal";
import { logWarn, raise } from "./log";
import {
  getMachineIdFromEntityId,
  InternalRegisteredMachine,
} from "./machine_registry";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import { tryCreateItemStack } from "./utils/item";

export const PROGRESS_INDICATOR_PRESET_MAX_VALUES: Record<
  UiProgressIndicatorPreset,
  number
> = {
  arrow: 16,
  flame: 13,
};

const STORAGE_TYPE_COLOR_TO_FORMATTING_CODE: Record<
  StorageTypeTexturePreset,
  string
> = {
  black: "8",
  orange: "6",
  pink: "d",
  purple: "u",
  red: "4",
  yellow: "e",
  blue: "9",
  white: "f",
  green: "2",
};

/**
 * The machine UIs that are currently open.
 *
 * key = block uid (see getBlockUniqueId)
 * value = the machine entity and the last player to open it
 */
const openMachineUis = new Map<string, { entity: Entity; player: Player }>();

/**
 * key = block uid (see getBlockUniqueId)
 * value = set of item slot element IDs whose stored item changed out of band
 */
const machineChangedItemSlots = new Map<string, Set<string>>();

/**
 * Records that a machine's stored item for `slotId` changed outside of the UI,
 * so that the next item slot pass pushes the new contents into the container.
 * @remarks
 * A change is only recorded while the machine's UI is open. The flag has no
 * other consumer, and a UI seeds every slot from the block when it opens, so a
 * flag set while the UI was closed would never be read. Skipping it also keeps
 * this map from growing without bound for machines that are only ever driven by
 * automation and never opened.
 */
export function recordItemSlotChange(uid: string, slotId: string): void {
  if (!openMachineUis.has(uid)) return;

  const existingChangedItemSlots = machineChangedItemSlots.get(uid);
  if (existingChangedItemSlots) {
    existingChangedItemSlots.add(slotId);
    return;
  }

  machineChangedItemSlots.set(uid, new Set([slotId]));
}

/** Drops every recorded item slot change for a machine. */
export function clearItemSlotChanges(uid: string): void {
  machineChangedItemSlots.delete(uid);
}

/**
 * Removes any leftover UI item from the player's cursor or inventory. Only the
 * first one found is removed, since at most one UI item can leak per
 * interaction (the player can only take one slot at a time); the
 * playerInventoryItemChange handler sweeps up anything else.
 */
function clearUiItemsFromPlayer(player: Player): void {
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

/** Fills a storage bar's slots with the greyed-out "disabled" segment. */
function fillDisabledUiBar(
  inventory: Container,
  startIndex: number,
  label?: string,
): void {
  const itemStack = new ItemStack(
    "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
  );
  itemStack.nameTag = "§r" + (label ?? "Disabled");

  inventory.setItem(startIndex, itemStack);
  inventory.setItem(startIndex + 1, itemStack);
  inventory.setItem(startIndex + 2, itemStack);
  inventory.setItem(startIndex + 3, itemStack);
}

/**
 * Renders a filled storage bar across `size` slots. A bar has `size * 16`
 * pips total; each slot shows 0-16 of them via a per-count segment item
 * (`<baseId><count>`). The fill amount is converted to a pip count and laid out
 * from the bottom slot up. Every segment shares one name tag showing the label
 * (or the `amount/maxStorage` readout) tinted with the storage type's colour.
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
  label?: string,
): void {
  // How many 1/16 pips are filled in total, across all slots of the bar.
  let remainingSegments = Math.floor(amount / (maxStorage / (size * 16)));

  const formattingCodes = "§r§" + labelColorCode.split("").join("§");
  const nameTag =
    formattingCodes +
    (label ?? `${amount.toString()}/${maxStorage.toString()} ${name}`);

  for (let i = startIndex + (size - 1); i >= startIndex; i--) {
    const segments = Math.min(16, remainingSegments);
    remainingSegments -= segments;

    const segmentId = segmentItemBaseId + segments.toString();

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
 */
function handleBarItems(
  location: DimensionLocation,
  inventory: Container,
  startIndex: number,
  player: Player,
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
    fillDisabledUiBar(inventory, startIndex, label);
    return;
  }

  const storageTypeOptions =
    InternalRegisteredStorageType.forceGetInternal(type);

  const texture = textureOverride ?? storageTypeOptions.texture;
  const usesCustomTexture = typeof texture === "object";

  fillUiBar(
    usesCustomTexture
      ? texture.baseId
      : `fluffyalien_energisticscore:ui_storage_bar_segment_${texture}`,
    usesCustomTexture
      ? (texture.formattingCode ?? "f")
      : STORAGE_TYPE_COLOR_TO_FORMATTING_CODE[texture],
    storageTypeOptions.name,
    inventory,
    getMachineStorage(location, type),
    startIndex,
    maxStorage,
    size,
    label,
  );
}

/**
 * Block -> UI: overwrites the container slot with the block's stored item. Used
 * when the stored item is authoritative, i.e. on init or after an out-of-band
 * change.
 */
function pushItemSlotToContainer(
  block: Block,
  inventory: Container,
  elementId: string,
  element: UiItemSlotElementDefinition,
): void {
  inventory.setItem(
    element.index,
    optionalMachineItemStackToItemStack(
      getMachineSlotItem(block, elementId),
      element.emptyItemId,
    ),
  );
}

/**
 * UI -> block: writes whatever the player left in the container slot back to
 * the block, rejecting disallowed items (spawned back to the player) and
 * ignoring UI filler items. Used when the container is the source of truth,
 * i.e. whenever the stored item has not changed out of band.
 */
function syncItemSlotToBlock(
  block: Block,
  inventory: Container,
  elementId: string,
  element: UiItemSlotElementDefinition,
  player: Player,
): void {
  const expectedMachineItem = getMachineSlotItem(block, elementId);

  const containerSlot = inventory.getSlot(element.index);

  // An empty slot means the player took the item out; clear the stored item and
  // drop the empty-slot placeholder back in.
  if (!containerSlot.hasItem()) {
    clearUiItemsFromPlayer(player);
    setMachineSlotItem(block, elementId, undefined, false);
    containerSlot.setItem(
      optionalMachineItemStackToItemStack(undefined, element.emptyItemId),
    );
    return;
  }

  const containerSlotItemStack = containerSlot.getItem()!;
  // Empty-but-showing-a-placeholder: nothing stored and the slot holds filler.
  if (!expectedMachineItem && isUiItem(containerSlotItemStack)) return;
  const containerSlotMachineItemStack = MachineItemStack.fromItemStack(
    containerSlotItemStack,
  );

  // Same item as stored: only the amount can differ (player added/removed some
  // of the stack), so just sync the count.
  if (
    expectedMachineItem &&
    containerSlotMachineItemStack.isSimilarTo(expectedMachineItem)
  ) {
    if (containerSlot.amount !== expectedMachineItem.amount) {
      setMachineSlotItem(
        block,
        elementId,
        expectedMachineItem.withAmount(containerSlot.amount),
        false,
      );
    }

    return;
  }

  clearUiItemsFromPlayer(player);

  const isAllowed =
    element.allowedItems?.includes(containerSlot.typeId) ?? true;
  if (!isAllowed) {
    setMachineSlotItem(block, elementId, undefined, false);
    player.dimension.spawnItem(containerSlot.getItem()!, player.location);
    containerSlot.setItem(
      optionalMachineItemStackToItemStack(undefined, element.emptyItemId),
    );
    return;
  }

  if (isUiItem(containerSlotItemStack)) {
    return;
  }
  setMachineSlotItem(block, elementId, containerSlotMachineItemStack, false);
}

/**
 * Reconciles every item slot element of a machine between the block's stored
 * items and its UI container.
 * @remarks
 * Deliberately synchronous, and deliberately not part of
 * {@link renderEntityUi}. Item slots take nothing from the machine's `updateUi`
 * handler, and that handler is awaited over IPC for several ticks. Reconciling
 * them behind that await left a window in which the player could take an item
 * out and have it pushed back in from the block, duplicating it - and, because
 * {@link updateEntityUi} skips a redraw while one is already in flight, item
 * slots were not synced at all for the duration of the await.
 * @param init `true` for the first pass when the UI opens, which seeds the slots
 * from the block rather than reading them from the container.
 */
function updateItemSlots(entity: Entity, player: Player, init: boolean): void {
  if (entity.hasTag(MACHINE_ENTITY_NO_UPDATE_UI_TAG)) return;

  const machineId = getMachineIdFromEntityId(entity.typeId);
  if (!machineId) return;

  const definition = InternalRegisteredMachine.forceGetInternal(machineId);
  if (!definition.uiElements) return;

  // Unlike renderEntityUi, a missing or unexpected block is not raised on here.
  // This also runs from the update interval and from the machine data IPC
  // listeners, where the chunk having unloaded is a normal condition rather
  // than a bug.
  const block = entity.dimension.getBlock(entity.location);
  if (block?.typeId !== definition.id) return;

  const uid = getBlockUniqueId(block);

  // Every slot is seeded from the block on init, so any recorded change is
  // about to be rendered regardless of which slot it belongs to.
  if (init) machineChangedItemSlots.delete(uid);

  const changedSlots = machineChangedItemSlots.get(uid);
  const inventory = entity.getComponent("inventory")!.container;

  for (const [id, options] of definition.uiElements) {
    if (options.type !== "itemSlot") continue;

    // The changed flag is consumed as it is handled, rather than clearing the
    // whole block's flags afterwards, so that a change recorded for a slot this
    // pass didn't reach can't be dropped without being rendered.
    if (init || changedSlots?.delete(id)) {
      pushItemSlotToContainer(block, inventory, id, options);
      continue;
    }

    syncItemSlotToBlock(block, inventory, id, options, player);
  }

  if (changedSlots && !changedSlots.size) machineChangedItemSlots.delete(uid);
}

/**
 * Writes any edit the player has made to a machine's open UI container back
 * into the block's item slot storage, so that a read or write of that storage
 * sees the machine's actual current contents.
 * @remarks
 * A machine's stored items lag its container: a player's edit only reaches the
 * block on the next item slot pass, up to an update interval later. Anything
 * reading or writing that storage from outside the UI - the machine data IPC
 * listeners, for dependent add-ons - would otherwise be working from contents
 * the player has already changed.
 *
 * Does nothing if the machine's UI isn't open, in which case its stored items
 * are already current.
 */
export function flushItemSlotsFromContainer(block: Block): void {
  const uid = getBlockUniqueId(block);

  const ui = openMachineUis.get(uid);
  if (!ui?.entity.isValid || !ui.player.isValid) return;

  const definition = InternalRegisteredMachine.getInternal(block.typeId);
  if (!definition?.uiElements) return;

  // The block may have been replaced since the UI was opened, in which case the
  // open container belongs to a different machine than the one being written to
  // and its slots don't correspond to this machine's elements.
  if (ui.entity.typeId !== definition.entityId) return;

  const changedSlots = machineChangedItemSlots.get(uid);
  const inventory = ui.entity.getComponent("inventory")!.container;

  for (const [id, options] of definition.uiElements) {
    if (options.type !== "itemSlot") continue;

    // A flagged slot holds a change the machine made that the container hasn't
    // rendered yet, so the container's contents are the stale side there.
    // Syncing them back would undo that pending change.
    if (changedSlots?.has(id)) continue;

    syncItemSlotToBlock(block, inventory, id, options, ui.player);
  }
}

/**
 * Renders a progress indicator (e.g. an arrow or flame) at its frame
 * for `value`. Presets have a fixed frame count; custom indicators list their
 * frames. An out-of-range or non-integer value renders the error item.
 */
function handleProgressIndicator(
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
        `fluffyalien_energisticscore:ui_progress_${indicator}${value.toString()}`,
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

/**
 * Renders a button element and detects presses. A press is inferred when the
 * button item is missing or has been swapped for a non-button item (the player
 * "took" it): the machine's `onButtonPressed` event fires and the button item
 * is restored. On init the button is simply placed.
 */
function handleButton(
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

/**
 * Entities whose UI is currently being redrawn.
 * @see {@link updateEntityUi}
 */
const entitiesUpdatingUi = new Set<Entity>();

/**
 * Redraws a machine's UI, skipping the redraw if one is already in progress for
 * this entity.
 * @remarks
 * {@link renderEntityUi} awaits the machine's `updateUi` handler over IPC,
 * which can span several ticks, so the update interval can fire again before
 * the previous redraw has finished. Letting two interleave would draw each
 * element twice from two different `updateUi` results.
 *
 * Nothing is lost by skipping a redraw. Every element this draws is rendered
 * from the machine's current state, so the next redraw produces the same result
 * the skipped one would have. Item slots, the one part of the UI a player can
 * write to, are not drawn here at all - see {@link updateItemSlots}.
 * @see {@link renderEntityUi}
 */
async function updateEntityUi(
  definition: InternalRegisteredMachine,
  entity: Entity,
  player: Player,
  init: boolean,
): Promise<void> {
  if (entitiesUpdatingUi.has(entity)) return;

  entitiesUpdatingUi.add(entity);
  try {
    await renderEntityUi(definition, entity, player, init);
  } finally {
    entitiesUpdatingUi.delete(entity);
  }
}

/**
 * Redraws a machine's storage bars, progress indicators and buttons into its
 * entity container. Calls the machine's optional `updateUi` handler (over IPC)
 * for dynamic per-element options, then dispatches each configured element to
 * its handler.
 * @remarks
 * Call {@link updateEntityUi} instead of this, so that concurrent redraws of
 * the same entity are prevented.
 *
 * Item slots are not drawn here; {@link updateItemSlots} handles them
 * synchronously, off the `updateUi` await.
 * @param init `true` for the first draw when the UI opens, which places button
 * items rather than treating a missing one as a press.
 */
async function renderEntityUi(
  definition: InternalRegisteredMachine,
  entity: Entity,
  player: Player,
  init: boolean,
): Promise<void> {
  if (entity.hasTag(MACHINE_ENTITY_NO_UPDATE_UI_TAG)) {
    return;
  }

  if (!definition.uiElements) {
    raise(
      `Failed to update UI for entity '${entity.typeId}' (machine: '${definition.id}'). It does not have 'description.ui' defined.`,
    );
  }

  const block = entity.dimension.getBlock(entity.location);
  if (block?.typeId !== definition.id) {
    raise(
      `Failed to update UI for entity '${entity.typeId}' (machine: '${definition.id}'). The machine block does not exist or is not the expected block type.`,
    );
  }

  const updateUiResult = definition.hasCallback("updateUi")
    ? await definition.invokeUpdateUiHandler(block, entity.id)
    : null;

  // ensure the entity is still valid after invoking updateUi
  if (!entity.isValid) {
    return;
  }

  const progressIndicators = updateUiResult?.progressIndicators ?? {};
  const buttons = updateUiResult?.buttons ?? {};
  const storageBars = updateUiResult?.storageBars ?? {};

  const inventory = entity.getComponent("inventory")!.container;

  for (const [id, options] of definition.uiElements) {
    switch (options.type) {
      case "storageBar": {
        const updateOptions = storageBars[id] as
          UiStorageBarElementUpdateOptions | undefined;

        handleBarItems(
          block,
          inventory,
          options.startIndex,
          player,
          options.size,
          updateOptions?.max ?? options.defaults?.max ?? definition.maxStorage,
          updateOptions?.type ?? options.defaults?.type,
          updateOptions?.label ?? options.defaults?.label,
          updateOptions?.textureOverride ?? options.defaults?.textureOverride,
        );
        break;
      }
      case "itemSlot":
        // handled synchronously by updateItemSlots
        break;
      case "progressIndicator":
        handleProgressIndicator(
          inventory,
          options,
          player,
          progressIndicators[id],
        );
        break;
      case "button": {
        const updateOptions = buttons[id] as
          UiButtonElementUpdateOptions | undefined;

        const itemId =
          updateOptions?.itemId ??
          options.defaults?.itemId ??
          "fluffyalien_energisticscore:ui_empty_slot";
        const itemName = updateOptions?.name ?? options.defaults?.name;

        handleButton(
          inventory,
          definition,
          block,
          id,
          options.index,
          entity,
          player,
          itemId,
          init,
          itemName,
        );

        break;
      }
    }
  }
}

// A machine's UI is its entity's container. Track the player who opened it so
// the interval below can keep the UI up to date, and stop tracking as soon as
// the container closes. The Minecraft engine-side filters ensure the callbacks only run
// for machine entities opened by a player, avoiding per-event checks in script.
world.afterEvents.entityContainerOpened.subscribe(
  (e) => {
    const entity = e.entity;
    const player = e.openSource.entity as Player;

    const machineId = getMachineIdFromEntityId(entity.typeId);
    if (!machineId) {
      raise(
        `The entity '${entity.typeId}' has the 'fluffyalien_energisticscore:machine_entity' type family but it is not attached to a machine block.`,
      );
    }

    openMachineUis.set(getMachineEntityBlockUniqueId(entity), {
      entity,
      player,
    });

    const definition = InternalRegisteredMachine.forceGetInternal(machineId);

    // Seed the item slots synchronously, in the same tick the container opens,
    // so the player cannot take an item out before the seeding overwrites the
    // slot with the block's stored item. updateEntityUi awaits the machine's
    // 'updateUi' handler over IPC, which can span several ticks.
    updateItemSlots(entity, player, true);
    void updateEntityUi(definition, entity, player, true);
  },
  {
    entityFilter: {
      families: ["fluffyalien_energisticscore:machine_entity"],
    },
    accessSourceFilter: {
      entityFilter: { type: "minecraft:player" },
    },
  },
);

world.afterEvents.entityContainerClosed.subscribe(
  (e) => {
    const entity = e.entity;

    // Identifying the machine means reading the entity's location, which throws
    // if it is no longer valid - destroying a machine whose UI is open closes
    // the container exactly that way. Nothing is leaked by giving up here: the
    // update interval drops the registry entry once it notices the entity has
    // gone, and there is no longer a container to sync back from anyway.
    if (!entity.isValid) return;

    const uid = getMachineEntityBlockUniqueId(entity);
    const player = openMachineUis.get(uid)?.player;
    openMachineUis.delete(uid);

    // Run one final update so the machine captures anything the player did
    // right before closing: an item slot change (only synced back to the block
    // during an update) or a button press (inferred from the button item being
    // missing during a redraw). The periodic interval may not have run between
    // the player's last action and the container closing.
    if (player?.isValid) {
      updateItemSlots(entity, player, false);

      const machineId = getMachineIdFromEntityId(entity.typeId);
      if (machineId) {
        void updateEntityUi(
          InternalRegisteredMachine.forceGetInternal(machineId),
          entity,
          player,
          false,
        );
      }
    }

    // Anything left over is for a UI that no longer exists. Dropped after the
    // final pass, so that a slot the machine changed but the container hasn't
    // rendered yet is still pushed rather than synced back from stale contents.
    clearItemSlotChanges(uid);
  },
  {
    entityFilter: {
      families: ["fluffyalien_energisticscore:machine_entity"],
    },
  },
);

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

system.runInterval(() => {
  for (const [uid, { entity, player }] of openMachineUis) {
    // entityContainerClosed handles the common case, but the entity may despawn
    // (non-persistent machines) or the player may leave while the UI is open, so
    // drop any stale entries here as well.
    if (
      !entity.isValid ||
      !player.isValid ||
      entity.hasTag(MACHINE_ENTITY_NO_UPDATE_UI_TAG)
    ) {
      openMachineUis.delete(uid);
      clearItemSlotChanges(uid);
      continue;
    }

    const machineId = getMachineIdFromEntityId(entity.typeId)!;
    const definition = InternalRegisteredMachine.forceGetInternal(machineId);

    updateItemSlots(entity, player, false);
    void updateEntityUi(definition, entity, player, false);
  }
}, 4);
