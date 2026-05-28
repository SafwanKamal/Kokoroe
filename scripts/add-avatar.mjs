#!/usr/bin/env node

import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(projectRoot, "content", "avatars", "catalog.json");

function usage() {
  return `Usage:
  npm run avatar:add -- --input <portrait.png> --room <room-id> --id <avatar-id> \\
    --name <name> --mark <two letters> --description <label> --signature <motif> \\
    --accent <#RRGGBB> --thumbnail-x <number> --thumbnail-y <number> \\
    --thumbnail-scale <number> --portrait-reviewed [--replace] [--dry-run]

Portraits must be visually reviewed single-character square PNGs. Preview/contact sheets are rejected.`;
}

function parseArguments(argv) {
  const flags = new Set(["portrait-reviewed", "replace", "dry-run", "help"]);
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const key = argument.slice(2);

    if (flags.has(key)) {
      values[key] = true;
      continue;
    }

    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    values[key] = value;
    index += 1;
  }

  return values;
}

function requireString(values, key) {
  const value = values[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required --${key} value.`);
  }

  return value.trim();
}

function parseNumber(values, key, minimum, maximum) {
  const rawValue = requireString(values, key);
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`--${key} must be a number between ${minimum} and ${maximum}.`);
  }

  return value;
}

function validateSlug(value, label) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must use lowercase hyphen-case.`);
  }
}

function readPngSize(buffer) {
  const pngSignature = "89504e470d0a1a0a";

  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Avatar input must be a valid PNG file.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function main() {
  const values = parseArguments(process.argv.slice(2));

  if (values.help) {
    console.log(usage());
    return;
  }

  if (!values["portrait-reviewed"]) {
    throw new Error("Pass --portrait-reviewed only after confirming this is one usable, single-character portrait.");
  }

  const input = path.resolve(requireString(values, "input"));
  const roomId = requireString(values, "room");
  const avatarId = requireString(values, "id");
  const name = requireString(values, "name");
  const mark = requireString(values, "mark").toUpperCase();
  const description = requireString(values, "description");
  const signature = requireString(values, "signature");
  const accentColor = requireString(values, "accent").toUpperCase();
  const thumbnail = {
    x: parseNumber(values, "thumbnail-x", -50, 50),
    y: parseNumber(values, "thumbnail-y", -50, 50),
    scale: parseNumber(values, "thumbnail-scale", 1, 3),
  };

  validateSlug(roomId, "Room id");
  validateSlug(avatarId, "Avatar id");

  if (!/^[A-Z0-9]{1,3}$/.test(mark)) {
    throw new Error("--mark must be one to three letters or numbers.");
  }

  if (!/^#[0-9A-F]{6}$/.test(accentColor)) {
    throw new Error("--accent must be a six-digit hex color such as #176BB3.");
  }

  if (/(preview|contact|sheet|collage|grid)/i.test(path.basename(input))) {
    throw new Error("Preview, contact-sheet, collage, and grid images are reference-only and cannot be registered as avatars.");
  }

  const inputBytes = await readFile(input);
  const dimensions = readPngSize(inputBytes);

  if (dimensions.width !== dimensions.height) {
    throw new Error(`Portrait must be square before registration; received ${dimensions.width}x${dimensions.height}.`);
  }

  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

  if (!Array.isArray(catalog[roomId])) {
    throw new Error(`Unknown room "${roomId}". Add the room before registering avatars for it.`);
  }

  const existingIndex = catalog[roomId].findIndex((avatar) => avatar.id === avatarId);

  if (existingIndex >= 0 && !values.replace) {
    throw new Error(`Avatar "${avatarId}" already exists in "${roomId}". Pass --replace to update it.`);
  }

  const outputRelativePath = path.join("avatars", roomId, avatarId, "portrait.png");
  const outputPath = path.join(projectRoot, "public", outputRelativePath);
  const avatarRecord = {
    id: avatarId,
    name,
    mark,
    description,
    signature,
    accentColor,
    imageSrc: `/${outputRelativePath.split(path.sep).join("/")}`,
    thumbnail,
  };

  if (values["dry-run"]) {
    console.log(JSON.stringify({ mode: "dry-run", roomId, dimensions, avatar: avatarRecord }, null, 2));
    return;
  }

  if (existingIndex >= 0) {
    catalog[roomId][existingIndex] = avatarRecord;
  } else {
    catalog[roomId].push(avatarRecord);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  const portraitTemp = `${outputPath}.tmp`;
  const catalogTemp = `${catalogPath}.tmp`;

  await copyFile(input, portraitTemp);
  await writeFile(catalogTemp, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  await rename(portraitTemp, outputPath);
  await rename(catalogTemp, catalogPath);

  console.log(`Registered ${name} in ${roomId}: ${avatarRecord.imageSrc}`);
}

main().catch((error) => {
  console.error(`Avatar registration failed: ${error.message}`);
  console.error(usage());
  process.exitCode = 1;
});
