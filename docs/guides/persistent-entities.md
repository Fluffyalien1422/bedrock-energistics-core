---
title: Persistent Entities
---

# Persistent Entities

Every machine has an entity behind it, which is what its UI is really a container of. By default that entity is temporary: it is spawned when a player interacts with the block and can despawn after.

Set `description.persistentEntity` to `true` in your machine definition if your machine needs its entity to stay persistent. This changes two things:

- The entity is spawned when the block is placed, rather than when a player first interacts with it.
- Hitting the entity does not despawn it.

The main reason to want this is direct access to the entity's container. An item slot element stores its contents as a {@link MachineItemStack}, which cannot hold everything an item can carry, so a machine that has to accept arbitrary items needs a persistent entity and its real container instead. See [Machine UI](machine-ui.md).

## Cleaning Up

Hitting a persistent entity no longer destroys the machine, so if you want that behavior, or any other way to destroy the machine, you have to implement it yourself.

Call {@link removeMachineData} to clean up machine data and update networks. It will not remove the block or the entity. To remove the block, entity, and clean up data, use {@link destroyMachine} instead.
