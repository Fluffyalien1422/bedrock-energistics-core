---
title: Versioning
---

# Versioning

Bedrock Energistics Core and Bedrock Energistics Core API share a single version number and are released together.

> [!NOTE]
> They were versioned independently before v0.12.0, which left the API a minor version behind the add-on; if you are upgrading from an older release, note that the API goes from 0.10.0 straight to 0.12.0 to close that gap.

Versioning follows a modified version of [Semantic Versioning v2](https://semver.org/). The only change is that APIs marked as `@beta` may be changed or removed in any minor update. APIs **not** marked as `@beta` can only be changed or removed in major updates, as per Semantic Versioning.

## Compatibility

Using the add-on and the API package at the same version is always safe, and is the recommended default.

They do not have to be identical, though. What matters is whether a breaking change falls between the two versions:

- A patch difference is always safe.
- A minor difference is safe for APIs that are **not** marked `@beta`. Because a `@beta` API may change in any minor update, an add-on that uses one needs the minor versions to match.
- A major difference is never safe.

Until v1.0 the API is marked `@beta`, so for now the minor versions have to match.

## Dependencies

Each release notes which Minecraft and `@minecraft/server` versions it supports. See the [releases](https://github.com/Fluffyalien1422/bedrock-energistics-core/releases).
