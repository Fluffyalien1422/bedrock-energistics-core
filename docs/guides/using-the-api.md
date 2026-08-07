---
title: Using the API
---

# Using the API

Bedrock Energistics Core runs in its own behavior pack. Your add-on does not call into it directly, it talks to it over inter-pack communication (IPC). Most of what is unusual about the API follows from that.

## Initializing

Call {@link init} once, in the `worldLoad` after event, before using anything else:

```js
world.afterEvents.worldLoad.subscribe(() => {
  bec.init("myAddonId");
});
```

The ID identifies your add-on's IPC router, so it must be unique in the world. Anything identifying your add-on works. If your add-on creates a router of its own with `mcbe-addon-ipc`, give that one a different ID, since two routers sharing an ID receive each other's messages.

`init` throws if Bedrock Energistics Core is not in the world. If your add-on can run without it, check with {@link isBedrockEnergisticsCoreInWorld} first.

## Registering

Machines, item machines, and storage types must be registered while registration is open, which lasts from the moment scripts start running until 20 ticks after `worldLoad`. It then closes permanently, and registering after that throws. Register in your `worldLoad` handler, right after `init`. {@link isRegistrationOpen} tests whether the window is still open.

## Asynchronous APIs

Anything that has to ask the core pack a question returns a promise, and the round trip may take time. So a value you read may be a value from the past, and by the time you write it back the world may have moved on.

Where that matters, the API gives you an operation that does the whole read-modify-write inside Bedrock Energistics Core instead. For a machine's item slots, {@link takeMachineSlotItem} and {@link addMachineSlotItem} are those operations: they change a slot relative to whatever is in it at the time. Reading a slot and writing it back with {@link setMachineSlotItem} is not equivalent, because a player can change the slot in between, and overwriting a change they have already made can duplicate the item they are holding.

All three also take conditions the slot must meet, so a write can be made to apply only to the contents you expected:

```js
// Consume 1 cobblestone, and only if that's what the slot holds.
const taken = await bec.takeMachineSlotItem(block, "inputSlot", 1, {
  expectType: "minecraft:cobblestone",
  expectMinAmount: 1,
});
if (taken) {
  // ...
}
```

## Error Handling

Failures come in two kinds, and which one you get tells you whose problem it is.

A {@link PublicError} is a mistake in the calling add-on: an unregistered ID, a location whose chunk is not loaded, an API used before `init`. These are recoverable, and they are thrown in your add-on even when the failure happened on the other side of the pack boundary. Check {@link PublicError.type} against {@link PublicErrorType} to tell the cases apart, rather than matching on the message:

```js
try {
  await bec.setMachineStorage(block, "energy", 100);
} catch (e) {
  if (e instanceof bec.PublicError && e.type === bec.PublicErrorType.NotFound) {
    // The machine isn't there anymore.
    return;
  }
  throw e;
}
```

An {@link InternalError} is a problem inside Bedrock Energistics Core itself, such as a bug or corrupted stored data. There is generally nothing an add-on can do about one, so they are not sent across the pack boundary: the core pack logs it to the content log and the call that triggered it resolves to `null`. Encountering one is worth [reporting](https://github.com/Fluffyalien1422/bedrock-energistics-core/issues/new/choose).

For debugging what a machine or network is actually doing at runtime, see [Debugging](debug.md).
