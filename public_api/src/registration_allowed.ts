import { system, world } from "@minecraft/server";

const REGISTRATION_MAX_TICK = 20;

let worldInitializedTick: number | undefined;

world.afterEvents.worldInitialize.subscribe(() => {
  worldInitializedTick = system.currentTick;
});

/**
 * @internal
 */
export function isRegistrationAllowed(): boolean {
  if (worldInitializedTick === undefined) return true;
  return system.currentTick - worldInitializedTick <= REGISTRATION_MAX_TICK;
}
