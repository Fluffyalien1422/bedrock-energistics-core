import {
  MachineItemStack,
  StorageTypeColor,
  UiButtonElementUpdateOptions,
  UiItemSlotElementDefinition,
  UiProgressIndicatorElementDefinition,
  UiProgressIndicatorPreset,
  UiStorageBarElementUpdateOptions,
} from "@/public_api/src";
import {
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

const STORAGE_TYPE_COLOR_TO_FORMATTING_CODE: Record<StorageTypeColor, string> =
  {
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
export const machineChangedItemSlots = new Map<string, number[]>();

function isUiItem(item: ItemStack): boolean {
  return item.hasTag("fluffyalien_energisticscore:ui_item");
}

/**
 * @returns whether anything was cleared or not
 */
function clearUiItemsFromPlayer(player: Player): boolean {
  let anythingCleared = false;

  const playerCursorInventory = player.getComponent("cursor_inventory")!;
  if (playerCursorInventory.item && isUiItem(playerCursorInventory.item)) {
    playerCursorInventory.clear();
    anythingCleared = true;
  }

  const playerInventory = player.getComponent("inventory")!.container!;
  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerInventory.getItem(i);

    if (item && isUiItem(item)) {
      playerInventory.setItem(i);
      anythingCleared = true;
    }
  }

  return anythingCleared;
}

function fillDisabledUiBar(inventory: Container, startIndex: number): void {
  const itemStack = new ItemStack(
    "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
  );
  itemStack.nameTag = "§rDisabled";

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
  label?: string,
): void {
  // there are 4 items, each item has 16 segments, so divide by 64
  let remainingSegments = Math.floor(amount / (maxStorage / 64));

  for (let i = startIndex + 3; i >= startIndex; i--) {
    const segments = Math.min(16, remainingSegments);
    remainingSegments -= segments;

    const itemStack = new ItemStack(segmentItemBaseId + segments.toString());

    itemStack.nameTag =
      label ??
      `§r§${labelColorCode}${amount.toString()}/${maxStorage.toString()} ${name}`;

    inventory.setItem(i, itemStack);
  }
}

function handleBarItems(
  location: DimensionLocation,
  inventory: Container,
  startIndex: number,
  player: Player,
  maxStorage: number,
  type = "_disabled",
  label?: string,
): void {
  for (let i = startIndex; i < startIndex + 4; i++) {
    const inventoryItem = inventory.getItem(i);
    if (inventoryItem?.hasTag("fluffyalien_energisticscore:ui_item")) {
      continue;
    }

    clearUiItemsFromPlayer(player);

    if (inventoryItem) {
      player.dimension.spawnItem(inventoryItem, player.location);
    }

    break;
  }

  if (type === "_disabled") {
    fillDisabledUiBar(inventory, startIndex);
    return;
  }

  const storageTypeOptions =
    InternalRegisteredStorageType.forceGetInternal(type);

  fillUiBar(
    `fluffyalien_energisticscore:ui_storage_bar_segment_${storageTypeOptions.color}`,
    STORAGE_TYPE_COLOR_TO_FORMATTING_CODE[storageTypeOptions.color],
    storageTypeOptions.name,
    inventory,
    getMachineStorage(location, type),
    startIndex,
    maxStorage,
    label,
  );
}

function handleItemSlot(
  loc: DimensionLocation,
  inventory: Container,
  element: UiItemSlotElementDefinition,
  player: Player,
  init: boolean,
): void {
  const expectedMachineItem = getMachineSlotItem(loc, element.slotId);

  const changedSlots = machineChangedItemSlots.get(getBlockUniqueId(loc));
  const slotChanged = changedSlots?.includes(element.slotId);

  const containerSlot = inventory.getSlot(element.index);

  if (slotChanged || init) {
    containerSlot.setItem(
      optionalMachineItemStackToItemStack(expectedMachineItem),
    );
    return;
  }

  if (!containerSlot.hasItem()) {
    clearUiItemsFromPlayer(player);
    setMachineSlotItem(loc, element.slotId, undefined, false);
    containerSlot.setItem(optionalMachineItemStackToItemStack());
    return;
  }

  const containerSlotItemStack = containerSlot.getItem()!;
  const containerSlotMachineItemStack = MachineItemStack.fromItemStack(
    containerSlotItemStack,
  );

  if (
    expectedMachineItem &&
    containerSlotMachineItemStack.isSimilarTo(expectedMachineItem)
  ) {
    if (containerSlot.amount !== expectedMachineItem.amount) {
      setMachineSlotItem(
        loc,
        element.slotId,
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
    setMachineSlotItem(loc, element.slotId, undefined, false);
    player.dimension.spawnItem(containerSlot.getItem()!, player.location);
    containerSlot.setItem(optionalMachineItemStackToItemStack());
    return;
  }

  if (isUiItem(containerSlotItemStack)) {
    return;
  }
  setMachineSlotItem(loc, element.slotId, containerSlotMachineItemStack, false);
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
  if (!inventoryItem?.hasTag("fluffyalien_energisticscore:ui_item")) {
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
  if (!item?.hasTag("fluffyalien_energisticscore:ui_item")) {
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
    if (!item?.hasTag("fluffyalien_energisticscore:ui_item")) {
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
  if (!inventoryItem?.hasTag("fluffyalien_energisticscore:ui_item")) {
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

    let btnItem = tryCreateItemStack(buttonItemId);
    if (!btnItem?.hasTag("fluffyalien_energisticscore:ui_item")) {
      btnItem = new ItemStack("fluffyalien_energisticscore:ui_error");
    }

    btnItem.nameTag = buttonItemName;
    inventory.setItem(index, btnItem);
  }
}

async function updateEntityUi(
  definition: InternalRegisteredMachine,
  entity: Entity,
  player: Player,
  init: boolean,
): Promise<void> {
  if (!definition.uiElements) {
    raise(
      `Trying to update UI for entity '${entity.typeId}' (machine: '${definition.id}') but it does not have 'description.ui' defined.`,
    );
  }

  const dimensionLocation = {
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z),
    dimension: entity.dimension,
  };

  const updateUiResult = definition.hasCallback("updateUi")
    ? await definition.invokeUpdateUiHandler(dimensionLocation, entity.id)
    : null;

  // ensure the entity is still valid after invoking updateUi
  if (!entity.isValid()) {
    return;
  }

  const progressIndicators = updateUiResult?.progressIndicators ?? {};
  const buttons = updateUiResult?.buttons ?? {};
  const storageBars = updateUiResult?.storageBars ?? {};

  const inventory = entity.getComponent("inventory")!.container!;

  for (const id of definition.uiElements.getIds()) {
    const options = definition.uiElements.get(id)!;

    switch (options.type) {
      case "storageBar": {
        const updateOptions = storageBars[id] as
          | UiStorageBarElementUpdateOptions
          | undefined;

        handleBarItems(
          dimensionLocation,
          inventory,
          options.startIndex,
          player,
          updateOptions?.max ?? options.defaults?.max ?? definition.maxStorage,
          updateOptions?.type ?? options.defaults?.type,
          updateOptions?.label ?? options.defaults?.label,
        );
        break;
      }
      case "itemSlot":
        handleItemSlot(dimensionLocation, inventory, options, player, init);
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
          dimensionLocation,
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

  machineChangedItemSlots.clear();
}

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
  if (
    !e.target.matches({
      families: ["fluffyalien_energisticscore:machine_entity"],
    })
  ) {
    return;
  }

  const machineId = getMachineIdFromEntityId(e.target.typeId);
  if (!machineId) {
    raise(
      `The entity '${e.target.typeId}' has the 'fluffyalien_energisticscore:machine_entity' type family but it is not attached to a machine block.`,
    );
  }

  playersInUi.set(e.target, e.player);
  const definition = InternalRegisteredMachine.forceGetInternal(machineId);
  void updateEntityUi(definition, e.target, e.player, true);
});

world.afterEvents.entitySpawn.subscribe((e) => {
  if (e.entity.typeId !== "minecraft:item") return;

  const itemStack = e.entity.getComponent("item")!.itemStack;

  if (isUiItem(itemStack)) {
    e.entity.remove();
  }
});

system.runInterval(() => {
  for (const [entity, player] of playersInUi) {
    if (!entity.isValid()) {
      playersInUi.delete(entity);
      continue;
    }

    const machineId = getMachineIdFromEntityId(entity.typeId)!;
    const definition = InternalRegisteredMachine.forceGetInternal(machineId);

    if (definition.persistentEntity) {
      const players = entity.dimension.getPlayers({
        location: entity.location,
        maxDistance: 10,
      });
      if (!players.length) {
        playersInUi.delete(entity);
        continue;
      }
    }

    void updateEntityUi(definition, entity, player, false);
  }
}, 5);
