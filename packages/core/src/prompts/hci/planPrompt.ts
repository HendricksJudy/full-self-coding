import type { HCIConfig } from '../../hciConfig';

/**
 * Prompt for the PLAN phase — AI agent reads the raw input and designs
 * the full pipeline DAG structure.
 *
 * This replaces hardcoded buildModeADAG() / buildModeBDAG() in the
 * orchestrator. The AI agent decides:
 *   1. What type of input was provided (topic, RQ, dataset)
 *   2. Which pipeline mode to use (A = simulated, B = real data)
 *   3. What phases are needed and their dependency structure
 *
 * Same philosophy as FSC: infrastructure handles scheduling and isolation;
 * AI agents make all intelligent decisions.
 */
export function pipelinePlanPrompt(config: HCIConfig): string {
  return `
You are an HCI research pipeline architect. Your job is to read the user's
input and design the optimal research pipeline.

## Input
Read ALL files in /app/input/:
- meta.json — system-detected file type and basic statistics
- The actual input files (data files, text files, etc.)

Read the input thoroughly. Understand what the user provided.

## Available Phase Types
Each phase runs as an autonomous AI agent in a Docker container with
Python 3 (pandas, numpy, scipy, statsmodels, matplotlib, seaborn, pingouin).

| Phase Type   | Purpose |
|--------------|---------|
| scope        | Literature review, RQ formulation, data profiling, study reconstruction |
| design       | Study design, protocol creation, analysis planning |
| collect      | Data collection via simulated personas (Mode A only) |
| analyze      | Statistical analysis, visualization, APA results |
| synthesize   | Paper writing (sections planned by synthesize/plan node) |
| review       | Self-review and finalization |

## Your Task

### 1. Classify the Input
Read the actual input files and determine:
- Is this a broad research topic? (e.g., "usability of voice interfaces")
- Is this a specific research question? (e.g., "Does gesture-based input reduce task completion time compared to voice input for smart home control?")
- Is this a dataset? (CSV, JSON, etc. with experimental data)
- Is this something else? (research proposal, study protocol, etc.)

Explain your reasoning.

### 2. Select Pipeline Mode
- **Mode A (SIMULATED)**: Input is a topic, RQ, or proposal → full pipeline with simulated participants
- **Mode B (REAL_DATA)**: Input is a dataset → skip data collection, analyze the provided data

### 3. Design the Phase Sequence
Design the optimal pipeline for this specific input. Common patterns:

**Mode A** (topic/RQ input):
  scope → design → collect → analyze → synthesize/plan → synthesize → review

**Mode B** (dataset input):
  scope/data-profile → scope/study-reconstruct → design/analysis-plan → analyze → synthesize/plan → synthesize → review

But you are NOT limited to these patterns. Adapt based on the input:
- Complex multi-study designs may need multiple analyze phases
- Qualitative research may need different analysis approaches
- A dataset with rich metadata might simplify reconstruction
- Mixed-methods research may need parallel qual + quant branches
- Add, remove, or restructure phases as the input demands

### 4. Node Specification
For each pipeline node, provide:
- **id**: Unique identifier. Use "/" for sub-phases (e.g., "scope/data-profile")
- **type**: One of: scope, design, collect, analyze, synthesize, review
- **title**: Human-readable description of what this node does
- **description**: Detailed instruction for the AI agent executing this node
- **dependsOn**: Array of node IDs that must complete first
- **outputArtifacts**: What this phase produces (e.g., ["scope/research_plan"])
- **inputArtifacts**: What this phase needs (e.g., ["scope/research_plan"])

## Rules
- The FIRST node must have dependsOn: []
- Every node (except the first) must depend on at least one earlier node
- ALWAYS include a "synthesize/plan" node (type: "synthesize") before the
  main "synthesize" node — the plan node decides what paper sections to write
- The "synthesize" node must depend on "synthesize/plan"
- The last node should be "review"
- If Mode A: include a "collect" node (will be expanded into persona subtasks)
- Ensure NO circular dependencies
- Use descriptive node IDs that reflect their purpose
${config.researchDomain ? `\nResearch domain: ${config.researchDomain}` : ''}\
${config.targetVenue ? `\nTarget venue: ${config.targetVenue}` : ''}\
${config.researchParadigm ? `\nResearch paradigm: ${config.researchParadigm}` : ''}

## Output
Write /app/output/pipeline_plan.json:
{
  "inputClassification": {
    "type": "topic" | "research_question" | "dataset",
    "mode": "A" | "B",
    "reasoning": "string — explain why you classified it this way"
  },
  "nodes": [
    {
      "id": "string",
      "type": "scope" | "design" | "collect" | "analyze" | "synthesize" | "review",
      "title": "string",
      "description": "string",
      "dependsOn": ["string"],
      "outputArtifacts": ["string"],
      "inputArtifacts": ["string"]
    }
  ]
}
`.trim();
}

/**
 * Prompt for the synthesize/plan node — AI agent reads all upstream
 * artifacts and decides what paper sections are needed.
 *
 * This replaces the hardcoded section list in expandSynthesizePhase().
 * The AI decides paper structure based on what research was actually
 * conducted — not a fixed template.
 */
export function sectionPlanPrompt(config: HCIConfig): string {
  const venue = config.targetVenue || 'ACM CHI';

  return `
You are an academic paper architect. Your job is to read all available
research artifacts and decide the optimal paper structure.

## Input
Read all files in /app/input/. These are the outputs of previous
pipeline phases: research plan, study protocol, statistical results,
analysis reports, data profiles, etc.

Understand the full scope of what was researched and produced.

## Your Task

### 1. Assess Available Content
- What research was conducted?
- What results were produced?
- Is this quantitative, qualitative, or mixed methods?
- Are there multiple studies or a single study?
- What is the core contribution?

### 2. Design the Paper Structure
Based on the available content and the target venue, decide:
- What sections the paper needs
- What order they should appear in
- What each section should cover

Standard HCI paper sections include:
  abstract, introduction, related_work, method, results, discussion, conclusion

But you MUST ADAPT based on the actual research:
- Multi-study papers need "study-1", "study-2" sections with sub-structure
- Design research may need a "design-process" section
- Papers with systems may need a "system-design" section
- Qualitative research may need "findings" instead of "results"
- Some venues expect "implications-for-design" as a separate section
- Papers with formative + summative studies need different structures
- Technical contributions may need an "implementation" section

### 3. Section Details
For each section, provide:
- **id**: kebab-case identifier (e.g., "related-work", "study-1-method")
- **title**: Display name (e.g., "Related Work", "Study 1: Method")
- **description**: What should be covered in this section — be specific
  about the content, structure, and purpose. This description will be
  passed directly to the AI writer as its primary instruction.
- **estimatedWords**: Rough word count target
- **inputArtifacts**: Which upstream artifacts are most relevant

## Target Venue: ${venue}
${config.researchDomain ? `Research Domain: ${config.researchDomain}` : ''}
${config.outputLanguage ? `Language: ${config.outputLanguage}` : ''}

## Output
Write /app/output/section_plan.json:
{
  "paperTitle": "string — suggested title based on the research",
  "sections": [
    {
      "id": "string",
      "title": "string",
      "description": "string — detailed writing instructions for this section",
      "estimatedWords": number,
      "inputArtifacts": ["string"]
    }
  ],
  "reasoning": "string — why you chose this structure"
}
`.trim();
}
