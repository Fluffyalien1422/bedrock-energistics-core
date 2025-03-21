import { Block, EquipmentSlot, Player, system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getMachineStorage, setMachineStorage } from "./data";
import { logInfo, makeLogString, raise } from "./utils/log";
import { getEntityComponent } from "./polyfills/component_type_map";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import {
  getBlockDynamicProperties,
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";

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

      const equippable = getEntityComponent(player, "equippable")!;
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
  if (!block?.hasTag("fluffyalien_energisticscore:machine")) {
    player.onScreenDisplay.setActionBar(
      `§sBlock§r: §p${block?.typeId ?? "undefined"}\n§cNot a machine.`,
    );
    return;
  }

  if (player.isSneaking) {
    showSetStorageForm(block, player);
    return;
  }

  let info = `§sBlock§r: §p${block.typeId}`;
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
    line += `§s${dynamicProp}§r=§p${value ? JSON.stringify(value) : "undefined"} `;
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
      "Set the value of a variable in the machine.\n\nNOTE: The value will not be verified. Setting the value of a variable to an invalid type may cause unexpected issues. IF YOU DON'T KNOW WHAT YOU'RE DOING, CLOSE THIS MENU.\n\nVariable",
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

    setBlockDynamicProperty(block, varName, value);
  });
}
