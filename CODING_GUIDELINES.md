# Coding Guidelines

Please follow these guidelines when contributing code to Bedrock Energistics Core.

This style guide uses elements from the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) and [TypeScript's Contributor Coding Guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines).

## Naming

- Do not use trailing or leading underscores.
- Do not prefix interfaces with `I`.
- Avoid abbreviations where possible.
- Identifiers must only use ASCII letters, digits, and underscores.
- Treat abbreviations in names as whole words. (eg. `loadHttpUrl`, not `loadHTTPUrl`).
- Type parameters must be prefixed with `T`.
- Do not use one letter names for type parameters unless there is only one type parameter, in which case, it _may_ use the single letter name `T`.
- Use `PascalCase` for classes, interfaces, types, enums, enum members, type parameters.
- Use `camelCase` for variables, parameters, functions, methods, properties, and module aliases.
- Use `SCREAMING_SNAKE_CASE` for global constant values.
- Use `snake_case` for file names.

## Constants

- `SCREAMING_SNAKE_CASE` indicates that a value should be considered deeply immutable. For example, if an object is named with `SCREAMING_SNAKE_CASE` then it's properties should not be modified, even if they are technically mutable.
- A constant can also be a `static readonly` property of a class.
- Only global (module level and `static` fields of module level classes) symbols _may_ use `SCREAMING_SNAKE_CASE`.

## Comments

- Use `/** TSDoc */` comments for documentation, i.e. comments a user of the code should read.
- Use `// line comments` for implementation comments, i.e. comments that only concern the implementation of the code itself.
- Do not use nonstandard tags in doc comments. See [TSDoc tags](https://tsdoc.org/pages/tags/alpha/).

## `null` and `undefined`

- Prefer using `undefined` instead of `null` in most cases.

## `for..of` and `forEach`

- Prefer using `for..of` instead of `Array.prototype.forEach` in most cases.

## Private Fields

- Do not use private fields (`#myProperty`). Use the `private` keyword instead (`private myProperty`).

## Accessors

- If an accessor is used to wrap a class property, the wrapped property _may_ be prefixed with `internal`.

  ```ts
  class Foo {
    private internalBar = "";
    get bar() {
      return this.internalBar;
    }
  }
  ```

  Note: use the `readonly` keyword where possible instead of simply creating a getter with no setter.

## Diagnostic Messsages

- Use `logInfo`, `logWarn`, and `raise` from `packs/BP/scripts/utils/log.ts` for all logging purposes within the Bedrock Energistics Core add-on (not the public API).
- Use `logInfo`, `logWarn`, and `raise` from `public_api/src/log.ts` for all logging purposes within the Bedrock Energistics Core public API (not the add-on).

## Other

- ESLint and Prettier will enforce other style guidelines. Remember to check (`npm run check`) and format (`npm run fmt`) your code before pushing.
