import worldLanguageCatalog from "../content/world-language/catalog.json";

export type WorldLanguageKey =
  | "auth.login.eyebrow"
  | "auth.login.title"
  | "auth.login.body"
  | "auth.create.eyebrow"
  | "auth.create.title"
  | "auth.create.body"
  | "auth.login.submit"
  | "auth.create.submit"
  | "auth.switch.toCreate.prompt"
  | "auth.switch.toCreate.action"
  | "auth.switch.toLogin.prompt"
  | "auth.switch.toLogin.action"
  | "navigation.setup.return"
  | "navigation.bubbleStyle.toggle"
  | "navigation.story.leave";

type WorldLanguageEntry = {
  surface: string;
  intent: string;
  plainMeaning: string;
  status: "approved" | "draft" | "deprecated";
  ariaLabel?: string;
  variants: Record<string, string>;
};

type WorldCopyOptions = {
  variant?: string;
  values?: Record<string, string | number>;
};

const entries = worldLanguageCatalog.entries as Record<WorldLanguageKey, WorldLanguageEntry>;

function interpolateCopy(text: string, values: Record<string, string | number> = {}) {
  return text.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, key: string) =>
    key in values ? String(values[key]) : token,
  );
}

export function getWorldCopy(key: WorldLanguageKey, options: WorldCopyOptions = {}) {
  const entry = entries[key];
  const variant = options.variant ?? "default";
  const text = entry.variants[variant] ?? entry.variants.default;

  return interpolateCopy(text, options.values);
}

export function getWorldCopyAriaLabel(key: WorldLanguageKey) {
  return entries[key].ariaLabel ?? entries[key].plainMeaning;
}

export function getWorldCopyEntry(key: WorldLanguageKey) {
  return entries[key];
}
