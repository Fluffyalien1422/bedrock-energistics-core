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

/**
 * The machine UIs that are currently open.
 *
 * key = block uid (see getBlockUniqueId)
 * value = the machine entity and the last player to open it
 */
const openMachineUis = new Map<string, { entity: Entity; player: Player }>();

/**
 * Shows a machine's new stored item for `slotId` in its open UI right away.
 * Call after writing the new contents.
 * @remarks
 * Doing this as part of the write, rather than leaving it to the next update
 * tick, is what keeps a machine and a player from both laying claim to the same
 * items. A container showing an amount the machine has already changed lets the
 * player take items that are no longer there, or take fewer than they can see;
 * either way the two disagree about what happened and reconciling them
 * afterwards cannot always be done without inventing or destroying items.
 *
 * Push immediately and there is nothing to reconcile. Whatever the player does
 * next, they do to the machine's current contents, so the container already
 * holds the combined result and {@link syncItemSlotToBlock} just writes it back.
 *
 * Does nothing if the machine's UI isn't open, since then there is no container
 * for the player to act on and none for this to correct. A UI seeds every slot
 * from the block as it opens.
 */
export function showItemSlotChange(block: Block, slotId: string): void {
  const ui = openMachineUis.get(getBlockUniqueId(block));
  if (!ui?.entity.isValid) return;
  if (ui.entity.hasTag(MACHINE_ENTITY_NO_UPDATE_UI_TAG)) return;

  const definition = InternalRegisteredMachine.getInternal(block.typeId);
  if (!definition) return;

  // The block may have been replaced since the UI was opened, in which case the
  // open container belongs to a different machine and its slots don't
  // correspond to this machine's elements.
  if (ui.entity.typeId !== definition.entityId) return;

  const element = definition.uiElements?.get(slotId);
  if (element?.type !== "itemSlot") return;

  const inventory = getMachineUiContainer(ui.entity);
  if (!inventory) return;

  pushItemSlotToContainer(block, inventory, slotId, element);
}

/**
 * The container that backs a machine's UI, or `undefined` if the machine entity
 * doesn't have one.
 * @remarks
 * A machine entity is defined by the add-on that registered the machine, so an
 * entity without an inventory component is that add-on's mistake. There is no
 * UI to update without a container, so callers skip the entity; warn rather
 * than throw, since this runs every update tick.
 */
function getMachineUiContainer(entity: Entity): Container | undefined {
  const container = entity.getComponent("inventory")?.container;
  if (!container) {
    logWarn(
      `Failed to update UI for the machine entity '${entity.typeId}'. It does not have an inventory component with a container.`,
    );
  }
  return container;
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
    label,
  );
}

/**
 * Block -> UI: overwrites the container slot with the block's stored item. Used
 * when the stored item is authoritative, i.e. as the UI opens and as a machine
 * changes a slot.
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
 * ignoring UI filler items. Used whenever the UI is open and past its first
 * pass, since the container is the source of truth from then on.
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
    setMachineSlotItem(block, elementId, undefined, {
      showInUi: false,
    });
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
        { showInUi: false },
      );
    }

    return;
  }

  clearUiItemsFromPlayer(player);

  const isAllowed =
    element.allowedItems?.includes(containerSlot.typeId) ?? true;
  if (!isAllowed) {
    setMachineSlotItem(block, elementId, undefined, {
      showInUi: false,
    });
    player.dimension.spawnItem(containerSlot.getItem()!, player.location);
    containerSlot.setItem(
      optionalMachineItemStackToItemStack(undefined, element.emptyItemId),
    );
    return;
  }

  if (isUiItem(containerSlotItemStack)) {
    return;
  }
  setMachineSlotItem(block, elementId, containerSlotMachineItemStack, {
    showInUi: false,
  });
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
 *
 * Outside of the first pass the container is taken as the source of truth, never
 * overwritten from the block. It can be, because a machine's own changes are
 * already shown in it as they are made (see {@link showItemSlotChange}), so
 * whatever is in a slot is what the machine put there plus whatever the player
 * did to it - which is exactly what the block should be storing.
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

  const inventory = getMachineUiContainer(entity);
  if (!inventory) return;

  for (const [id, options] of definition.uiElements) {
    if (options.type !== "itemSlot") continue;

    if (init) {
      pushItemSlotToContainer(block, inventory, id, options);
      continue;
    }

    syncItemSlotToBlock(block, inventory, id, options, player);
  }
}

/**
 * Brings a machine's stored item slots and its open UI container into agreement,
 * so that a read or write of that storage sees the machine's actual current
 * contents.
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
  const ui = openMachineUis.get(getBlockUniqueId(block));
  if (!ui?.entity.isValid || !ui.player.isValid) return;

  // Identical to what an update tick does, so there is no separate pass here:
  // running one early is exactly what "flush" means. updateItemSlots resolves
  // the machine from the entity and checks the block still matches it, which
  // also covers the block having been replaced since the UI was opened.
  updateItemSlots(ui.entity, ui.player, false);
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

  const inventory = getMachineUiContainer(entity);
  if (!inventory) return;

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
      continue;
    }

    const machineId = getMachineIdFromEntityId(entity.typeId)!;
    const definition = InternalRegisteredMachine.forceGetInternal(machineId);

    updateItemSlots(entity, player, false);
    void updateEntityUi(definition, entity, player, false);
  }
}, 4);
