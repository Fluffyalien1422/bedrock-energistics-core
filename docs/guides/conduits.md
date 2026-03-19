---
title: Conduits
---

# Conduits

To create a conduit, use the `fluffyalien_energisticscore:conduit` block custom component and tag. Use I/O tags to define the type of conduit it will be. See [Machine I/O](machine-io.md) for more info on I/O tags.

## Example Block

```json
{
  "format_version": "1.26.0",
  "minecraft:block": {
    "description": {
      "identifier": "example:energy_conduit"
    },
    "components": {
      "fluffyalien_energisticscore:conduit": {}, // Conduit component (required).
      "tag:fluffyalien_energisticscore:conduit": {}, // Conduit tag (required).
      "tag:fluffyalien_energisticscore:io.category.energy": {}, // I/O tag to tell
      // Bedrock Energistics Core which networks this conduit should connect to.
      // You can use multiple I/O tags as well.

      // All Bedrock Energistics Core conduits and machines must be immovable.
      "minecraft:movable": {
        "movement_type": "immovable"
      }

      // ... your other components here.
    }
  }
}
```

The code above is an edited snippet from Bedrock Energistics. View the full code [here](https://github.com/Fluffyalien1422/bedrock-energistics/blob/main/packs/BP/blocks/energy_conduit.json).

## Using IoCapabilities

The {@link IoCapabilities} API allows you to read the I/O capabilities of a machine or conduit. This is extremely useful for making your conduits visually connect to other machines and conduits that have the same I/O.

```ts
const io = IoCapabilities.fromMachine(other, face); // Create an `IoCapabilities`
// object from a machine or conduit. `other` is the block we are getting the I/O
// of and `face` is the face of that block we are checking (which would be the
// reverse of the direction we are looking in).
const shouldConnect = await io.acceptsAnyTypeOfCategory("energy", true);
// The energy conduit we are creating connects to any storage type which has
// the category `energy`. `acceptsAnyTypeOfCategory` checks if any of the types
// the machine accepts is of the given category. The second argument, `true`,
// indicates that the block calling this function is a conduit
// (since some machines may choose to only accept connections from conduits).

// ... other code here.
```

See a full example of this [here](https://github.com/Fluffyalien1422/bedrock-energistics/blob/main/packs/BP/scripts/conduits.ts).
