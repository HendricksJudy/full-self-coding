import type { HCIConfig } from '../../hciConfig';

/**
 * Prompt for the DESIGN phase (Mode A).
 */
export function designPrompt(config: HCIConfig): string {
  const paradigm = config.researchParadigm || 'quantitative';
  const participantCount = config.simulatedParticipantCount || 30;

  return `
You are an HCI experiment designer. Design a rigorous study based on the research plan.

## Input
Read /app/input/research_plan.json (output of the SCOPE phase).

## Your Task

### 1. Study Protocol
Design a complete experiment:
- **Study type**: Lab experiment / online survey / field study / etc.
- **Design**: Between-subjects / within-subjects / mixed
- **Independent variables**: Name, levels, operationalization
- **Dependent variables**: Name, measurement instrument, scale
- **Control variables**: What to hold constant
- **Counterbalancing**: If within-subjects, specify order balancing

### 2. Participant Plan
- **Sample size**: ${participantCount} participants
- **Demographics**: Target population characteristics
- **Inclusion/exclusion criteria**
- **Group assignment**: Random / stratified / balanced
- **Conditions**: List all experimental conditions

### 3. Materials
- **Task descriptions**: What participants will do
- **Questionnaires**: Design or select standard instruments
  - For usability: consider SUS, UMUX-LITE
  - For workload: consider NASA-TLX
  - For UX: consider UEQ, AttrakDiff
  - Add any custom items needed for the RQs
- **Stimuli**: What participants will interact with

### 4. Procedure
- Step-by-step protocol
- Estimated duration
- Data collection points

### 5. Analysis Pre-Registration
- For each hypothesis, state the planned statistical test
- Specify alpha level (typically 0.05)
- Specify effect size of interest

Research paradigm: ${paradigm}
${config.researchDomain ? `Domain: ${config.researchDomain}` : ''}
${config.targetVenue ? `Target venue: ${config.targetVenue}` : ''}

## Output
Write THREE files:

1. /app/output/study_protocol.json:
{
  "studyType": "string",
  "design": "between_subjects" | "within_subjects" | "mixed",
  "independentVariables": [{ "name": "string", "levels": ["string"], "operationalization": "string" }],
  "dependentVariables": [{ "name": "string", "instrument": "string", "scale": "string", "items": number }],
  "controlVariables": ["string"],
  "participants": {
    "sampleSize": number,
    "targetDemographics": {},
    "inclusionCriteria": ["string"],
    "exclusionCriteria": ["string"],
    "conditions": ["string"],
    "assignmentStrategy": "random" | "balanced"
  },
  "procedure": [{ "step": number, "description": "string", "duration": "string" }],
  "analysisPreRegistration": [{ "hypothesis": "string", "test": "string", "alpha": 0.05 }]
}

2. /app/output/questionnaire.json:
{
  "instruments": [
    {
      "name": "string",
      "type": "standard" | "custom",
      "items": [{ "id": "string", "text": "string", "scale": "string", "options": ["string"] }]
    }
  ]
}

3. /app/output/variables.json:
{
  "independent": [{ "name": "string", "type": "categorical" | "ordinal" | "continuous", "levels": ["string"] }],
  "dependent": [{ "name": "string", "type": "numeric" | "ordinal", "range": [number, number] }],
  "covariates": [{ "name": "string", "type": "string" }]
}
`.trim();
}

/**
 * Prompt for analysis plan design (Mode B).
 */
export function analysisDesignPrompt(config: HCIConfig): string {
  const framework = config.statisticalFramework || 'frequentist';

  return `
You are a statistical analysis planner for HCI research.

## Input
Read from /app/input/:
- data_profile.json (data structure and column statistics)
- reconstructed_study.json (inferred study design)

## Your Task

Create a complete statistical analysis plan. You must make ALL decisions
autonomously. Do not leave anything ambiguous.

### Decision Framework
For each dependent variable:

1. **Check normality** (from data_profile.json)
   - Shapiro-Wilk p > 0.05 → parametric
   - Shapiro-Wilk p <= 0.05 → non-parametric

2. **Select test based on design**:
   | Design | Normal | Non-normal |
   |--------|--------|------------|
   | 2 groups, between | Independent t-test | Mann-Whitney U |
   | 2 groups, within | Paired t-test | Wilcoxon signed-rank |
   | 3+ groups, between | One-way ANOVA | Kruskal-Wallis |
   | 3+ groups, within | RM ANOVA | Friedman |
   | 2+ factors, between | Factorial ANOVA | — |
   | 2+ factors, mixed | Mixed ANOVA | — |
   | No groups | Pearson correlation | Spearman correlation |

3. **Post-hoc tests** (if main test significant):
   - ANOVA → Tukey HSD
   - Kruskal-Wallis → Dunn's test
   - Apply correction: Holm-Bonferroni

4. **Effect sizes**:
   - t-test → Cohen's d
   - ANOVA → eta-squared (η²)
   - Mann-Whitney → rank-biserial correlation
   - Chi-square → Cramer's V

5. **Visualizations**:
   - Box plots for group comparisons
   - Bar charts with error bars for means
   - Scatter plots for correlations
   - Histograms for distributions

Statistical framework: ${framework}
${config.researchDomain ? `Domain: ${config.researchDomain}` : ''}

### Record ALL Decisions
For every analytical choice, record:
- What question you faced
- What you decided
- Why (cite the data evidence)

## Output
Write /app/output/analysis_plan.json:
{
  "steps": [
    {
      "id": "string",
      "title": "string",
      "category": "descriptive" | "assumption_check" | "inferential" | "post_hoc" | "effect_size" | "visualization",
      "method": "string",
      "variables": { "dependent": "string", "independent": ["string"], "grouping": "string" },
      "implementation": "python",
      "outputType": "table" | "figure" | "statistic" | "text"
    }
  ],
  "framework": "${framework}",
  "alpha": 0.05,
  "correctionMethod": "holm" | "bonferroni" | "fdr" | "none",
  "decisions": [
    { "question": "string", "decision": "string", "reasoning": "string" }
  ]
}
`.trim();
}
