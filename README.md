# @munityclubs/anchor-idl-compat

Small Anchor IDL compatibility helpers for JavaScript clients pinned to older
Anchor versions.

Munity uses this to load an Anchor 0.30+ IDL with an Anchor 0.28 client. The
converter rewrites the newer IDL shape into the legacy shape expected by older
`@coral-xyz/anchor` `Program` constructors.

## Install

```bash
npm install @munityclubs/anchor-idl-compat
```

## Usage

```js
import { toLegacyIdl } from "@munityclubs/anchor-idl-compat";
import rawIdl from "./target/idl/my_program.json" assert { type: "json" };

const idl = toLegacyIdl(rawIdl);
```

## What It Converts

- Instruction account flags: `signer` / `writable` to `isSigner` / `isMut`
- Account and argument names from `snake_case` to `camelCase`
- Primitive type `"pubkey"` to `"publicKey"`
- Defined refs from `{ defined: { name: "Foo" } }` to `{ defined: "Foo" }`
- Account structs hoisted from `types[]` into `accounts[]`
- Top-level name/version from `metadata`

The conversion is idempotent for already-legacy IDLs.

## Development

```bash
yarn install
yarn test
```

## License

MIT
