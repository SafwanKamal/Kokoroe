import evaluationSet from "../content/message-classification/evaluation-set.json";
import type { MessageClassificationContextTurn } from "./message-classifier";
import type { MessagePresentationId } from "./message-presentations";

export type MessageClassificationEvaluationCase = Readonly<{
  context: readonly MessageClassificationContextTurn[];
  contrastGroup?: string;
  id: string;
  speaker: string;
  text: string;
  expectedPresentationId: MessagePresentationId;
  notes: string;
}>;

export const MINIMUM_CLASSIFIER_EVALUATION_ACCURACY = 0.8;
export const HIGH_CONFIDENCE_CLASSIFICATION_ERROR = 0.9;

export const messageClassificationEvaluationSet = Object.freeze(
  evaluationSet,
) as readonly MessageClassificationEvaluationCase[];
