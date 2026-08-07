---
title: Storage Types
---

# Storage Types

A storage type is something that a machine can consume or generate. All storage types have a category. For example, a storage type with ID `water` may have the category `fluid`.

Energy is registered by default. It's ID is `energy` and it's category is `energy`.

To register a new storage type, use [registerStorageType](https://fluffyalien1422.github.io/bedrock-energistics-core/api/functions/API.registerStorageType.html). However, you should always **prefer using [standard storage types](#standard-storage-types)** instead of registering your own.

If you are registering your own storage type, it should be namespaced to avoid conflicts with standard storage types as well as storage types from other add-ons.

## Standard Storage Types

Bedrock Energistics Core API contains many storage type definitions that you can use instead of registering your own.

These are not registered by default (except `energy`). Use [useStandardStorageType](https://fluffyalien1422.github.io/bedrock-energistics-core/api/functions/API.useStandardStorageType.html) to register a standard storage type
for use in your add-on.

```ts
useStandardStorageType(StandardStorageType.Water);
```

## Standard Storage Categories

There are three standard storage categories: energy, gas, and fluid. If you are registering a custom storage type, you should use the [StandardStorageCategory](https://fluffyalien1422.github.io/bedrock-energistics-core/api/enumerations/API.StandardStorageCategory.html) enum if possible.

```ts
registerStorageType({
  category: StandardStorageCategory.Fluid,
  texture: "blue",
  id: "example:custom_fluid",
  name: "custom fluid",
});
```

If you are using a custom storage category, it should be namespaced to avoid conflicts with standard storage categories as well as storage categories from other add-ons.

## Textures

A storage type's `texture` is what its [storage bars](machine-ui.md) look like by default. The simplest option is one of the presets, which is what every standard storage type uses:

```ts
texture: "water";
```

See {@link StorageTypeTexturePreset} for the full list of presets.

A storage bar is drawn out of items, one per fill level, so a custom texture is described rather than named. Give it the base ID your fill level items share, and Bedrock Energistics Core appends the level to it:

```ts
registerStorageType({
  category: StandardStorageCategory.Fluid,
  id: "example:custom_fluid",
  name: "custom fluid",
  texture: {
    // Needs the items 'example:custom_fluid_bar0' (empty) through
    // 'example:custom_fluid_bar16' (full), all of which must have the
    // `fluffyalien_energisticscore:ui_item` tag.
    baseId: "example:custom_fluid_bar",
    // The formatting code to colour the bar's label with, without the '§'.
    formattingCode: "b",
  },
});
```

One slot of a bar has 16 fill levels by default, which is what the presets use: their textures are 16 pixels tall and fill a pixel at a time. Set `segments` to use a coarser bar and fewer items. A bar four slots tall with `"segments": 4`, for instance, has 16 fill levels in total instead of 64, and needs five items rather than 17.

See {@link StorageTypeTextureDescription} for the details of each property.

A machine can override the texture of any of its own storage bars with `textureOverride`, without affecting the storage type itself. See [Machine UI](machine-ui.md).
