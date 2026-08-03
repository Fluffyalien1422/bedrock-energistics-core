import { world, system } from "@minecraft/server";

const REGISTRATION_MAX_TICKS = 20;

let worldLoadedTick: number | undefined;
world.afterEvents.worldLoad.subscribe(() => {
  worldLoadedTick = system.currentTick;
});

/**
 * Tests whether machines, item machines and storage types can still be
 * registered.
 * @beta
 * @remarks
 * Registration is open from the moment scripts start running until 20 ticks
 * after `worldLoad`, then closes permanently.
 * @returns Whether registration is still open.
 */
export function isRegistrationOpen(): boolean {
  return (
    worldLoadedTick === undefined ||
    system.currentTick - worldLoadedTick <= REGISTRATION_MAX_TICKS
  );
}
