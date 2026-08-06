/**
 * A machine's UI is the container of its backing entity (see machine.ts). Each
 * UI element (storage bar, item slot, progress indicator, button) occupies one
 * or more container slots and is (re)rendered from the machine's current state
 * on every UI update. Filler slots hold tagged "UI items" so real items placed
 * by the player can be told apart and removed.
 *
 * This module drives that: it tracks which UIs are open, redraws them on an
 * interval, and dispatches each element to the file that knows how to draw it.
 * Item slots are the exception - they are reconciled synchronously rather than
 * drawn, for the reasons in item_slots.ts.
 */

import {
  UiButtonElementUpdateOptions,
  UiStorageBarElementUpdateOptions,
  MACHINE_ENTITY_NO_UPDATE_UI_TAG,
} from "@/public_api/src";
import { getMachineEntityBlockUniqueId } from "@/public_api/src/machine_data_internal";
import { Entity, Player, system, world } from "@minecraft/server";
import { raise } from "../log";
import {
  getMachineIdFromEntityId,
  InternalRegisteredMachine,
} from "../machine_registry";
import { handleButton } from "./buttons";
import { openMachineUi, updateItemSlots } from "./item_slots";
import { getMachineUiContainer, openMachineUis } from "./open_uis";
import { handleProgressIndicator } from "./progress_indicators";
import { handleBarItems } from "./storage_bars";
import "./ui_items";

export { showItemSlotChange, flushItemSlotsFromContainer } from "./item_slots";

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

    openMachineUi(entity, player);

    void updateEntityUi(
      InternalRegisteredMachine.forceGetInternal(machineId),
      entity,
      player,
      true,
    );
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
