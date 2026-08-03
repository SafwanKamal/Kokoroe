import {
  createOpenRouter,
  type OpenRouterChatSettings,
  type OpenRouterProviderSettings,
} from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import {
  createAiSdkMessageClassifier,
  createAiSdkMessageDiscussionCompactor,
} from "./message-classifier-ai-sdk";
import { DEFAULT_GATEWAY_CLASSIFIER_MODEL } from "./message-classifier-gateway";

export type MessageClassifierProvider = "gateway" | "openrouter";

export const DEFAULT_OPENROUTER_CLASSIFIER_MODEL = "tencent/hy3:free";

export const OPENROUTER_CLASSIFIER_MODEL_SETTINGS = {
  provider: {
    require_parameters: true,
    data_collection: "deny",
    zdr: true,
  },
  structuredOutputs: { strict: true },
} satisfies OpenRouterChatSettings;

type ClassifierProviderOptions = Readonly<{
  apiKey?: string;
  environment?: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
  maxRetries?: number;
  model: string;
  provider: MessageClassifierProvider;
}>;

export function getDefaultMessageClassifierModel(provider: MessageClassifierProvider) {
  return provider === "openrouter"
    ? DEFAULT_OPENROUTER_CLASSIFIER_MODEL
    : DEFAULT_GATEWAY_CLASSIFIER_MODEL;
}

export function createMessageClassifierLanguageModel(
  options: ClassifierProviderOptions,
): LanguageModel {
  if (options.provider === "gateway") {
    return options.model;
  }

  if (!options.model.endsWith(":free")) {
    throw new RangeError("OpenRouter classifier models must use a fixed :free model id.");
  }

  const environment = options.environment ?? process.env;
  const apiKey = options.apiKey?.trim() || environment.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required when KOKOROE_CLASSIFIER_PROVIDER=openrouter.");
  }

  const providerOptions: OpenRouterProviderSettings = {
    apiKey,
    compatibility: "strict",
    appName: "Kokoroe",
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };
  const openrouter = createOpenRouter(providerOptions);

  return openrouter(options.model, OPENROUTER_CLASSIFIER_MODEL_SETTINGS);
}

export function createProviderMessageClassifier(options: ClassifierProviderOptions) {
  return createAiSdkMessageClassifier({
    model: createMessageClassifierLanguageModel(options),
    ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
  });
}

export function createProviderMessageDiscussionCompactor(options: ClassifierProviderOptions) {
  return createAiSdkMessageDiscussionCompactor({
    model: createMessageClassifierLanguageModel(options),
    ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
  });
}
