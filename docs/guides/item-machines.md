---
title: Item Machines
---

# Item Machines

An item machine is an item that stores storage types, such as a battery or a fluid tank you can carry. It is a standardized system, so an item machine from one add-on can be filled or drained by a machine from another.

## Registering

Register an item machine with {@link registerItemMachine}, in the `worldLoad` after event alongside your other registrations. There must be an item with the ID you give it.

```js
// Register an item machine that can store energy.
registerItemMachine({
  description: {
    // There must be an item with this ID.
    id: "example:my_item_machine",
    // Max amount of each storage type this item can hold. Defaults to 6400.
    maxStorage: 9000,
    // What this item accepts. Categories, types, or `acceptsAny: true`.
    defaultIo: {
      categories: ["energy"],
    },
  },
});
```

An item machine's I/O can also be decided per item, rather than for every item of that type, with the `getIo` handler. Anything it leaves `undefined` falls back to `defaultIo`.

```js
handlers: {
  getIo(e) {
    // `e.itemMachine` is the specific item this is being asked about.
    return { acceptsAny: e.itemMachine.typeId === "example:omni_cell" };
  },
},
```

To react to an item's storage changing, use the `onStorageSet` event. See {@link ItemMachineDefinition} for everything a definition can contain.

## Reading and Writing Storage

Interface with item machines via the {@link ItemMachine} class. Construct one from the inventory the item is in and its slot index.

```js
// The following code assumes that `player` is holding an item machine.
const inventory = player.getComponent("inventory");
const itemMachine = new ItemMachine(inventory, player.selectedSlotIndex);

// Add 1 `energy`.
const storedEnergy = await itemMachine.getStorage("energy");
itemMachine.setStorage("energy", storedEnergy + 1);
```

An `ItemMachine` refers to a slot, not to the item that was in it. It stops being valid as soon as the item in that slot is of a different type, at which point its methods throw. Use {@link ItemMachine.isValid} to check, and construct a new one rather than holding onto an old one across ticks.
