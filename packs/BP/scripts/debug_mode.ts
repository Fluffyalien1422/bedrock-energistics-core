import { Block, EquipmentSlot, Player, system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getMachineStorage, setMachineStorage } from "./data";
import { logInfo, makeLogString } from "./utils/log";
import { getEntityComponent } from "./polyfills/component_type_map";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import {
  getBlockDynamicProperties,
  getBlockDynamicProperty,
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
    line += `§s${storageType}§r=§p${getMachineStorage(block, storageType).toString()} `;
    if (line.length > DEBUG_ACTIONBAR_MAX_WIDTH_CHARS) {
      info += `\n${line}`;
      line = "";
    }
  }
  for (const dynamicProp of getBlockDynamicProperties(block)) {
    line += `§s${dynamicProp}§r=§p${getBlockDynamicProperty(block, dynamicProp)?.toString() ?? "undefined"} `;
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
    .title("Debug Menu")
    .textField("Storage Type ID", "energy")
    .textField("Value", "0");

  void form.show(player).then((response) => {
    playersInSetStorageForm.delete(player.id);

    if (!response.formValues) return;

    const id = response.formValues[0] as string;
    const value = Number(response.formValues[1]);

    if (isNaN(value)) {
      throw new Error("Debug menu: value field must be a number.");
    }

    setMachineStorage(block, id, value);
  });
}
