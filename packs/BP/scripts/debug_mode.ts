import { Block, EquipmentSlot, Player, system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getMachineStorage, setMachineStorage } from "./data";
import { logInfo, makeLogString, raise } from "./utils/log";
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

function showDebugUi(player: Player): void {
  const block = player.getBlockFromViewDirection({ maxDistance: 7 })?.block;
  if (!block) {
    player.onScreenDisplay.setActionBar(`§cNo block.`);
    return;
  }

  const networkConnectionType = getBlockNetworkConnectionType(block);
  if (!networkConnectionType) {
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
    line += `§uproperty§r.§s${dynamicProp}§r=§p${value ? JSON.stringify(value) : "undefined"} `;
    if (line.length > DEBUG_ACTIONBAR_MAX_WIDTH_CHARS) {
      info += `\n${line}`;
      line = "";
    }
  }

  info += `\n${line}`;

  player.onScreenDisplay.setActionBar(info);
}

function showSetStorageForm(block: Block, player: Player): void {
  playersInSetStorageForm.add(player.id);

  const form = new ModalFormData()
    .title("Set Variable")
    .textField(
      "Set the value of a variable in the machine.\n\nVariable",
      "storage.energy",
    )
    .textField("Value", "0");

  void form.show(player).then((response) => {
    playersInSetStorageForm.delete(player.id);

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
  });
}
