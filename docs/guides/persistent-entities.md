---
title: Persistent Entities
---

# Persistent Entities

If your machine needs a persistent entity, you can set `description.persistentEntity` to `true` in your machine definition.

This disables despawning the entity on hit and enables some internal optimizations.

This will not destroy your machine when the entity is hit, you will need to implement this (or another system) yourself.

Call {@link removeMachineData} to clean up machine data and update networks. It will not remove the block or the entity. To remove the block, entity, and clean up data, use {@link destroyMachine} instead.
