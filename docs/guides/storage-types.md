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
  color: "blue",
  id: "example:custom_fluid",
  name: "custom fluid",
});
```

If you are using a custom storage category, it should be namespaced to avoid conflicts with standard storage categories as well as storage categories from other add-ons.
