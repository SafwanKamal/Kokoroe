import { describe, expect, it } from "vitest";
import {
  createMessageClassifierLanguageModel,
  createProviderMessageClassifier,
  OPENROUTER_CLASSIFIER_MODEL_SETTINGS,
} from "../app/message-classifier-provider";
import { messagePresentationIds } from "../app/message-presentations";

describe("OpenRouter message classifier provider", () => {
  it("pins parameter support, denied data collection, ZDR, and strict outputs", () => {
    expect(OPENROUTER_CLASSIFIER_MODEL_SETTINGS).toEqual({
      provider: {
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
      },
      structuredOutputs: { strict: true },
    });
  });

  it("requires a server key and a fixed free model id", () => {
    expect(() => createMessageClassifierLanguageModel({
      environment: {},
      model: "openai/gpt-oss-20b:free",
      provider: "openrouter",
    })).toThrow("OPENROUTER_API_KEY");

    expect(() => createMessageClassifierLanguageModel({
      apiKey: "test-key",
      model: "openai/gpt-oss-20b",
      provider: "openrouter",
    })).toThrow("fixed :free model id");
  });

  it("serializes the contextual request with strict schema and privacy routing", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const classifier = createProviderMessageClassifier({
      apiKey: "test-key",
      fetch: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({
          id: "test-completion",
          object: "chat.completion",
          created: 1,
          model: "openai/gpt-oss-20b:free",
          choices: [{
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                presentationId: "whisper",
                confidence: 0.93,
                reason: "The context establishes intended privacy.",
              }),
            },
          }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }), { headers: { "content-type": "application/json" } });
      },
      maxRetries: 0,
      model: "openai/gpt-oss-20b:free",
      provider: "openrouter",
    });

    await expect(classifier({
      context: {
        strategy: "recent-messages",
        recentTurns: [{ speaker: "participant-1", text: "No one else can know." }],
      },
      speaker: "target-speaker",
      text: "Keep this between us.",
    })).resolves.toEqual({
      presentationId: "whisper",
      confidence: 0.93,
      reason: "The context establishes intended privacy.",
    });

    expect(requestBody?.provider).toEqual({
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
    expect(requestBody?.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        strict: true,
        schema: {
          additionalProperties: false,
          properties: {
            presentationId: { enum: messagePresentationIds },
          },
        },
      },
    });
    expect(JSON.stringify(requestBody?.messages)).toContain("No one else can know.");
    expect(JSON.stringify(requestBody?.messages)).toContain("Keep this between us.");
  });
});
