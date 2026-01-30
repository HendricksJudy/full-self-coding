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
 * Prompt for Mode B data profiling + study reconstruction + analysis planning.
 *
 * This is a FULL AUTONOMOUS DATA SCIENCE prompt. The AI agent receives the raw
 * data file(s) and must independently:
 *   1. Understand the data
 *   2. Reverse-engineer the study design
 *   3. Plan and execute the complete statistical analysis
 *   4. Produce publication-ready results
 *
 * The AI has Python/R available in the container to run any analysis code.
 */
export function dataProfilePrompt(config: HCIConfig): string {
  return `
You are an expert data scientist and HCI research methodologist.
You have been given a dataset with ZERO context — no description,
no codebook, no explanation. Your job is to do EVERYTHING autonomously.

You have Python 3 with pandas, numpy, scipy, statsmodels, matplotlib,
seaborn, and pingouin available. Write and run scripts as needed.

## Input
The raw data file(s) are in /app/input/.
Read them. You must figure out everything yourself.

## Phase 1: Understand the Data

Write and execute a Python script that:

1. Loads the data (detect format: CSV, TSV, JSON, etc.)
2. Prints shape, column names, dtypes
3. For each column:
   - Infer semantic type (participant ID, condition/IV, DV, ordinal/Likert, timestamp, covariate, free text)
   - Compute: unique count, missing count, distribution summary
   - For numeric: mean, sd, median, min, max, skewness, kurtosis
   - For categorical: value counts, mode, balance
4. Run Shapiro-Wilk normality test on each numeric DV
5. Check for:
   - Known questionnaires (SUS = 10 items 1-5, NASA-TLX = 6 subscales 0-100,
     UEQ = 26 items -3 to 3, PSSUQ = 16 items 1-7, AttrakDiff = 28 items)
   - Repeated measures (same participant ID, multiple rows)
   - Factorial structure (multiple IVs crossed)
6. Compute composite scores for any detected questionnaires using standard scoring

Save the profile to /app/output/data_profile.json

## Phase 2: Reconstruct the Study Design

Based on your data profile, determine:

1. **Design type**: between-subjects / within-subjects / mixed / correlational / longitudinal
2. **Variables**: clearly label each column as IV, DV, covariate, or ID
3. **Factors**: name, levels, between vs. within
4. **Research questions**: infer 1-3 RQs from the IV→DV relationships
5. **Sample**: total N, N per condition, balance

For EVERY inference, document your reasoning. This will go into the paper.

Save to /app/output/reconstructed_study.json

## Phase 3: Plan the Analysis

Based on the study design and data characteristics, create a full analysis plan.
Make ALL decisions yourself. Never leave anything for a human to decide.

Decision flowchart you MUST follow:
- Normal data (Shapiro p > .05) + 2 groups → t-test (independent or paired)
- Normal + 3+ groups → ANOVA (one-way, factorial, repeated measures, or mixed)
- Not normal + 2 groups → Mann-Whitney U or Wilcoxon signed-rank
- Not normal + 3+ groups → Kruskal-Wallis or Friedman
- Correlational → Pearson (normal) or Spearman (non-normal)
- Always: report effect sizes (Cohen's d, eta-squared, rank-biserial)
- Multiple comparisons → Holm-Bonferroni correction
- Check ANOVA assumptions: Levene's test, Mauchly's sphericity

Save to /app/output/analysis_plan.json with:
{
  "steps": [{ "id": "string", "title": "string", "method": "string", "variables": {}, "rationale": "string" }],
  "decisions": [{ "question": "string", "decision": "string", "reasoning": "string" }],
  "framework": "frequentist",
  "alpha": 0.05
}

## Output Summary
You MUST produce these files in /app/output/:
1. data_profile.json — complete data characterization
2. reconstructed_study.json — inferred study design
3. analysis_plan.json — full statistical plan with rationale
4. profile_script.py — the Python script you wrote (for reproducibility)
`.trim();
}

/**
 * Prompt for study reconstruction.
 * Used when data profiling and reconstruction are separate DAG nodes.
 */
export function studyReconstructPrompt(config: HCIConfig): string {
  return `
You are an expert HCI research methodologist.
You have a data profile but NO other information about the study.
Your task is to reverse-engineer the study design.

## Input
Read /app/input/data_profile.json (the output of the data profiling step).

## Your Task

You have Python 3 available. Write and run scripts if you need to
explore the data further.

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
     confirm identification, write and run scoring code

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
