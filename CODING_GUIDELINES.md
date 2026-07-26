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

- Use `logInfo`, `logWarn`, `raise`, and `raisePublic` from `packs/BP/scripts/log.ts` for all logging purposes within the Bedrock Energistics Core add-on (not the public API).
- Use `logInfo`, `logWarn`, `raise`, and `raisePublic` from `public_api/src/log.ts` for all logging purposes within the Bedrock Energistics Core public API (not the add-on).
- Diagnostic messages should be clear and grammatically correct (start with a capital letter, end with period, etc). Definite entities (variable names, IDs, etc) should be surrounded in single quotes (eg. "The entity 'example:entity' ...").

## Errors

Errors are classified by who is at fault. That decides whether the error reaches the add-on that made the call, or is only logged.

- `raisePublic(type, message)` throws a `PublicError`: **the caller made a mistake** and can fix it. For example, an unregistered ID, a location with no machine at it, or an item a slot doesn't allow.
- `raise(message)` throws an `InternalError`: **something went wrong inside Bedrock Energistics Core.** For example, data that we serialized ourselves failing to parse, or an invariant that an earlier guard should already have ensured.

Prefer `raisePublic`. Most failures are the caller's mistake, so `raise` should be rare — especially in the public API, where nearly every error is caused by the add-on calling it. Only use `raise` when the caller could not have caused the problem and could not act on it.

Every `PublicError` carries a `PublicErrorType` so add-ons can handle it programmatically instead of matching on the message text. Pick the member that describes the mistake (see `public_api/src/error.ts`), and add a new member rather than stretching an existing one to fit.

### Crossing the pack boundary

Bedrock Energistics Core and the add-ons that depend on it are separate packs communicating over IPC. This is what the split above is for:

- A `PublicError` thrown inside one of the core pack's IPC listeners is encoded into the response by `registerListener` (`packs/BP/scripts/ipc_wrapper.ts`) and thrown again on the other side by `ipcInvoke` (`public_api/src/ipc_wrapper.ts`), keeping its type. The error surfaces in the add-on that caused it instead of in the core pack's log.
- Anything else propagates to `mcbe-addon-ipc`, which logs it in the core pack and resolves the caller's invoke to `null`. That is a backstop for bugs, not a reporting path, so don't rely on it for something the caller needs to know about.

A listener for a one-way send has no caller to return to, so a `PublicError` thrown there is only logged.

## Other

- ESLint and Prettier will enforce other style guidelines. Remember to check (`npm run check`) and format (`npm run fmt`) your code before pushing.
