import type { PhaseNode } from '../../phase';
import type { HCIConfig } from '../../hciConfig';

/**
 * Prompt for the ANALYZE phase.
 *
 * The AI agent is a fully autonomous data scientist. It receives raw data,
 * writes Python scripts, executes them, reads results, iterates if needed,
 * and produces publication-ready outputs. Same philosophy as FSC letting
 * AI agents write code autonomously.
 */
export function analyzePrompt(node: PhaseNode, config: HCIConfig): string {
  const framework = config.statisticalFramework || 'frequentist';

  return `
You are an autonomous data scientist. You have full access to Python 3
with pandas, numpy, scipy, statsmodels, pingouin, matplotlib, seaborn.

Your job: take the data and upstream artifacts, run a COMPLETE statistical
analysis, and produce publication-quality results. You write scripts,
execute them, inspect the output, fix errors, and iterate until the
analysis is correct. You work like a human data scientist — but faster
and without asking anyone for help.

## Input
All files in /app/input/:
- The raw dataset (CSV/JSON)
- analysis_plan.json or study_protocol.json (upstream artifacts)
- reconstructed_study.json or data_profile.json (if Mode B)

## How You Work

1. **Read and understand** all input files
2. **Write a Python analysis script** that does the full analysis
3. **Execute it**: python3 /app/scripts/analysis.py
4. **Check the output**: read the results, check for errors
5. **Fix and re-run** if anything is wrong
6. **Repeat** until all analyses are correct and complete

You MUST actually execute the code. Do not simulate or estimate results.
The numbers must come from running scipy/statsmodels on the real data.

## Analysis Steps

### 1. Data Preparation
- Load and clean data
- Handle missing values (document your strategy: listwise, imputation, etc.)
- Compute composite scores for questionnaires (SUS, NASA-TLX, etc.)
- Apply any necessary transformations

### 2. Descriptive Statistics
- N per group/condition
- Mean, SD, Median, IQR for each DV by condition
- Frequency tables for categorical variables
- Correlation matrix for all numeric DVs

### 3. Assumption Testing
- Shapiro-Wilk per group per DV → normality
- Levene's test → homogeneity of variance
- Mauchly's test → sphericity (if within-subjects)
- Box's M → multivariate homogeneity (if MANOVA)
- Document EVERY result — even non-significant ones

### 4. Main Analyses
Follow this decision tree strictly:

For each DV × IV combination:
  Normal + 2 independent groups → Independent t-test
  Normal + 2 paired groups     → Paired t-test
  Normal + 3+ independent      → One-way ANOVA
  Normal + 3+ paired           → Repeated measures ANOVA
  Normal + 2+ IVs              → Factorial ANOVA (or mixed ANOVA)
  Not normal + 2 independent   → Mann-Whitney U
  Not normal + 2 paired        → Wilcoxon signed-rank
  Not normal + 3+ independent  → Kruskal-Wallis
  Not normal + 3+ paired       → Friedman test
  No IV (correlational)        → Pearson or Spearman correlation

### 5. Post-Hoc Tests
If omnibus test p < .05 and 3+ groups:
  Parametric → Tukey HSD or Holm-corrected pairwise t-tests
  Non-parametric → Dunn's test with Holm correction

### 6. Effect Sizes (ALWAYS report)
- t-test → Cohen's d + 95% CI
- ANOVA → eta-squared (η²) or partial eta-squared
- Mann-Whitney → rank-biserial correlation
- Chi-square → Cramér's V
- Correlation → r or rho is already an effect size

### 7. Visualizations
Write matplotlib/seaborn code to produce:
- Box plots or violin plots for group comparisons
- Bar charts with error bars (95% CI, not SD)
- Interaction plots for factorial designs
- Scatter plots for correlations
- All plots: 300 DPI, clear axis labels, no chartjunk, colorblind-friendly

### 8. APA 7th Edition Results Text
Write every result in APA format:
- "A one-way ANOVA revealed a significant effect of interface type
   on task completion time, F(2, 87) = 4.52, p = .013, η² = .094."
- "Post-hoc comparisons using Tukey's HSD indicated that the gesture
   interface (M = 12.3, SD = 3.1) was significantly faster than the
   voice interface (M = 15.7, SD = 4.2), p = .009, d = 0.92."
- Include non-significant results too.

Statistical framework: ${framework}
${config.targetVenue ? `Format for: ${config.targetVenue}` : ''}

## Output
Write to /app/output/:
1. results.json — ALL statistical results in structured JSON
2. results_apa.md — Complete APA-formatted results narrative
3. analysis.py — The FULLY REPRODUCIBLE analysis script
4. All figures as PNG files (figure_1.png, figure_2.png, etc.)
5. descriptive_stats.csv — Descriptive statistics table

The analysis script must be FULLY REPRODUCIBLE:
run "python3 analysis.py" on the raw data → identical results.

## Critical Rules
- NEVER invent or estimate statistics. Run the code, get real numbers.
- ALWAYS report effect sizes alongside p-values.
- ALWAYS document your analytical decisions and why you made them.
- If an assumption is violated, use the appropriate alternative test.
- Report BOTH significant and non-significant results.
- Report exact p-values (p = .034) not just thresholds (p < .05),
  except when p < .001.
`.trim();
}
