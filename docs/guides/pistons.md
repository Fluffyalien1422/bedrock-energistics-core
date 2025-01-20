---
title: Pistons
---

# Pistons

Machines are destroyed when pushed by a piston and nonpersistent machine entities are despawned. However, Persistent entities are not despawned, the `fluffyalien_energisticscore:on_destroyed_by_piston` entity event is triggered instead.

This allows you to run code before despawning the entity. The event can be handled in the entity event without scripting, or you can use the [dataDrivenEntityTrigger](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable#datadrivenentitytrigger) world after event to listen for the entity event.
