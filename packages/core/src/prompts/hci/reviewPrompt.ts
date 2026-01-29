import type { PhaseNode } from '../../phase';
import type { HCIConfig } from '../../hciConfig';

/**
 * Prompt for the REVIEW phase — self-review and finalization.
 */
export function reviewPrompt(node: PhaseNode, config: HCIConfig): string {
  const venue = config.targetVenue || 'ACM CHI';

  return `
You are a senior HCI reviewer conducting a thorough review of a research paper.
Be critical but constructive. Your goal is to make this paper as strong as possible.

## Input
Read /app/input/paper_draft.md (the complete paper).
Also read any available artifacts: results.json, study_protocol.json, etc.

## Review Criteria

### 1. Methodological Soundness
- Is the study design appropriate for the research questions?
- Are variables properly defined and operationalized?
- Is the sample size adequate? Is power analysis mentioned?
- Are the statistical tests appropriate for the data?
- Are assumptions checked and reported?
- Are effect sizes reported alongside p-values?

### 2. Logical Consistency
- Do the conclusions follow from the results?
- Are all research questions answered in the Results section?
- Does the Discussion accurately interpret the findings?
- Are claims proportional to the evidence?
- Are there contradictions between sections?

### 3. Completeness
- Are all standard sections present and adequate?
- Is the Related Work comprehensive?
- Are limitations honestly discussed?
- Is the paper self-contained (reader doesn't need external sources)?

### 4. Writing Quality
- Is the writing clear and concise?
- Is terminology consistent throughout?
- Are figures and tables properly referenced?
- Are citations complete and properly formatted?
- Is the paper within typical length for ${venue}?

### 5. Ethical Considerations
- If simulated participants were used:
  * Is this explicitly disclosed?
  * Are limitations of simulated data discussed?
  * Is there a statement about ecological validity?
- Is there any potential for harm or bias in the research?

### 6. Venue Fit
- Does this paper fit ${venue}'s scope and standards?
- Is the contribution significant enough?
- Is the framing appropriate for the audience?

## Your Task

1. **Write a detailed review report** with:
   - Summary of the paper (2-3 sentences)
   - Strengths (3-5 points)
   - Weaknesses (3-5 points, with specific suggestions)
   - Minor issues (formatting, typos, clarity)
   - Overall assessment

2. **Fix the paper** based on your own review:
   - Address every weakness you identified
   - Improve clarity where needed
   - Fix any inconsistencies
   - Add any missing elements
   - DO NOT remove content — only improve

3. **Add a Limitations subsection** in Discussion if not present:
   - Be specific about study limitations
   - If simulated participants: explicitly state this and discuss validity
   - Suggest how future work could address limitations

## Output
Write TWO files:
1. /app/output/review_report.json:
{
  "summary": "string",
  "strengths": ["string"],
  "weaknesses": [{ "issue": "string", "suggestion": "string", "severity": "major" | "minor" }],
  "minorIssues": ["string"],
  "overallAssessment": "string",
  "confidenceScore": 0.0-1.0,
  "venueReadiness": "ready" | "needs_revision" | "not_ready"
}

2. /app/output/final_paper.md — The improved version of the paper.
`.trim();
}
