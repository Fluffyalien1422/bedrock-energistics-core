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

## Project Layout

The repository holds two things that ship separately, plus the tooling around
them. Which one you're editing decides a lot, so it's worth knowing up front:

| Path                   | What it is                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `packs/BP`, `packs/RP` | The Bedrock Energistics Core add-on itself. `packs/BP/scripts` is its behavior pack script source.      |
| `public_api`           | The `bedrock-energistics-core-api` npm package, which add-ons bundle. Published from `public_api/dist`. |
| `docs/guides`          | The markdown guides, published with the generated API reference.                                        |
| `scripts`              | Regolith filter scripts (not shipped).                                                                  |

The add-on and the public API are separate packs at runtime and talk to each
other over IPC. See [Crossing the pack boundary](CODING_GUIDELINES.md#crossing-the-pack-boundary)
in the coding guidelines, which covers what that means for the code you write.

## Checking Your Code

To check your code before committing, run `npm run check`. This runs, in order:

| Script                   | What it checks                                      |
| ------------------------ | --------------------------------------------------- |
| `npm run check-prettier` | Formatting.                                         |
| `npm run check-tsc`      | Types, for the add-on, `scripts`, and `public_api`. |
| `npm run check-eslint`   | Lint rules.                                         |
| `npm run check-typedoc`  | Documentation, including unresolved `{@link}`s.     |

Run any of them on its own to narrow down a failure. The same checks run in CI
as separate steps.

To format your code, run `npm run fmt`.

If your code is not properly formatted or `npm run check` fails, it will not be accepted.

Ensure that you test your new code in Minecraft before pushing changes. There is
no automated test suite; the code needs a running game.

## Building Your Code

To build your code, simply run `regolith run`.

Other profiles are available:

| Command                        | What it does                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| `regolith run`                 | Builds and exports to Minecraft's development pack folders.      |
| `regolith run preview`         | The same, but for Minecraft Preview.                             |
| `regolith run dev_localexport` | Exports to the project's `build` directory instead of Minecraft. |
| `regolith run prod`            | A production build: minified, with only the bundled script kept. |

The behavior pack scripts are bundled from `packs/BP/scripts/index.ts`, so a new
script file is only included if something imports it.

## Editing Documentation

Documentation is generated for the public API (`public_api` directory) using [TypeDoc](https://typedoc.org/) based on source code.

Markdown guides are also included. These guides can be found in `docs/guides`.

To add a new guide, add it to the `children` frontmatter property in `docs/guides/index.md`.

`npm run check-typedoc` verifies that the documentation still builds, and treats
warnings (such as a `{@link}` that doesn't resolve) as errors.

Note: do not generate the documentation, the documentation will be generated when a new version is released.

## Before Pushing

Before pushing new code, ensure that your code is formatted (`npm run fmt`) and checked (`npm run check`).

## Before Submitting a PR

Before submitting a PR, follow this checklist:

- Your code is formatted (`npm run fmt`) and checked (`npm run check`).
- Your code adheres to the [coding guidelines](CODING_GUIDELINES.md).
- You have tested your changes in Minecraft.
- If you changed the public API, the change follows [Versioning](docs/guides/versioning.md). Breaking changes to APIs that aren't marked `@beta` need a major release.
