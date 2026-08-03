import { readFile } from "node:fs/promises";

const catalogUrl = new URL("../content/world-language/catalog.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const errors = [];
const validStatuses = new Set(["approved", "draft", "deprecated"]);
const tokenPattern = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

if (!Number.isInteger(catalog.version) || catalog.version < 1) {
  errors.push("Catalog version must be a positive integer.");
}

if (!catalog.entries || typeof catalog.entries !== "object" || Array.isArray(catalog.entries)) {
  errors.push("Catalog entries must be an object keyed by semantic copy id.");
}

for (const [key, entry] of Object.entries(catalog.entries ?? {})) {
  if (!/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*){2,}$/.test(key)) {
    errors.push(`${key}: use a semantic dot-separated id with at least three segments.`);
  }

  for (const field of ["surface", "intent", "plainMeaning"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) {
      errors.push(`${key}: ${field} must be a non-empty string.`);
    }
  }

  if (!validStatuses.has(entry.status)) {
    errors.push(`${key}: status must be approved, draft, or deprecated.`);
  }

  if (!entry.variants || typeof entry.variants.default !== "string" || !entry.variants.default.trim()) {
    errors.push(`${key}: variants.default must be a non-empty string.`);
    continue;
  }

  const expectedTokens = [...entry.variants.default.matchAll(tokenPattern)].map((match) => match[1]).sort();

  for (const [variant, text] of Object.entries(entry.variants)) {
    if (typeof text !== "string" || !text.trim()) {
      errors.push(`${key}.${variant}: variant text must be a non-empty string.`);
      continue;
    }

    const variantTokens = [...text.matchAll(tokenPattern)].map((match) => match[1]).sort();
    if (variantTokens.join("|") !== expectedTokens.join("|")) {
      errors.push(`${key}.${variant}: placeholder tokens must match the default variant.`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`World language catalog valid: ${Object.keys(catalog.entries).length} entries.`);
}
