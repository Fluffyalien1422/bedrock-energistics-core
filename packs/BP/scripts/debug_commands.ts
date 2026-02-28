import {
  CommandPermissionLevel,
  CustomCommandStatus,
  system,
} from "@minecraft/server";
import { enableDebugMode, isDebugModeEnabled } from "./debug_mode";
import { logInfo } from "./utils/log";
import { MachineNetwork } from "./network";

system.beforeEvents.startup.subscribe((e) => {
  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_energisticscore:debug.enable_debug_mode",
      description:
        "Enables debug mode for Bedrock Energistics Core. This applies to the entire world.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    () => {
      if (isDebugModeEnabled()) {
        return {
          status: CustomCommandStatus.Failure,
          message: "Debug mode is already enabled.",
        };
      }

      enableDebugMode();
      return {
        status: CustomCommandStatus.Success,
      };
    },
  );

  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_energisticscore:debug.print_networks",
      description:
        "Prints debug information about all active machine network instances.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    () => {
      const networks = MachineNetwork.getAll();
      const lines = [];
      for (const [networkId, network] of networks) {
        lines.push(
          `{ §sid§r: §p${networkId.toString()}§r, §sioType§r: { §scategory§r: §p${network.ioType.category}§r, §sid§r: §p${network.ioType.id}§r } }`,
        );
      }
      const result = `Networks: [\n${lines.join(",\n")}\n]`;
      logInfo(
        "The 'fluffyalien_energisticscore:debug.print_networks' command has been executed. Result: " +
          result,
      );
      return {
        status: CustomCommandStatus.Success,
        message: result,
      };
    },
  );
});
