import {
  CommandPermissionLevel,
  CustomCommandStatus,
  system,
} from "@minecraft/server";
import { enableDebugMode, isDebugModeEnabled } from "./debug_mode";
import { logInfo } from "./utils/log";
import { MachineNetwork } from "./network";
import { toPrettyString } from "./utils/string";

system.beforeEvents.startup.subscribe((e) => {
  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_energisticscore:becdebugmode",
      description:
        "Enables debug mode for Bedrock Energistics Core. This applies to the entire world and can only be disabled with a reload.",
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
      name: "fluffyalien_energisticscore:becprintnetworks",
      description:
        "Returns debug information about all active machine network instances. The output is also logged to the console.",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    () => {
      const networks = [...MachineNetwork.getAll()].map(([, network]) => ({
        id: network.id,
        dimension: network.dimension.id,
        ioType: { id: network.ioType.id, category: network.ioType.category },
      }));
      const debugStr = JSON.stringify(networks);
      const prettyStr = toPrettyString(networks);
      logInfo("/becprintnetworks result: " + debugStr);
      return {
        status: CustomCommandStatus.Success,
        message: prettyStr,
      };
    },
  );
});
