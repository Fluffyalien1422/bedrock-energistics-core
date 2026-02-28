# Contributing Code

Note: this is a guide for contributing code, not issues. Create an issue [here](https://github.com/Fluffyalien1422/bedrock-energistics-core/issues/new/choose).

## Preparing Your Environment

This project is configured for Windows 10/11 machines. If you're using another OS, it may not work properly.

### Prerequisites

Ensure you have the following programs installed and up to date:

- [VSCode](https://code.visualstudio.com/)
- [Node.js LTS and npm](https://nodejs.org/)
- [Regolith](https://bedrock-oss.github.io/regolith/)
- [Minecraft (Bedrock Edition Stable)](https://www.xbox.com/en-US/games/store/minecraft/9MVXMVT8ZKWC)

Please read the [coding guidelines](CODING_GUIDELINES.md) as well before contributing.

### Setting Up

1. Run `npm i`
2. Run `npm i` again in the `scripts` and `public_api` directories

## Editing Documentation

Documentation is generated for the public API (`public_api` directory) using [TypeDoc](https://typedoc.org/) based on source code.

Markdown guides are also included. These guides can be found in `public_api/guides`.

To add a new guide, add it to the `children` frontmatter property in `public_api/guides/index.md`.

Note: do not generate the documentation, the documentation will be generated when a new version is released.

## Checking Your Code

To check your code before commiting, run `npm run check`.

To format your code before commiting, run `npm run fmt`.

You can also run `npm run fmt-check` to format and check.

If your code is not properly formatted or `npm run check` fails, it will not be accepted.

Ensure that you test your new code in Minecraft before pushing changes.

## Building Your Code

To build your code, simply run `regolith run`.

## Before Pushing

Before pushing new code, ensure that your code is formatted (`npm run fmt`) and checked (`npm run check`).

## Before Submitting a PR

Before submitting a PR, follow this checklist:

- Your code is formatted (`npm run fmt`) and checked (`npm run check`).
- Your code adheres to the [coding guidelines](CODING_GUIDELINES.md).
- You have tested your changes in Minecraft.
