import type { HCIConfig } from '../../hciConfig';

/**
 * Prompt for the SCOPE phase in Mode A (topic/RQ input).
 */
export function scopePrompt(config: HCIConfig): string {
  return `
You are an HCI research methodologist. Your task is to scope a research project.

## Input
Read the user's input from /app/input/. It may be:
- A research topic (broad area to investigate)
- A research question (specific question to answer)

## Your Task

1. **Literature Context**
   - Identify the key research area and sub-area within HCI
   - List 10-15 relevant prior works (real, well-known papers in this area)
   - Identify the gap or opportunity this research addresses

2. **Research Questions**
   - If input is a topic: formulate 1-3 specific, testable research questions
   - If input is an RQ: validate and refine it, add sub-questions if needed
   - Each RQ should be specific enough to design an experiment around

3. **Hypotheses**
   - For each RQ, state a directional hypothesis (H1) and null hypothesis (H0)

4. **Methodology Preview**
   - Recommend: quantitative, qualitative, or mixed methods
   - Suggest study type: controlled experiment, survey, interview, field study, etc.
   - Justify the choice

${config.researchDomain ? `5. **Research Domain**: ${config.researchDomain}` : ''}
${config.targetVenue ? `6. **Target Venue**: ${config.targetVenue} — follow this venue's conventions and standards` : ''}

## Output
Write a JSON file to /app/output/research_plan.json with:
{
  "researchArea": "string",
  "subArea": "string",
  "literatureReview": [{ "title": "string", "authors": "string", "year": number, "relevance": "string" }],
  "gap": "string",
  "researchQuestions": [{ "id": "RQ1", "question": "string", "hypothesis": "string", "nullHypothesis": "string" }],
  "methodology": { "paradigm": "string", "studyType": "string", "justification": "string" }
}
`.trim();
}

/**
 * Prompt for data profiling (Mode B, step 1).
 */
export function dataProfilePrompt(config: HCIConfig): string {
  return `
You are a data scientist specializing in HCI research data.
You have been given a dataset with NO context about what study produced it.

## Input
Read the data file(s) from /app/input/.

## Your Task

1. **File Analysis**
   - Identify file format, encoding, delimiter
   - Count rows and columns

2. **Column Profiling**
   For each column, determine:
   - Data type (numeric, categorical, ordinal, text, timestamp, ID, boolean)
   - Basic statistics (mean/median/std for numeric; value counts for categorical)
   - Missing value count and percentage
   - Inferred role: participant_id, condition/IV, dependent_variable, covariate, timestamp, unknown

3. **Pattern Detection**
   - Is there a participant ID column? How many unique participants?
   - Is this repeated measures (same participant, multiple rows)?
   - Are there condition/group columns? What are the levels?
   - Does this look like survey data? What scale (Likert 5/7)?
   - Check for known questionnaires: SUS (10 items), NASA-TLX (6 items), UEQ (26 items), etc.

4. **Data Quality**
   - Missing values summary
   - Duplicate rows
   - Potential outliers (>3 SD for numeric columns)

5. **Normality Testing**
   For each numeric column, test normality (Shapiro-Wilk if n<5000, else D'Agostino-Pearson).
   Report: test statistic, p-value, skewness, kurtosis.

## Output
Write /app/output/data_profile.json with the full DataProfile object.
`.trim();
}

/**
 * Prompt for study reconstruction (Mode B, step 2).
 */
export function studyReconstructPrompt(config: HCIConfig): string {
  return `
You are an expert HCI research methodologist.
You have a data profile but NO other information about the study.
Your task is to reverse-engineer the study design.

## Input
Read /app/input/data_profile.json (the output of the data profiling step).

## Your Task

1. **Study Design Type**
   Based on the data structure, determine:
   - Between-subjects / within-subjects / mixed?
   - How many factors? What are the levels?
   - Is this factorial?
   - Is it longitudinal (timestamps with repeated participant IDs)?
   - Is it correlational (no clear IV/DV distinction)?

2. **Variable Identification**
   - Independent variables: which columns are conditions/groups?
   - Dependent variables: which columns are measured outcomes?
   - Covariates: demographic or control variables?
   - Clearly distinguish IVs from DVs using cardinality and naming patterns

3. **Research Questions**
   - Based on the IV→DV mapping, infer 1-3 specific research questions
   - Use actual column names for specificity
   - Example: "Does [condition_column] affect [outcome_column]?"

4. **Known Questionnaire Scoring**
   - For any detected questionnaires (SUS, NASA-TLX, etc.):
     confirm identification, describe scoring method

5. **Reasoning**
   - For every inference, explain WHY you concluded this
   - This reasoning will appear in the paper's methodology section

## Output
Write /app/output/reconstructed_study.json:
{
  "confidence": 0.0-1.0,
  "researchQuestions": ["string"],
  "designType": "between_subjects" | "within_subjects" | "mixed" | "correlational" | "longitudinal",
  "variables": {
    "independent": [{ "columnName": "string", "label": "string", "type": "string", "levels": ["string"] }],
    "dependent": [{ "columnName": "string", "label": "string", "type": "string" }],
    "covariates": [{ "columnName": "string", "label": "string", "type": "string" }],
    "participantId": "string"
  },
  "factors": [{ "name": "string", "levels": ["string"], "type": "between" | "within" }],
  "sample": { "size": number, "perCondition": {} },
  "knownQuestionnaires": [{ "name": "string", "columns": ["string"], "scoringMethod": "string" }],
  "reasoning": "string"
}
`.trim();
}
