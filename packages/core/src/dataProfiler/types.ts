/**
 * Questionnaire signature for auto-detection.
 * Used by knownQuestionnaires.ts to help AI agents identify standard instruments.
 * The signatures are passed to AI agents via prompts — the AI does the actual
 * detection, scoring, and interpretation.
 */
export interface QuestionnaireSignature {
  name: string;
  columnPatterns: RegExp[];
  expectedItemCount: number;
  scaleRange: [number, number];
  scoringMethod: string;
  reference: string;
}
