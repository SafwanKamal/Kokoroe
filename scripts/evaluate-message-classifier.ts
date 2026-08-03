import { loadLocalEnv } from "./load-local-env.mjs";
import {
  HIGH_CONFIDENCE_CLASSIFICATION_ERROR,
  messageClassificationEvaluationSet,
  MINIMUM_CLASSIFIER_EVALUATION_ACCURACY,
} from "../app/message-classification-evaluation";
import { normalizeMessageClassification } from "../app/message-classifier";
import {
  buildDiscussionCompactionContext,
} from "../app/message-classification-context";
import { generateAiSdkMessageClassificationBatch } from "../app/message-classifier-ai-sdk";
import {
  createMessageClassifierLanguageModel,
  createProviderMessageClassifier,
  createProviderMessageDiscussionCompactor,
  getDefaultMessageClassifierModel,
  type MessageClassifierProvider,
} from "../app/message-classifier-provider";

loadLocalEnv(process.env.KOKOROE_ENV_FILE ?? ".env.local");

const defaultOpenRouterModels = [
  getDefaultMessageClassifierModel("openrouter"),
];

function getProvider(): MessageClassifierProvider {
  const argument = process.argv.find((value) => value.startsWith("--provider="));
  const provider = argument?.slice("--provider=".length) ??
    process.env.KOKOROE_CLASSIFIER_PROVIDER ??
    "gateway";

  if (provider !== "gateway" && provider !== "openrouter") {
    throw new RangeError("--provider must be gateway or openrouter.");
  }

  return provider;
}

function getRequestedModels() {
  const modelArgument = process.argv.find((argument) => argument.startsWith("--models="));

  if (!modelArgument) {
    return getProvider() === "openrouter"
      ? defaultOpenRouterModels
      : [getDefaultMessageClassifierModel("gateway"), "mistral/ministral-3b"];
  }

  return modelArgument
    .slice("--models=".length)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function getDelayMs() {
  const delayArgument = process.argv.find((argument) => argument.startsWith("--delay-ms="));
  const delayMs = Number(delayArgument?.slice("--delay-ms=".length) ?? 7000);

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError("--delay-ms must be a non-negative number.");
  }

  return delayMs;
}

function getContextStrategy() {
  const argument = process.argv.find((value) => value.startsWith("--context-strategy="));
  const strategy = argument?.slice("--context-strategy=".length) ?? "recent-messages";

  if (strategy !== "recent-messages" && strategy !== "discussion-compaction") {
    throw new RangeError("--context-strategy must be recent-messages or discussion-compaction.");
  }

  return strategy;
}

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getEvaluationInput(
  evaluationCase: (typeof messageClassificationEvaluationSet)[number],
) {
  return {
    context: {
      strategy: "recent-messages" as const,
      recentTurns: evaluationCase.context,
    },
    speaker: evaluationCase.speaker,
    text: evaluationCase.text,
  };
}

async function prepareEvaluationInput(
  model: string,
  evaluationCase: (typeof messageClassificationEvaluationSet)[number],
) {
  const input = getEvaluationInput(evaluationCase);

  if (getContextStrategy() === "recent-messages") {
    return input;
  }

  return {
    ...input,
    context: await buildDiscussionCompactionContext(
      input.context,
      input.text,
      createProviderMessageDiscussionCompactor({
        maxRetries: 0,
        model,
        provider: getProvider(),
      }),
    ),
  };
}

async function classifyWithRateLimitBackoff(
  model: string,
  evaluationCase: (typeof messageClassificationEvaluationSet)[number],
  classifier: ReturnType<typeof createProviderMessageClassifier>,
) {
  const maxRateLimitRetries = 3;

  for (let attempt = 0; attempt <= maxRateLimitRetries; attempt += 1) {
    try {
      const input = await prepareEvaluationInput(model, evaluationCase);
      const output = await classifier(input);
      return {
        classification: normalizeMessageClassification(evaluationCase.text, output),
        contextStrategy: input.context.strategy,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const rateLimited = message.includes("rate-limited") || message.includes("429");

      if (rateLimited && attempt < maxRateLimitRetries) {
        console.log(`${model} rate-limited on ${evaluationCase.id}; retrying in 30 seconds.`);
        await wait(30_000);
        continue;
      }

      throw new Error(`${model} failed on ${evaluationCase.id}: ${message}`, { cause: error });
    }
  }

  throw new Error(`${model} exhausted evaluation retries for ${evaluationCase.id}.`);
}

function reportResults(
  model: string,
  mode: "batch-screen" | "per-case",
  results: Array<{
    id: string;
    expected: string;
    actual: string;
    confidence: number;
    fallbackReason: string;
    contextStrategy: string;
    contrastGroup?: string;
    match: boolean;
  }>,
  startedAt: number,
) {
  const correct = results.filter((result) => result.match).length;
  const fallbackCount = results.filter((result) => result.fallbackReason).length;
  const accuracy = correct / results.length;
  const expressiveFalsePositiveCount = results.filter((result) => (
    result.expected === "plain" && result.actual !== "plain"
  )).length;
  const highConfidenceErrorCount = results.filter((result) => (
    !result.match && result.confidence >= HIGH_CONFIDENCE_CLASSIFICATION_ERROR
  )).length;
  const contextFallbackCount = results.filter((result) => (
    result.contextStrategy !== getContextStrategy()
  )).length;
  const contrastFailureGroups = new Set(
    results
      .filter((result) => result.contrastGroup && !result.match)
      .map((result) => result.contrastGroup),
  );
  const accepted =
    mode === "per-case" &&
    accuracy >= MINIMUM_CLASSIFIER_EVALUATION_ACCURACY &&
    fallbackCount === 0 &&
    expressiveFalsePositiveCount === 0 &&
    highConfidenceErrorCount === 0 &&
    contextFallbackCount === 0 &&
    contrastFailureGroups.size === 0;

  console.log(`\n${model} (${mode})`);
  console.table(results);
  console.log(JSON.stringify({
    accepted,
    accuracy,
    correct,
    contextFallbackCount,
    contextStrategy: getContextStrategy(),
    contrastFailureGroupCount: contrastFailureGroups.size,
    expressiveFalsePositiveCount,
    fallbackCount,
    highConfidenceErrorCount,
    minimumAccuracy: MINIMUM_CLASSIFIER_EVALUATION_ACCURACY,
    mode,
    model,
    provider: getProvider(),
    total: results.length,
    durationMs: Date.now() - startedAt,
  }, null, 2));
}

async function evaluateModelPerCase(model: string) {
  const classifier = createProviderMessageClassifier({
    maxRetries: 0,
    model,
    provider: getProvider(),
  });
  const results = [];
  const startedAt = Date.now();
  const delayMs = getDelayMs();

  for (const [index, evaluationCase] of messageClassificationEvaluationSet.entries()) {
    if (index > 0 && delayMs > 0) {
      await wait(delayMs);
    }

    const { classification: result, contextStrategy } = await classifyWithRateLimitBackoff(
      model,
      evaluationCase,
      classifier,
    );

    const row = {
      id: evaluationCase.id,
      expected: evaluationCase.expectedPresentationId,
      actual: result.presentationId,
      confidence: result.confidence,
      contextStrategy,
      contrastGroup: evaluationCase.contrastGroup,
      fallbackReason: result.fallbackReason ?? "",
      match: result.presentationId === evaluationCase.expectedPresentationId,
    };

    results.push(row);
    console.log(row);
  }

  reportResults(model, "per-case", results, startedAt);
}

async function evaluateModelBatch(model: string) {
  const startedAt = Date.now();
  const cases = messageClassificationEvaluationSet.map((evaluationCase) => ({
    id: evaluationCase.id,
    input: getEvaluationInput(evaluationCase),
  }));
  const output = await generateAiSdkMessageClassificationBatch(
    createMessageClassifierLanguageModel({ model, provider: getProvider() }),
    cases,
  );

  if (!Array.isArray(output)) {
    throw new TypeError(`${model} batch screening did not return an array.`);
  }

  const outputById = new Map(
    output
      .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === "object")
      .filter((candidate) => typeof candidate.id === "string")
      .map((candidate) => [candidate.id as string, candidate]),
  );
  const results = messageClassificationEvaluationSet.map((evaluationCase) => {
    const candidate = outputById.get(evaluationCase.id);
    const result = normalizeMessageClassification(evaluationCase.text, candidate);

    return {
      id: evaluationCase.id,
      expected: evaluationCase.expectedPresentationId,
      actual: result.presentationId,
      confidence: result.confidence,
      contextStrategy: "recent-messages",
      contrastGroup: evaluationCase.contrastGroup,
      fallbackReason: result.fallbackReason ?? "",
      match: result.presentationId === evaluationCase.expectedPresentationId,
    };
  });

  reportResults(model, "batch-screen", results, startedAt);
}

async function main() {
  if (getContextStrategy() === "discussion-compaction" && !process.argv.includes("--per-case")) {
    throw new Error("discussion-compaction evaluation requires --per-case so each discussion summary is produced and checked independently.");
  }

  for (const model of getRequestedModels()) {
    if (process.argv.includes("--per-case")) {
      await evaluateModelPerCase(model);
    } else {
      await evaluateModelBatch(model);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
