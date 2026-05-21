import { describe, expect, it } from "vitest";

import { looksNewShape, toLegacyIdl } from "../index.js";

function newShapeFixture() {
  return {
    address: "Example1111111111111111111111111111111111111",
    metadata: { name: "example_program", version: "0.2.0" },
    instructions: [
      {
        name: "register_community",
        accounts: [
          { name: "platform_config", writable: true },
          { name: "mint_authority", signer: true },
          { name: "optional_wallet", optional: true },
        ],
        args: [
          { name: "creator_wallet", type: "pubkey" },
          { name: "split_wallets", type: { vec: "pubkey" } },
          {
            name: "maybe_creator",
            type: { option: { defined: { name: "CreatorSplit" } } },
          },
        ],
        returns: { defined: { name: "Registry" } },
      },
    ],
    accounts: [
      { name: "Registry", discriminator: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
    types: [
      {
        name: "Registry",
        type: {
          kind: "struct",
          fields: [
            { name: "creator_wallet", type: "pubkey" },
            { name: "creator_splits", type: { vec: { defined: { name: "CreatorSplit" } } } },
          ],
        },
      },
      {
        name: "CreatorSplit",
        type: {
          kind: "struct",
          fields: [{ name: "wallet", type: "pubkey" }],
        },
      },
    ],
    events: [
      {
        name: "CommunityRegistered",
        fields: [{ name: "creator_wallet", type: "pubkey", index: true }],
      },
    ],
    errors: [{ code: 6000, name: "BadInput", msg: "Bad input" }],
  };
}

describe("@munityclubs/anchor-idl-compat", () => {
  it("detects new-shape Anchor IDLs", () => {
    expect(looksNewShape(newShapeFixture())).toBe(true);
    expect(
      looksNewShape({
        name: "legacy",
        version: "0.1.0",
        instructions: [{ name: "doThing", accounts: [{ isMut: false }] }],
      }),
    ).toBe(false);
  });

  it("converts Anchor 0.30+ IDL shape to Anchor 0.28 legacy shape", () => {
    const out = toLegacyIdl(newShapeFixture());

    expect(out).toMatchObject({
      name: "example_program",
      version: "0.2.0",
    });

    const ix = out.instructions[0];
    expect(ix.name).toBe("registerCommunity");
    expect(ix.accounts).toEqual([
      { name: "platformConfig", isMut: true, isSigner: false },
      { name: "mintAuthority", isMut: false, isSigner: true },
      { name: "optionalWallet", isMut: false, isSigner: false, isOptional: true },
    ]);
    expect(ix.args).toEqual([
      { name: "creatorWallet", type: "publicKey" },
      { name: "splitWallets", type: { vec: "publicKey" } },
      { name: "maybeCreator", type: { option: { defined: "CreatorSplit" } } },
    ]);
    expect(ix.returns).toEqual({ defined: "Registry" });

    expect(out.accounts[0]).toEqual({
      name: "Registry",
      type: {
        kind: "struct",
        fields: [
          { name: "creatorWallet", type: "publicKey" },
          {
            name: "creatorSplits",
            type: { vec: { defined: "CreatorSplit" } },
          },
        ],
      },
    });
    expect(out.types).toEqual([
      {
        name: "CreatorSplit",
        type: {
          kind: "struct",
          fields: [{ name: "wallet", type: "publicKey" }],
        },
      },
    ]);
    expect(out.events[0].fields[0]).toEqual({
      name: "creatorWallet",
      type: "publicKey",
      index: true,
    });
    expect(out.errors).toEqual([
      { code: 6000, name: "BadInput", msg: "Bad input" },
    ]);
  });

  it("is idempotent and returns a clone for legacy IDLs", () => {
    const legacy = {
      name: "legacy",
      version: "0.1.0",
      instructions: [
        {
          name: "buyNft",
          accounts: [{ name: "buyer", isMut: true, isSigner: true }],
          args: [{ name: "amount", type: "u64" }],
        },
      ],
    };

    const once = toLegacyIdl(legacy);
    const twice = toLegacyIdl(once);
    expect(twice).toEqual(once);
    expect(once).not.toBe(legacy);
  });
});