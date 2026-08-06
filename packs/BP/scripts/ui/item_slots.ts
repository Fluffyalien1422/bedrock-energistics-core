/**
 * The item slot element: one container slot a player can put items into and
 * take them out of, backed by the machine block's stored item data.
 *
 * It is the only part of a machine's UI with two writers - the machine and the
 * player - so which of them is authoritative at any moment is the whole of the
 * problem this file solves. The rule is: the machine's changes are shown in the
 * container as they are made, and from then on the container is what the block
 * follows. See {@link showItemSlotChange} for why it has to be that way round.
 */

import {
  MachineItemStack,
  UiItemSlotElementDefinition,
  MACHINE_ENTITY_NO_UPDATE_UI_TAG,
} from "@/public_api/src";
import { getMachineEntityBlockUniqueId } from "@/public_api/src/machine_data_internal";
import { Block, Container, Entity, Player } from "@minecraft/server";
import {
  getBlockUniqueId,
  getMachineSlotItem,
  isUiItem,
  optionalMachineItemStackToItemStack,
  setMachineSlotItem,
} from "../data";
import {
  getMachineIdFromEntityId,
  InternalRegisteredMachine,
} from "../machine_registry";
import { getMachineUiContainer, openMachineUis } from "./open_uis";
import { clearUiItemsFromPlayer } from "./ui_items";

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
 * Reconciles every item slot element of a machine between the block's stored
 * items and its UI container.
 * @remarks
 * Deliberately synchronous, and deliberately not part of the machine's redraw.
 * Item slots take nothing from the machine's `updateUi` handler, and that
 * handler is awaited over IPC for several ticks. Reconciling them behind that
 * await left a window in which the player could take an item out and have it
 * pushed back in from the block, duplicating it - and, because a redraw is
 * skipped while one is already in flight, item slots were not synced at all for
 * the duration of the await.
 *
 * Outside of the first pass the container is taken as the source of truth, never
 * overwritten from the block. It can be, because a machine's own changes are
 * already shown in it as they are made (see {@link showItemSlotChange}), so
 * whatever is in a slot is what the machine put there plus whatever the player
 * did to it - which is exactly what the block should be storing.
 * @param init `true` for the first pass when the UI opens, which seeds the slots
 * from the block rather than reading them from the container.
 */
export function updateItemSlots(
  entity: Entity,
  player: Player,
  init: boolean,
): void {
  if (entity.hasTag(MACHINE_ENTITY_NO_UPDATE_UI_TAG)) return;

  const machineId = getMachineIdFromEntityId(entity.typeId);
  if (!machineId) return;

  const definition = InternalRegisteredMachine.forceGetInternal(machineId);
  if (!definition.uiElements) return;

  // Unlike the redraw, a missing or unexpected block is not raised on here.
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
 * Starts tracking a machine's UI as open, and seeds its item slots from the
 * block.
 * @remarks
 * Synchronous, and called as the container opens, so that the player cannot
 * take an item out before the seeding overwrites the slot with the block's
 * stored item.
 */
export function openMachineUi(entity: Entity, player: Player): void {
  openMachineUis.set(getMachineEntityBlockUniqueId(entity), { entity, player });
  updateItemSlots(entity, player, true);
}
