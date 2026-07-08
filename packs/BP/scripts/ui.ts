import {
  MachineItemStack,
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
  UiButtonElementUpdateOptions,
  UiItemSlotElementDefinition,
  UiProgressIndicatorElementDefinition,
  UiProgressIndicatorPreset,
  UiStorageBarElementUpdateOptions,
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
import { logWarn, raise } from "./utils/log";
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
 * key = machine entity
 * value = last player in UI
 */
const playersInUi = new Map<Entity, Player>();

/**
 * key = block uid (see getBlockUniqueId)
 * value = array of slot IDs that have changed
 */
export const machineChangedItemSlots = new Map<string, Set<string>>();

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

function handleItemSlot(
  block: Block,
  inventory: Container,
  elementId: string,
  element: UiItemSlotElementDefinition,
  player: Player,
  init: boolean,
): void {
  const expectedMachineItem = getMachineSlotItem(block, elementId);

  const changedSlots = machineChangedItemSlots.get(getBlockUniqueId(block));
  const slotChanged = changedSlots?.has(elementId);

  const containerSlot = inventory.getSlot(element.index);

  if (slotChanged || init) {
    containerSlot.setItem(
      optionalMachineItemStackToItemStack(
        expectedMachineItem,
        element.emptyItemId,
      ),
    );
    return;
  }

  if (!containerSlot.hasItem()) {
    clearUiItemsFromPlayer(player);
    setMachineSlotItem(block, elementId, undefined, false);
    containerSlot.setItem(
      optionalMachineItemStackToItemStack(undefined, element.emptyItemId),
    );
    return;
  }

  const containerSlotItemStack = containerSlot.getItem()!;
  if (!expectedMachineItem && isUiItem(containerSlotItemStack)) return;
  const containerSlotMachineItemStack = MachineItemStack.fromItemStack(
    containerSlotItemStack,
  );

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

function handleProgressIndicator(
  inventory: Container,
  element: UiProgressIndicatorElementDefinition,
  player: Player,
  value = 0,
): void {
  const indicator = element.indicator;
  const indicatorIsPreset = typeof indicator === "string";
  const maxValue = indicatorIsPreset
    ? PROGRESS_INDICATOR_PRESET_MAX_VALUES[indicator]
    : indicator.frames.length;
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

async function updateEntityUi(
  definition: InternalRegisteredMachine,
  entity: Entity,
  player: Player,
  init: boolean,
): Promise<void> {
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

  const uid = getBlockUniqueId(block);

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
          | UiStorageBarElementUpdateOptions
          | undefined;

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
        handleItemSlot(block, inventory, id, options, player, init);
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
          | UiButtonElementUpdateOptions
          | undefined;

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

  machineChangedItemSlots.delete(uid);
}

// A machine's UI is its entity's container. Track the player who opened it so
// the interval below can keep the UI up to date, and stop tracking as soon as
// the container closes. The engine-side filters ensure the callbacks only run
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

    playersInUi.set(entity, player);
    const definition = InternalRegisteredMachine.forceGetInternal(machineId);
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
    const player = playersInUi.get(entity);
    playersInUi.delete(entity);

    // Run one final UI update so the machine block captures any item-slot change
    // the player made right before closing. Item slots are only synced back to
    // the block during a UI update, and the periodic interval may not have run
    // between the player's last action and the container closing.
    if (!player?.isValid || !entity.isValid) return;

    const machineId = getMachineIdFromEntityId(entity.typeId);
    if (!machineId) return;

    const definition = InternalRegisteredMachine.forceGetInternal(machineId);
    void updateEntityUi(definition, entity, player, false);
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
  for (const [entity, player] of playersInUi) {
    // entityContainerClosed handles the common case, but the entity may despawn
    // (non-persistent machines) or the player may leave while the UI is open, so
    // drop any stale entries here as well.
    if (!entity.isValid || !player.isValid) {
      playersInUi.delete(entity);
      continue;
    }

    const machineId = getMachineIdFromEntityId(entity.typeId)!;
    const definition = InternalRegisteredMachine.forceGetInternal(machineId);

    void updateEntityUi(definition, entity, player, false);
  }
}, 5);
