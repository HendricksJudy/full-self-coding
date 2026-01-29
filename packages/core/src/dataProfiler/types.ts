/**
 * Structural profile of a dataset, generated without any human context.
 */
export interface DataProfile {
  source: {
    fileName: string;
    fileFormat: 'csv' | 'tsv' | 'json' | 'jsonl' | 'xlsx' | 'parquet';
    fileSize: number;
    encoding: string;
  };

  shape: {
    rowCount: number;
    columnCount: number;
  };

  columns: ColumnProfile[];

  patterns: {
    hasParticipantId: boolean;
    participantIdColumn?: string;
    uniqueParticipantCount?: number;
    isRepeatedMeasures: boolean;
    repeatedMeasuresIndicator?: string;
    hasConditionColumn: boolean;
    conditionColumns?: string[];
    conditionLevels?: Record<string, string[]>;
    hasTimestamps: boolean;
    timestampColumns?: string[];
    isSurveyData: boolean;
    surveyScaleDetected?: string;
    knownQuestionnaires?: KnownQuestionnaireMatch[];
  };

  quality: {
    missingValueCount: number;
    missingValuePercentage: number;
    columnsWithMissing: string[];
    duplicateRowCount: number;
    outlierColumns: string[];
  };
}

export interface ColumnProfile {
  name: string;
  inferredType: 'numeric' | 'categorical' | 'ordinal' | 'text' | 'timestamp' | 'id' | 'boolean';
  originalType: string;

  numericStats?: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    skewness: number;
    kurtosis: number;
    normalityPValue: number;
    isNormal: boolean;
  };

  categoricalStats?: {
    uniqueValues: string[];
    valueCounts: Record<string, number>;
    mode: string;
    isBalanced: boolean;
  };

  missingCount: number;
  missingPercentage: number;

  inferredRole: 'independent_variable' | 'dependent_variable' | 'covariate'
    | 'participant_id' | 'condition' | 'timestamp' | 'unknown';
}

export interface KnownQuestionnaireMatch {
  name: string;
  confidence: number;
  matchedColumns: string[];
  expectedColumns: number;
  scoringMethod: string;
}

/**
 * Questionnaire signature for auto-detection.
 */
export interface QuestionnaireSignature {
  name: string;
  columnPatterns: RegExp[];
  expectedItemCount: number;
  scaleRange: [number, number];
  scoringMethod: string;
  reference: string;
}

/**
 * Reverse-engineered study design from data.
 */
export interface ReconstructedStudy {
  confidence: number;
  researchQuestions: string[];
  designType: 'between_subjects' | 'within_subjects' | 'mixed'
    | 'single_group' | 'correlational' | 'longitudinal' | 'unknown';
  variables: {
    independent: VariableSpec[];
    dependent: VariableSpec[];
    covariates: VariableSpec[];
    participantId: string;
  };
  factors?: {
    name: string;
    levels: string[];
    type: 'between' | 'within';
  }[];
  sample: {
    size: number;
    perCondition?: Record<string, number>;
  };
  knownQuestionnaires?: KnownQuestionnaireMatch[];
  reasoning: string;
}

export interface VariableSpec {
  columnName: string;
  label: string;
  type: 'numeric' | 'categorical' | 'ordinal';
  levels?: string[];
}

/**
 * Statistical analysis plan.
 */
export interface AnalysisPlan {
  steps: AnalysisStep[];
  framework: 'frequentist' | 'bayesian' | 'both';
  alpha: number;
  correctionMethod?: 'bonferroni' | 'holm' | 'fdr' | 'none';
  decisions: AnalysisDecision[];
}

export interface AnalysisStep {
  id: string;
  title: string;
  category: 'descriptive' | 'assumption_check' | 'inferential'
    | 'post_hoc' | 'effect_size' | 'visualization';
  method: string;
  variables: {
    dependent: string;
    independent?: string[];
    grouping?: string;
  };
  implementation: 'python' | 'r';
  code?: string;
  outputType: 'table' | 'figure' | 'statistic' | 'text';
}

export interface AnalysisDecision {
  question: string;
  decision: string;
  reasoning: string;
}
