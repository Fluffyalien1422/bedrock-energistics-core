import { ItemStack } from "@minecraft/server";
import { logWarn } from "./log";

/**
 * Creates an `ItemStack`, returning `undefined` (and logging a warning) instead
 * of throwing if the id is invalid. Used for UI items whose ids come from
 * machine definitions and may be misconfigured by a dependent add-on.
 */
export function tryCreateItemStack(
  id: string,
  amount?: number,
  warnMsg = "An error occured while trying to create an ItemStack",
): ItemStack | undefined {
  let itemStack: ItemStack | undefined;
  try {
    itemStack = new ItemStack(id, amount);
  } catch (e) {
    logWarn(`${warnMsg}: ${String(e)}.`);
  }
  return itemStack;
}
