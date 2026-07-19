import {
  createAiSdkMessageClassifier,
  createAiSdkMessageDiscussionCompactor,
} from "./message-classifier-ai-sdk";

export {
  buildDiscussionCompactionPrompt,
  buildMessageClassificationFewShotMessages,
  buildMessageClassificationMessages,
  buildMessageClassificationPrompt,
  DISCUSSION_COMPACTION_SYSTEM_PROMPT,
  MESSAGE_CLASSIFICATION_SYSTEM_PROMPT,
  parseMessageClassificationOutput,
} from "./message-classifier-ai-sdk";

export const DEFAULT_GATEWAY_CLASSIFIER_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_GLOBAL_CLASSIFIER_MODEL = DEFAULT_GATEWAY_CLASSIFIER_MODEL;

type GatewayClassifierOptions = Readonly<{
  maxRetries?: number;
  model?: string;
}>;

export function createGatewayMessageClassifier(options: GatewayClassifierOptions = {}) {
  return createAiSdkMessageClassifier({
    model: options.model ?? process.env.KOKOROE_CLASSIFIER_MODEL ?? DEFAULT_GATEWAY_CLASSIFIER_MODEL,
    ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
  });
}

export function createGatewayMessageDiscussionCompactor(options: GatewayClassifierOptions = {}) {
  return createAiSdkMessageDiscussionCompactor({
    model: options.model ?? process.env.KOKOROE_CLASSIFIER_MODEL ?? DEFAULT_GATEWAY_CLASSIFIER_MODEL,
    ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
  });
}
