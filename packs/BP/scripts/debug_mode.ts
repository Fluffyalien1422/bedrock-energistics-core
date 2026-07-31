/**
 * Debug mode (enabled via the `becdebugmode` command) is a world-wide developer
 * aid. While a player holds a stick, the block they're looking at has its
 * network, storage, and dynamic-property state shown on their action bar; a
 * machine block can also be sneaked-at to open a form for setting a variable.
 * It stays on until the world reloads.
 */

import { Block, EquipmentSlot, Player, system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getMachineStorage, setMachineStorage } from "./data";
import { logInfo, logWarn, makeLogString, raise } from "./log";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import {
  getBlockDynamicProperties,
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";
import { MachineNetwork } from "./network";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
} from "@/public_api/src";

const DEBUG_ACTIONBAR_MAX_WIDTH_CHARS = 50;

const playersInSetStorageForm = new Set<string>();

let debugMode = false;

export function isDebugModeEnabled(): boolean {
  return debugMode;
}

/**
 * Turns on debug mode: announces it and starts the interval that shows the
 * held-stick block readout. No-op if already enabled; there is intentionally no
 * way to disable it short of a reload.
 */
export function enableDebugMode(): void {
  if (debugMode) return;
  debugMode = true;
  world.sendMessage(
    makeLogString(
      "INFO",
      "Debug mode enabled. Reload the world to disable debug mode.",
    ),
  );
  logInfo("Debug mode enabled. Reload the world to disable debug mode.");

  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      if (playersInSetStorageForm.has(player.id)) continue;

      const equippable = player.getComponent("equippable")!;
      if (
        equippable.getEquipment(EquipmentSlot.Mainhand)?.typeId !==
        "minecraft:stick"
      ) {
        continue;
      }

      showDebugUi(player);
    }
  }, 2);
}

/**
 * Shows debug info for the block the player is looking at on their action bar:
 * its connection type, the networks it belongs to, and every non-zero storage
 * value and dynamic property. Sneaking while looking at a machine opens the
 * set-variable form instead.
 */
function showDebugUi(player: Player): void {
  const block = player.getBlockFromViewDirection({ maxDistance: 7 })?.block;
  if (!block) {
    player.onScreenDisplay.setActionBar(`§cNo block.`);
    return;
  }

  const networkConnectionType = getBlockNetworkConnectionType(block);
  if (networkConnectionType === undefined) {
    player.onScreenDisplay.setActionBar(
      `§sBlock§r: §p${block.typeId}\n§cNo network connection type.`,
    );
    return;
  }
  if (
    networkConnectionType === NetworkConnectionType.Machine &&
    player.isSneaking
  ) {
    showSetStorageForm(block, player);
    return;
  }

  const isNetworkLinkAndMachine =
    networkConnectionType === NetworkConnectionType.Machine &&
    block.hasTag("fluffyalien_energisticscore:network_link");
  const headerLabel = isNetworkLinkAndMachine
    ? `[${NetworkConnectionType.Machine}, ${NetworkConnectionType.NetworkLink}]`
    : networkConnectionType;

  let info =
    `§s${headerLabel}§r: §p${block.typeId}\n§sNetworks§r: ` +
    MachineNetwork.getAllWithBlock(block)
      .map(
        (network) => `§p${network.id.toString()} §r(§p${network.ioType.id}§r)`,
      )
      .join(", ");

  let line = "";

  for (const storageType of InternalRegisteredStorageType.getAllIdsInternal()) {
    const value = getMachineStorage(block, storageType);
    if (!value) continue;
    line += `§ustorage§r.§s${storageType}§r=§p${value.toString()} `;
    if (line.length > DEBUG_ACTIONBAR_MAX_WIDTH_CHARS) {
      info += `\n${line}`;
      line = "";
    }
  }
  for (const dynamicProp of getBlockDynamicProperties(block)) {
    const value = getBlockDynamicProperty(block, dynamicProp);
    line += `§uproperty§r.§s${dynamicProp}§r=§p${value !== undefined ? JSON.stringify(value) : "undefined"} `;
    if (line.length > DEBUG_ACTIONBAR_MAX_WIDTH_CHARS) {
      info += `\n${line}`;
      line = "";
    }
  }

  info += `\n${line}`;

  player.onScreenDisplay.setActionBar(info);
}

/**
 * Opens a form to set a machine variable by name: `storage.<type>` writes a
 * storage amount, `property.<name>` writes a block dynamic property. The value
 * is parsed as JSON and must be a number/string/boolean.
 */
function showSetStorageForm(block: Block, player: Player): void {
  playersInSetStorageForm.add(player.id);

  const form = new ModalFormData()
    .title("Set Variable")
    .textField(
      "Set the value of a variable in the machine.\n\nVariable",
      "storage.energy",
    )
    .textField("Value", "0");

  void form
    .show(player)
    .then((response) => {
      if (!response.formValues) return;

      const varName = response.formValues[0] as string;
      let value: unknown;
      try {
        value = JSON.parse(response.formValues[1] as string) as unknown;
      } catch (err) {
        raise(`Debug menu: Invalid JSON value. Error: ${String(err)}.`);
      }

      if (
        typeof value !== "number" &&
        typeof value !== "string" &&
        typeof value !== "boolean"
      ) {
        raise("Debug menu: Expected a number, string, or boolean.");
      }

      if (varName.startsWith("storage.")) {
        const storageType = varName.slice("storage.".length);
        if (typeof value !== "number") {
          raise("Debug menu: Expected a number to set a storage type.");
        }
        setMachineStorage(block, storageType, value);
        return;
      }

      if (varName.startsWith("property.")) {
        const property = varName.slice("property.".length);
        setBlockDynamicProperty(block, property, value);
        return;
      }

      raise(
        `Debug menu: Invalid variable domain. Expected 'storage' or 'property' but got '${varName.split(".")[0]}'.`,
      );
    })
    .catch((e: unknown) => {
      // Everything above runs inside a promise, so without this an invalid
      // entry (or a rejected setter) would surface as an unhandled rejection
      // and the player who typed it would get no feedback at all.
      logWarn(String(e));
      if (player.isValid) player.sendMessage(String(e));
    })
    .finally(() => {
      // In a `finally` so the player isn't left flagged as being in the form
      // (which suppresses the debug readout) if showing it rejected.
      playersInSetStorageForm.delete(player.id);
    });
}
