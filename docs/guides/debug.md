---
title: Debugging
---

# Debugging

Bedrock Energistics Core adds two commands for inspecting machines and networks in a running world. Both require game director permissions.

Like all custom commands, they are registered under a namespace, which is `fluffyalien_energisticscore` unless you changed `customCommandNamespace` in the add-on's config (`scripts/__config.js` in the behavior pack).

## Debug Mode

Debug mode shows live information about the block you're looking at, and lets you set a machine's variables.

Enable it with `/becdebugmode`. It applies to the whole world and stays on until the world is reloaded, either by restarting the server or by running `/reload`.

While debug mode is on, hold a stick and look at a machine, conduit, or network link to see its:

- Network connection type and block ID
- Networks, with the storage type of each
- Non-zero storage amounts
- Block dynamic properties

Sneak while looking at a machine and holding a stick to open the Set Variable form. Enter `storage.<storage type>` to set an amount of a storage type (for example `storage.energy`) or `property.<name>` to set a block dynamic property. The value is parsed as JSON and must be a number, string, or boolean, and a storage type's value must be a number.

## Print Networks

Use `/becprintnetworks` to print every active network in the world along with its ID, dimension, and storage type. The result is shown as the command's output and logged to the content log.
