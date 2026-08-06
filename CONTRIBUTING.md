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
| `scripts`              | Build tooling: Regolith filters and the JSON UI reference generator (not shipped).                      |

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
| `regolith run prod`            | A production build: minified, with only `__*.js` scripts kept.   |

The behavior pack scripts are bundled from `packs/BP/scripts/index.ts`, so a new
script file is only included if something imports it.

The `build_scripts` filter (`scripts/filters/build_scripts.ts`) marks every `__*.js` script as external, so those are left out of the bundle and stay editable in the built pack. They are also what the `prod` profile keeps when it deletes everything else. To add another such module, just name it `__*.js`; nothing needs configuring.

Adding a config option is documented at the top of `packs/BP/scripts/config_manager.ts`.

## Editing Documentation

Documentation is generated for the public API (`public_api` directory) using [TypeDoc](https://typedoc.org/) based on source code.

Markdown guides are also included. These guides can be found in `docs/guides`.

To add a new guide, add it to the `children` frontmatter property in `docs/guides/index.md`.

### Documenting JSON UI

The shared JSON UI elements in `packs/RP/ui` are documented in the files
themselves, using a `_doc` property. Put one at the top level of a file to
document the namespace, and at the top level of an element to document that
element. Every property is optional, but an element with no `_doc` reaches the
reference as a bare name:

| Property     | What it is                                                                              |
| ------------ | --------------------------------------------------------------------------------------- |
| `summary`    | A short description of the namespace or element.                                        |
| `remarks`    | Anything that doesn't belong in the summary, such as caveats or when to use an element. |
| `props`      | Descriptions of the element's `$variables`, keyed by name. Elements only.               |
| `deprecated` | `true`, or a string explaining what to use instead.                                     |

`_doc` is not valid JSON UI, so it is stripped at build time and never reaches
the game. A new JSON UI file is covered as soon as it is listed in
`packs/RP/ui/_ui_defs.json`.

Leave `docs/json-ui-ref.md` alone. It is a placeholder, and its real contents
are generated from the `_doc` properties when the documentation is released.

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
