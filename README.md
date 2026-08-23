![Bedrock Energistics Core banner](keyart/thumbnail.png)

APIs for creating tech add-ons for Minecraft: Bedrock Edition.

Bedrock Energistics Core handles the parts every tech add-on would otherwise have to build for itself — networks, storage, machine UI — so that machines from separate add-ons can be placed side by side and work together.

> [!WARNING]
> Bedrock Energistics Core is in beta. Every API is marked `@beta` until v1.0, which means minor updates may contain breaking changes across all APIs. See [Versioning](https://fluffyalien1422.github.io/bedrock-energistics-core/api/documents/Guides.Versioning.html).

## Features

- Machines using these APIs work with each other even if they're from different add-ons.
- Simple APIs for basic machines, while still having more powerful APIs for more complicated machines.
- Item storage APIs without persistent entities.
- Easily create machine UI.
- Create your own storage types (water, lava, etc) and share them between add-ons, not just energy.

## Requirements

- Minecraft: Bedrock Edition, stable.
- The add-on and the API package on the same version. Until v1.0 their minor versions have to match.

Each release notes the Minecraft and `@minecraft/server` versions it supports. See [releases](https://github.com/Fluffyalien1422/bedrock-energistics-core/releases).

## Getting Started

Bedrock Energistics Core is a dependency add-on. It adds no player-facing content of its own; it provides the APIs that other add-ons build on.

Your add-on talks to it through the [`bedrock-energistics-core-api`](https://www.npmjs.com/package/bedrock-energistics-core-api) npm package, which is bundled with the rest of your scripts:

```sh
npm i bedrock-energistics-core-api@latest
```

See [Getting Started](https://fluffyalien1422.github.io/bedrock-energistics-core/api/documents/Guides.Getting_Started.html).

## Configuration

Advanced options can be configured by editing `scripts/__config.js` in the behavior pack with any text editor. This is for whoever ships the behavior pack, not for add-ons that only use the API.

## Links

- [Home page](https://fluffyalien1422.github.io/bedrock-energistics-core/)
- [Getting Started](https://fluffyalien1422.github.io/bedrock-energistics-core/api/documents/Guides.Getting_Started.html)
- [Guides and API reference](https://fluffyalien1422.github.io/bedrock-energistics-core/api/)
- [npm package](https://www.npmjs.com/package/bedrock-energistics-core-api)
- [GitHub Releases](https://github.com/Fluffyalien1422/bedrock-energistics-core/releases)
- [CurseForge](https://www.curseforge.com/minecraft-bedrock/addons/bedrock-energistics-core)
- [MCPEDL](https://mcpedl.com/bedrock-energistics-core/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), and the [coding guidelines](CODING_GUIDELINES.md) before writing code. Bug reports and feature requests go [here](https://github.com/Fluffyalien1422/bedrock-energistics-core/issues/new/choose).

## License

This project is licensed under the [ISC License](LICENSE).
