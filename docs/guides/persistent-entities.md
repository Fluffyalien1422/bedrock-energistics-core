---
title: Persistent Entities
---

# Persistent Entities

If your machine needs a persistent entity, you can set `description.persistentEntity` to `true` in your machine definition.

This disables despawning the entity on hit and enables some internal optimizations.

This will not destroy your machine when the entity is hit, you will need to implement this (or another system) yourself.

Call [removeMachine](https://fluffyalien1422.github.io/bedrock-energistics-core/api/functions/API.removeMachine.html) to clean up machine data and update networks. It will not remove the block or the entity.
