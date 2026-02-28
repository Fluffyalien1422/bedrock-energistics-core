---
title: Pistons
---

# Pistons

> [!warning]
> This feature is deprecated and will be removed in a future update. ALL MACHINES AND CONDUITS MUST NOW BE IMMOVABLE. Use the `minecraft:movable` component with `movement_type` set to `immovable` to make a block immovable. See [minecraft:movable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_movable?view=minecraft-bedrock-stable).

Machines are destroyed when pushed by a piston and nonpersistent machine entities are despawned. However, Persistent entities are not despawned, the `fluffyalien_energisticscore:on_destroyed_by_piston` entity event is triggered instead.

This allows you to run code before despawning the entity. The event can be handled in the entity event without scripting, or you can use the [dataDrivenEntityTrigger](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable#datadrivenentitytrigger) world after event to listen for the entity event.
