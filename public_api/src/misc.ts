import { ItemTypes } from "@minecraft/server";
import { PublicErrorType } from "./error.js";
import { raisePublic } from "./log.js";

/**
 * Tests whether Bedrock Energistics Core is in the world or not.
 * Must be called after `worldLoad`.
 * @beta
 * @remarks
 * Works by looking for one of Bedrock Energistics Core's own items, so it can
 * only answer once the world's item types exist. That means it cannot be called
 * before `worldLoad`.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if called before `worldLoad`.
 */
export function isBedrockEnergisticsCoreInWorld(): boolean {
  try {
    return !!ItemTypes.get(
      "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
    );
  } catch {
    raisePublic(
      PublicErrorType.InvalidState,
      "Cannot test whether Bedrock Energistics Core is in the world before 'worldLoad'.",
    );
  }
}
