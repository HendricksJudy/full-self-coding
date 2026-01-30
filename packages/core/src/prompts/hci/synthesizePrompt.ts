import type { HCIConfig } from '../../hciConfig';

/**
 * Built-in writing guidelines for well-known paper sections.
 * These provide quality standards even when the AI section planner
 * chooses the structure. For AI-planned sections, these serve as
 * supplementary guidelines alongside the AI's section description.
 */
const sectionGuidelines: Record<string, string> = {
  abstract: `
Write a structured abstract (150-250 words) that includes:
- Background/motivation (1-2 sentences)
- Research question or objective
- Method summary (study type, participants, measures)
- Key findings (quantitative results)
- Contribution/implication
Do NOT start with "This paper..." — use an active, engaging opening.`,

  introduction: `
Write the Introduction section (800-1200 words):
1. Open with a compelling hook that motivates the research
2. Establish the problem space with citations to prior work
3. Identify the specific gap this study addresses
4. State the research questions clearly
5. Preview the methodology
6. Summarize the contributions (2-3 bullet points)
Follow the "funnel" structure: broad context → specific problem → your approach.`,

  'related-work': `
Write the Related Work section (800-1500 words):
1. Organize by themes, NOT by individual papers
2. For each theme:
   - Summarize the state of knowledge
   - Cite 3-5 relevant papers
   - Identify what's missing or contradictory
3. End each subsection by connecting back to your work
4. Final paragraph: synthesize the gap your work fills
Use real, well-known HCI papers where possible. Cite in [Author Year] format.`,

  related_work: `
Write the Related Work section (800-1500 words):
1. Organize by themes, NOT by individual papers
2. For each theme:
   - Summarize the state of knowledge
   - Cite 3-5 relevant papers
   - Identify what's missing or contradictory
3. End each subsection by connecting back to your work
4. Final paragraph: synthesize the gap your work fills
Use real, well-known HCI papers where possible. Cite in [Author Year] format.`,

  method: `
Write the Method section following standard HCI conventions:
1. **Participants**: N, demographics, recruitment, compensation
2. **Study Design**: type (between/within/mixed), IVs, DVs, conditions
3. **Apparatus/Materials**: tools, interfaces, questionnaires used
4. **Procedure**: step-by-step protocol
5. **Measures**: what was measured and how (instruments, scales)
6. **Analysis Plan**: which statistical tests and why
Be specific enough that someone could replicate the study.`,

  results: `
Write the Results section using APA conventions:
1. Read the APA-formatted results from /app/input/results_apa.md
2. Structure by research question
3. For each RQ:
   - State the hypothesis
   - Report descriptive statistics
   - Report inferential test results with full statistics
   - State whether hypothesis was supported
4. Reference figures and tables
5. Do NOT interpret — just report facts (interpretation goes in Discussion)
Use past tense. Be precise with numbers.`,

  findings: `
Write the Findings section for qualitative/mixed-methods research:
1. Organize by themes or categories (NOT by participant or question)
2. For each theme:
   - Provide a clear heading and overview
   - Include representative quotes (with participant IDs)
   - Explain the significance of each finding
3. Connect findings to research questions
4. Present both expected and surprising findings
Use present tense for findings. Let the data speak.`,

  discussion: `
Write the Discussion section (1000-1500 words):
1. **Summary**: Restate key findings in plain language
2. **Interpretation**: What do the results mean? Why did we observe these patterns?
3. **Comparison**: How do findings relate to prior work? Consistent or contradictory?
4. **Implications**: What should practitioners/designers do differently?
5. **Limitations**: Be honest and specific:
   - Study design limitations
   - Sample limitations
   - Measurement limitations
   - If simulated participants were used, acknowledge this explicitly
6. **Future Work**: 2-3 specific, actionable directions
Do NOT repeat numbers from Results — discuss the meaning.`,

  conclusion: `
Write the Conclusion section (200-400 words):
1. One-sentence summary of what was studied and why
2. Key takeaways (2-3 findings)
3. Primary contribution
4. Closing statement on broader impact
Keep it concise. Do not introduce new information.`,
};

/**
 * Prompt for writing a single paper section.
 *
 * Accepts an optional nodeDescription parameter — when provided by the
 * AI section planner, it becomes the primary instruction. Built-in
 * guidelines for known sections are included as supplementary writing
 * standards.
 */
export function synthesizeSectionPrompt(
  section: string,
  config: HCIConfig,
  nodeDescription?: string,
): string {
  const venue = config.targetVenue || 'ACM CHI';
  const language = config.outputLanguage || 'en';

  const builtInGuideline = sectionGuidelines[section];

  // Build the instruction: AI-planned description takes priority,
  // built-in guidelines serve as quality standards
  let instruction: string;
  if (nodeDescription && builtInGuideline) {
    instruction = `## Section Goal\n${nodeDescription}\n\n## Writing Guidelines\n${builtInGuideline}`;
  } else if (nodeDescription) {
    instruction = `## Section Goal\n${nodeDescription}`;
  } else if (builtInGuideline) {
    instruction = builtInGuideline;
  } else {
    instruction = `Write the ${section.replace(/[-_]/g, ' ')} section of the paper.`;
  }

  return `
You are an academic writer specializing in HCI research papers.

## Input
Read all relevant files from /app/input/:
- research_plan.json (scope and RQs)
- study_protocol.json (method details)
- results.json and results_apa.md (statistical results)
- Any other available artifacts

## Your Task
${instruction}

## Writing Standards
- Target venue: ${venue}
- Language: ${language}
- Use academic but accessible language
- Avoid jargon unless standard in HCI
- Every claim must be supported by data or citation
- Use present tense for established knowledge, past tense for your study
- Follow ${venue} formatting conventions

## Output
Write /app/output/${section}.md
`.trim();
}

/**
 * Prompt for compiling all sections into a full paper.
 */
export function synthesizeCompilePrompt(config: HCIConfig): string {
  const venue = config.targetVenue || 'ACM CHI';

  return `
You are assembling a complete research paper from individually written sections.

## Input
Read all section files from /app/input/.
These are markdown files — each one is a separate paper section.

## Your Task

1. **Assemble** all sections in logical order
2. **Review continuity**: Ensure consistent terminology across sections
3. **Fix cross-references**: "As discussed in Section X...", "See Figure Y..."
4. **Add transitions**: Smooth connections between sections
5. **Unify voice**: Ensure consistent writing style throughout
6. **Add structural elements**:
   - Title (generate a concise, informative title)
   - Author placeholder: "[Author Names]"
   - Keywords (5-7 relevant terms)
   - References section (compile all citations)
   - Acknowledgments placeholder

## Formatting
Target: ${venue}
- Use Markdown formatting
- Heading levels: # for title, ## for sections, ### for subsections
- Figures referenced as "Figure 1", "Figure 2", etc.
- Tables referenced as "Table 1", "Table 2", etc.
- Citations in [Author Year] format

## Output
Write /app/output/paper_draft.md — the complete paper in one file.
`.trim();
}
