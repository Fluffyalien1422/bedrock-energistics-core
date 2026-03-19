---
title: Machine I/O
---

# Machine I/O

> [!note]
> Remember to update the machine's networks using if any tags change. The simplest way to manually trigger a network update is with the [MachineNetwork.updateWithBlock](https://fluffyalien1422.github.io/bedrock-energistics-core/api/classes/API.MachineNetwork.html#updateWithBlock) function.

## Network Connection

In order for a machine to connect to a machine network, it must be adjacent and share one or more I/O types with that network.
To define which I/O types your machine uses, use the `fluffyalien_energisticscore:io.` tag.

**Syntax (Default):** `fluffyalien_energisticscore:io.any | fluffyalien_energisticscore:io.{type|category}.XYZ`

For example, use the `fluffyalien_energisticscore:io.type.energy` tag to make your machine connect to networks that share the `energy` storage type, or `fluffyalien_energisticscore:io.category.gas` to make your machine connect to networks that share any storage type with the `gas` category.

### Explicit Sides

**Syntax (Explicit Sides):** `fluffyalien_energisticscore:io.any.{north|east|south|west|up|down|side|network_link} | fluffyalien_energisticscore:io.{type|category}.XYZ.{north|east|south|west|up|down|side|network_link}`

`.{north|east|south|west|up|down|side|network_link}` can be appended at the end of the tag to only connect to networks that from specific directions. This will only be parsed if the `fluffyalien_energisticscore:explicit_sides` tag is added as well.

For example, use the `fluffyalien_energisticscore:io.type.energy.north` to only connect to adjacent `energy` networks if they connect to the north face of this block.

The `network_link` value is used when the block is connected wirelessly via a [network link](./network-links.md).

### Require Conduit Connections

By default, machines will also connect to adjacent machines with the same I/O type. If you want your machine to ONLY connect to conduits, add the `fluffyalien_energisticscore:require_conduit_connection` tag.

## Consumer

In order for machine networks to allocate something to your machine, you need to define it using the `fluffyalien_energistics:consumer.` tag.

**Syntax:** `fluffyalien_energisticscore:consumer.any | fluffyalien_energisticscore:consumer.{type|category}.XYZ`

For example, use the `fluffyalien_energisticscore:consumer.type.energy` tag to make machine networks send energy to your machine. Use the `fluffyalien_energisticscore:consumer.category.gas` tag to make machine networks send any storage type with the `gas` category to your machine.

> [!note]
> Your machine must be connected to a network in the first place to have that network allocate storage types to it. For example, a machine that consumes `energy` must have both the `fluffyalien_energisticscore:io.type.energy` to connect to an `energy` network and `fluffyalien_energisticscore:consumer.type.energy` to tell that network to send `energy` to this machine.

## Reading I/O From Script

Use {@link IoCapabilities} to read the I/O of a machine or conduit from script.
