const snakeToCamel = (s) =>
  typeof s === "string" ? s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()) : s;

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

function convertType(t) {
  if (t === "pubkey") return "publicKey";
  if (typeof t !== "object" || t === null) return t;

  if (Array.isArray(t)) return t.map(convertType);

  if ("defined" in t) {
    const d = t.defined;
    if (isPlainObject(d) && typeof d.name === "string") {
      return { defined: d.name };
    }
    return { defined: d };
  }
  if ("vec" in t) return { vec: convertType(t.vec) };
  if ("option" in t) return { option: convertType(t.option) };
  if ("array" in t && Array.isArray(t.array)) {
    return { array: [convertType(t.array[0]), t.array[1]] };
  }
  if (t.kind === "struct" && Array.isArray(t.fields)) {
    return {
      kind: "struct",
      fields: t.fields.map((f) => ({
        name: snakeToCamel(f.name),
        type: convertType(f.type),
      })),
    };
  }
  if (t.kind === "enum" && Array.isArray(t.variants)) {
    return {
      kind: "enum",
      variants: t.variants.map((v) => {
        if (!v) return v;
        const out = { name: v.name };
        if (Array.isArray(v.fields)) {
          out.fields = v.fields.map((f) =>
            isPlainObject(f) && f.name
              ? { name: snakeToCamel(f.name), type: convertType(f.type) }
              : convertType(f),
          );
        }
        return out;
      }),
    };
  }
  return t;
}

function convertAccountFlags(acc) {
  if ("isSigner" in acc || "isMut" in acc) {
    return { ...acc };
  }
  const out = {
    name: snakeToCamel(acc.name),
    isMut: acc.writable === true,
    isSigner: acc.signer === true,
  };
  if (acc.optional === true) out.isOptional = true;
  return out;
}

export function looksNewShape(idl) {
  if (!idl || typeof idl !== "object") return false;
  if (idl.metadata && typeof idl.metadata === "object" && idl.metadata.name) {
    return true;
  }
  if (
    Array.isArray(idl.accounts) &&
    idl.accounts.some((a) => a && a.discriminator && !a.type)
  ) {
    return true;
  }
  if (Array.isArray(idl.instructions)) {
    for (const ix of idl.instructions) {
      if (!Array.isArray(ix.accounts)) continue;
      for (const a of ix.accounts) {
        if (
          a &&
          ("signer" in a || "writable" in a) &&
          !("isSigner" in a) &&
          !("isMut" in a)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function toLegacyIdl(rawIdl) {
  if (!looksNewShape(rawIdl)) {
    return JSON.parse(JSON.stringify(rawIdl || {}));
  }

  const src = JSON.parse(JSON.stringify(rawIdl));
  const out = {};

  out.version = src.metadata?.version || src.version || "0.1.0";
  out.name = src.metadata?.name || src.name || "program";

  const typesByName = new Map();
  if (Array.isArray(src.types)) {
    for (const t of src.types) {
      if (t && t.name) typesByName.set(t.name, t.type);
    }
  }

  out.instructions = (src.instructions || []).map((ix) => ({
    name: snakeToCamel(ix.name),
    accounts: (ix.accounts || []).map(convertAccountFlags),
    args: (ix.args || []).map((a) => ({
      name: snakeToCamel(a.name),
      type: convertType(a.type),
    })),
    ...(ix.returns ? { returns: convertType(ix.returns) } : {}),
  }));

  out.accounts = (src.accounts || []).map((acc) => {
    const inlineType = acc.type ? convertType(acc.type) : null;
    const hoisted =
      !inlineType && typesByName.has(acc.name)
        ? convertType(typesByName.get(acc.name))
        : null;
    return {
      name: acc.name,
      type: inlineType || hoisted || { kind: "struct", fields: [] },
    };
  });

  const accountNames = new Set(out.accounts.map((a) => a.name));
  out.types = (src.types || [])
    .filter((t) => t && t.name && !accountNames.has(t.name))
    .map((t) => ({ name: t.name, type: convertType(t.type) }));

  if (Array.isArray(src.events)) {
    out.events = src.events.map((e) => ({
      name: e.name,
      fields: Array.isArray(e.fields)
        ? e.fields.map((f) => ({
            name: snakeToCamel(f.name),
            type: convertType(f.type),
            ...(f.index ? { index: true } : {}),
          }))
        : [],
    }));
  }

  if (Array.isArray(src.errors)) {
    out.errors = src.errors.map((e) => ({
      code: e.code,
      name: e.name,
      msg: e.msg,
    }));
  }

  return out;
}
