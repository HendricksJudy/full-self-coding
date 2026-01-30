# Design Doc B: Persona Engine

## 1. Overview

The Persona Engine is the core of Mode A (simulated participants). It constructs
complete, psychologically coherent virtual participants by running a **nested
FSC-style pipeline** for each persona: analyze what attributes are needed,
build context, engineer experience, then have the persona participate in the
study.

**Key insight from the design discussion:** Forming a persona is itself an
FSC process. The persona's quality depends on the depth of its Context
Engineering and Experience Engineering, not just a flat profile description.

**Modules covered:**

| Module | File |
|--------|------|
| Persona Engine | `core/src/persona/personaEngine.ts` |
| Context Engineering | `core/src/persona/contextEngineering.ts` |
| Experience Engineering | `core/src/persona/experienceEngineering.ts` |
| Persona Types | `core/src/persona/types.ts` |
| Persona Prompts | `core/src/prompts/hci/personaPrompt.ts` |
|                  | `core/src/prompts/hci/contextPrompt.ts` |
|                  | `core/src/prompts/hci/experiencePrompt.ts` |
|                  | `core/src/prompts/hci/participatePrompt.ts` |

---

## 2. Architecture: Three-Level Nesting

```
Level 0: Research Pipeline (PipelineOrchestrator)
  │
  └─ COLLECT phase
       │
       └─ Level 1: Persona Construction (PersonaEngine)
            │
            ├─ Step 1: Analyze → what attributes does this persona need?
            │
            ├─ Step 2: Context Engineering → build full life context
            │
            ├─ Step 3: Experience Engineering ← Level 2 nesting
            │     │
            │     └─ Sub-FSC: analyze what experiences are relevant
            │                 → generate each experience episode
            │                 → synthesize into experiential memory
            │
            └─ Step 4: Participate → respond to study materials
```

**Physical execution is flat** (as agreed). All three levels are expanded into
the DAG as sibling nodes with dependency edges. No Docker-in-Docker. The
Orchestrator sees:

```
collect/persona-001/context       (depends on: design)
collect/persona-001/experience    (depends on: collect/persona-001/context)
collect/persona-001/participate   (depends on: collect/persona-001/experience)
```

Each runs in its own container with filesystem isolation.

---

## 3. Data Models

### 3.1 Persona Profile

```typescript
/**
 * Demographic and psychological profile of a simulated participant.
 * Generated during the Context Engineering step.
 */
export interface PersonaProfile {
  id: string;                          // e.g., "persona-001"

  // Demographics
  demographics: {
    age: number;
    gender: string;
    ethnicity?: string;
    education: string;                 // e.g., "Master's in Design"
    occupation: string;
    incomeLevel?: string;
    location?: string;                 // e.g., "urban, US Midwest"
    languages: string[];
  };

  // Tech profile
  techProfile: {
    proficiency: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
    dailyDevices: string[];            // e.g., ["iPhone 15", "MacBook Pro", "iPad"]
    frequentApps: string[];            // e.g., ["Slack", "Figma", "Spotify"]
    attitudeTowardTech: string;        // e.g., "early adopter, enthusiastic"
  };

  // Personality (Big Five)
  personality: {
    openness: number;                  // 0-100
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    summary: string;                   // natural language description
  };

  // Study-specific attributes (generated based on study_protocol.json)
  studyRelevantAttributes: Record<string, any>;
}
```

### 3.2 Persona Context

```typescript
/**
 * Full life context narrative for a persona.
 * This is the output of Context Engineering.
 */
export interface PersonaContext {
  personaId: string;

  /** Rich narrative of this person's background, values, daily life */
  lifeNarrative: string;

  /** Specific habits and routines relevant to the study domain */
  relevantHabits: string;

  /** Attitudes and opinions relevant to the study topic */
  attitudesAndOpinions: string;

  /** Frustrations and pain points relevant to the study domain */
  painPoints: string;

  /** Goals and motivations */
  motivations: string;
}
```

### 3.3 Persona Experience

```typescript
/**
 * Simulated experiential memory for a persona.
 * This is the output of Experience Engineering.
 */
export interface PersonaExperience {
  personaId: string;

  /** Ordered list of simulated experience episodes */
  episodes: ExperienceEpisode[];

  /** Synthesized memory: what the persona "remembers" from all episodes */
  synthesizedMemory: string;

  /** Emotional residue: overall feelings about the domain after experiences */
  emotionalResidue: string;

  /** Learned behaviors: what the persona learned to do/avoid */
  learnedBehaviors: string;
}

export interface ExperienceEpisode {
  /** Chronological index */
  index: number;

  /** When this happened in the persona's timeline, e.g., "6 months ago" */
  timeframe: string;

  /** What happened */
  scenario: string;

  /** How the persona reacted */
  reaction: string;

  /** What the persona took away from this experience */
  takeaway: string;

  /** Emotional valence: -1.0 (very negative) to +1.0 (very positive) */
  valence: number;
}
```

### 3.4 Participation Response

```typescript
/**
 * A persona's response to the experimental materials.
 */
export interface ParticipationResponse {
  personaId: string;
  studyProtocolId: string;
  timestamp: number;

  /** Responses to each study task / questionnaire item */
  responses: StudyResponse[];

  /** Think-aloud data (if the study protocol requires it) */
  thinkAloud?: string;

  /** Behavioral observations (e.g., simulated task completion time) */
  behavioralData?: Record<string, any>;
}

export interface StudyResponse {
  /** ID of the questionnaire item or task */
  itemId: string;

  /** The response value (Likert scale number, free text, selection, etc.) */
  value: string | number;

  /** Reasoning: why this persona gave this response (internal, for audit) */
  reasoning: string;
}
```

---

## 4. Module: Persona Engine (`personaEngine.ts`)

### 4.1 Responsibility

Orchestrates the full persona construction pipeline for one persona.
Called by the PipelineOrchestrator when a persona subtask node becomes ready.

**Not a separate orchestrator** -- it generates the PhaseNodes that the main
Orchestrator's DAG will execute. The PersonaEngine is a **node factory**, not
an executor.

### 4.2 Interface

```typescript
export class PersonaEngine {
  /**
   * Given a study protocol, generate the DAG nodes needed to construct
   * and run N personas through the study.
   *
   * Called by PipelineOrchestrator.maybeExpandDAG() when DESIGN completes.
   *
   * @returns PhaseNode[] to be added to the DAG under the COLLECT phase
   */
  static generatePersonaNodes(
    studyProtocol: StudyProtocol,
    personaCount: number,
    config: HCIConfig,
  ): PhaseNode[] {
    const nodes: PhaseNode[] = [];
    const participateIds: string[] = [];

    for (let i = 1; i <= personaCount; i++) {
      const pid = String(i).padStart(3, '0');

      nodes.push({
        id: `collect/persona-${pid}/context`,
        type: PhaseType.COLLECT,
        title: `Build context for Persona ${pid}`,
        description: buildContextDescription(studyProtocol, pid),
        dependsOn: [],  // Can start immediately (in parallel with other personas)
        outputArtifacts: [`persona-${pid}/profile`, `persona-${pid}/context`],
        inputArtifacts: ['design/study_protocol'],
        status: PhaseStatus.PENDING,
      });

      nodes.push({
        id: `collect/persona-${pid}/experience`,
        type: PhaseType.COLLECT,
        title: `Engineer experience for Persona ${pid}`,
        description: buildExperienceDescription(studyProtocol, pid),
        dependsOn: [`collect/persona-${pid}/context`],
        outputArtifacts: [`persona-${pid}/experience`],
        inputArtifacts: [`persona-${pid}/profile`, `persona-${pid}/context`, 'design/study_protocol'],
        status: PhaseStatus.PENDING,
      });

      nodes.push({
        id: `collect/persona-${pid}/participate`,
        type: PhaseType.COLLECT,
        title: `Persona ${pid} participates in study`,
        description: buildParticipateDescription(studyProtocol, pid),
        dependsOn: [`collect/persona-${pid}/experience`],
        outputArtifacts: [`persona-${pid}/response`],
        inputArtifacts: [
          `persona-${pid}/profile`,
          `persona-${pid}/context`,
          `persona-${pid}/experience`,
          'design/study_protocol',
          'design/questionnaire',
        ],
        status: PhaseStatus.PENDING,
      });

      participateIds.push(`collect/persona-${pid}/participate`);
    }

    // Aggregation node: collects all responses into raw_data.json
    nodes.push({
      id: 'collect/aggregate',
      type: PhaseType.COLLECT,
      title: 'Aggregate all participant responses',
      description: 'Combine all persona responses into a unified dataset for analysis.',
      dependsOn: participateIds,
      outputArtifacts: ['collect/raw_data'],
      inputArtifacts: participateIds.map(id => id.replace('participate', 'response')),
      status: PhaseStatus.PENDING,
    });

    return nodes;
  }
}
```

---

## 5. Module: Context Engineering (`contextEngineering.ts`)

### 5.1 Responsibility

Given a study protocol and a persona slot (index, required attributes),
generate a complete, coherent PersonaProfile + PersonaContext.

This runs inside a Docker container as a single AI agent task.

### 5.2 Process

```
Input:
  - study_protocol.json (what is being studied, what variables matter)
  - persona slot info (index, any assigned conditions/groups)

AI Agent receives prompt that instructs:

  1. Read the study protocol
  2. Understand what demographic and psychological attributes are relevant
  3. Generate a PersonaProfile with:
     - Realistic demographics (respecting study's target population)
     - Coherent personality traits
     - Technology profile appropriate for the study domain
     - Study-relevant attributes
  4. Then generate a PersonaContext with:
     - A life narrative that explains WHY this person has these attributes
     - Relevant habits grounded in the narrative
     - Attitudes that follow logically from the personality + background
     - Pain points and motivations

Output (written to persona directory):
  - profile.json  (PersonaProfile)
  - context.md    (PersonaContext as structured narrative)
```

### 5.3 Key Design Principle: Coherence Over Randomness

The prompt must instruct the AI to build the persona **top-down from a
narrative**, not bottom-up from random attribute sampling.

Bad: "Age: 34, Gender: Female, Tech: Expert" (random rolls)
Good: "Jun is a 34-year-old UX researcher at a mid-size SaaS company in
Seattle. She switched from graphic design after her first kid was born,
finding remote work more compatible with parenting. This career shift means
she's highly tech-proficient but often nostalgic for tactile, physical
design tools..."

The narrative creates internal consistency that LLMs can maintain throughout
the participation phase.

### 5.4 Diversity Control

The study protocol specifies participant demographics. Context Engineering
must ensure the full set of personas represents the required distribution:

```typescript
/**
 * Extracted from study_protocol.json.
 * Constrains persona generation.
 */
export interface ParticipantRequirements {
  totalCount: number;

  /** Distribution constraints, e.g., {"gender": {"male": 15, "female": 15}} */
  distributions?: Record<string, Record<string, number>>;

  /** Required conditions/groups, e.g., ["control", "treatment_A", "treatment_B"] */
  conditions?: string[];

  /** Assignment strategy */
  assignmentStrategy?: 'random' | 'balanced';

  /** Inclusion criteria */
  inclusionCriteria?: string[];

  /** Exclusion criteria */
  exclusionCriteria?: string[];
}
```

The PersonaEngine pre-assigns group/condition before Context Engineering runs,
so each persona's context prompt includes its assigned condition.

### 5.5 Prompt Template (`contextPrompt.ts`)

```typescript
export function contextPrompt(
  studyProtocol: StudyProtocol,
  personaSlot: PersonaSlot,
  config: HCIConfig,
): string {
  return `
You are constructing a simulated research participant for an HCI study.

## Study Context
${JSON.stringify(studyProtocol, null, 2)}

## Your Task
Create a complete, psychologically coherent persona for participant slot #${personaSlot.index}.

### Assigned Attributes
${personaSlot.assignedCondition ? `- Experimental condition: ${personaSlot.assignedCondition}` : ''}
${personaSlot.constrainedDemographics ? `- Required demographics: ${JSON.stringify(personaSlot.constrainedDemographics)}` : ''}

### Instructions
1. Start by imagining a real person. Give them a name, a life story.
2. Build their personality FIRST (Big Five traits), then derive behaviors from it.
3. Their technology profile must be CONSISTENT with their age, occupation, and personality.
4. Their attitudes toward the study topic must follow LOGICALLY from their experiences.
5. Do NOT make them a caricature. Real people are nuanced and sometimes contradictory.

### Output Format
Write two files:

**profile.json**: A JSON object conforming to PersonaProfile interface.
**context.md**: A structured narrative covering:
- Life narrative (2-3 paragraphs)
- Relevant habits and routines
- Attitudes and opinions on ${config.researchDomain || 'the study topic'}
- Pain points and frustrations
- Goals and motivations
`.trim();
}
```

---

## 6. Module: Experience Engineering (`experienceEngineering.ts`)

### 6.1 Responsibility

Given a fully constructed persona (profile + context), simulate a history of
relevant experiences that the persona would have had BEFORE participating in
the study. This is the **Level 2 nesting** -- the most novel part of the
architecture.

### 6.2 Why This Matters

Consider a study on voice assistant usability. A persona who is described as
an "experienced Siri user" will give shallow responses unless they have
simulated memories of actual Siri interactions: the time it misunderstood
them in a noisy car, the time it saved them from missing a meeting, the
frustrating music playback failures.

Experience Engineering creates these memories.

### 6.3 Process

```
Input:
  - profile.json (who this person is)
  - context.md (their background and attitudes)
  - study_protocol.json (what domain is being studied)

AI Agent receives prompt that instructs:

  1. Read the persona's profile and context
  2. Identify what DOMAIN EXPERIENCES are relevant to the study
     (e.g., for a voice UI study: past interactions with voice assistants)
  3. Generate a chronological sequence of experience episodes:
     - Each episode is a specific scenario (time, place, what happened)
     - The persona's reaction is consistent with their personality
     - Outcomes vary: some positive, some negative, some neutral
     - Episodes build on each other (learned behaviors carry forward)
  4. Synthesize all episodes into:
     - A "memory" narrative (what the persona would recall if asked)
     - Emotional residue (overall feeling about the domain)
     - Learned behaviors (habits formed from experience)

Output (written to persona directory):
  - experience.md (PersonaExperience as structured narrative)
```

### 6.4 Episode Generation Strategy

The number and nature of episodes depends on the persona's claimed
experience level:

| Tech Proficiency | Episode Count | Valence Distribution |
|-----------------|---------------|---------------------|
| novice | 2-4 | mostly neutral, 1 negative (why they stopped/never started) |
| beginner | 4-6 | mixed, skewing curious |
| intermediate | 6-10 | balanced positive/negative |
| advanced | 10-15 | mostly positive, some frustrations |
| expert | 15-20 | nuanced, strong opinions from deep experience |

### 6.5 Prompt Template (`experiencePrompt.ts`)

```typescript
export function experiencePrompt(
  profile: PersonaProfile,
  context: PersonaContext,
  studyProtocol: StudyProtocol,
  config: HCIConfig,
): string {
  return `
You are engineering simulated experiential memories for a research participant.

## Who This Person Is
${JSON.stringify(profile, null, 2)}

## Their Life Context
${context.lifeNarrative}
${context.relevantHabits}
${context.attitudesAndOpinions}

## Study Domain
This study is about: ${studyProtocol.researchQuestion}
Domain: ${config.researchDomain || studyProtocol.domain}

## Your Task
Generate a chronological sequence of experience episodes that this person
would have had with ${config.researchDomain || 'the relevant technology/domain'}
BEFORE they participate in this study.

### Rules
1. Each episode must be a SPECIFIC scenario, not a vague summary.
   Bad:  "She used Siri sometimes and it was okay."
   Good: "Three months ago, while driving to daycare in morning traffic,
          Jun tried asking Siri to call her husband. Siri misheard 'David'
          as 'Garage' and started navigating. She had to pull over to fix it.
          Since then, she only uses Siri for simple timers."

2. Episodes must be CONSISTENT with the persona's personality.
   A high-conscientiousness person notices and remembers specific details.
   A high-neuroticism person emphasizes negative experiences.
   A high-openness person experiments more and tries new features.

3. Later episodes should REFERENCE earlier ones.
   "After the car incident (Episode 3), she started speaking more slowly
    and clearly to voice assistants."

4. Include at least one episode that creates a STRONG OPINION the persona
   will carry into the study.

5. End with a synthesis:
   - What would this persona say if asked "Tell me about your experience with X"?
   - What is their gut feeling about the technology?
   - What specific behaviors have they developed?

### Episode Count
Based on their tech proficiency (${profile.techProfile.proficiency}),
generate ${getEpisodeCount(profile.techProfile.proficiency)} episodes.

### Output Format
Write experience.md with:
- Episodes (numbered, chronological)
- Synthesized Memory section
- Emotional Residue section
- Learned Behaviors section
`.trim();
}
```

---

## 7. Participation Phase

### 7.1 Responsibility

The final step: the fully constructed persona (profile + context + experience)
"participates" in the study by responding to experimental materials.

### 7.2 Process

```
Input:
  - profile.json
  - context.md
  - experience.md     ← This is what makes responses realistic
  - study_protocol.json
  - questionnaire.json (or experimental task description)

AI Agent receives prompt that instructs:

  1. BECOME this persona. Internalize their profile, context, and experiences.
  2. Read the study materials as this persona would.
  3. For each questionnaire item / task:
     - Think about how this person would respond, given their experiences.
     - Record the response AND the internal reasoning.
  4. If think-aloud is required, produce a think-aloud transcript.
  5. If behavioral metrics are needed (e.g., simulated time-on-task),
     estimate them based on the persona's proficiency and the task difficulty.

Output:
  - response.json (ParticipationResponse)
```

### 7.3 Prompt Template (`participatePrompt.ts`)

```typescript
export function participatePrompt(
  profile: PersonaProfile,
  context: PersonaContext,
  experience: PersonaExperience,
  studyProtocol: StudyProtocol,
  questionnaire: Questionnaire,
): string {
  return `
You are now ${profile.demographics.occupation} named [from profile].
You are participating in a research study.

## YOUR IDENTITY
${context.lifeNarrative}

## YOUR EXPERIENCES WITH ${studyProtocol.domain?.toUpperCase()}
${experience.synthesizedMemory}

Your overall feeling: ${experience.emotionalResidue}
Your habits: ${experience.learnedBehaviors}

## STUDY MATERIALS
${JSON.stringify(questionnaire, null, 2)}

## INSTRUCTIONS
Respond to each item AS THIS PERSON. Not as an AI. Not as an average person.
As THIS specific person with THESE specific experiences.

For each item, provide:
1. Your response (the value you'd select or write)
2. Your internal reasoning (why this person gives this answer)

Important:
- Your Likert scale responses should reflect your personality.
  High-agreeableness people tend toward positive responses.
  High-neuroticism people notice more problems.
- Your free-text responses should use vocabulary consistent with your
  education level and occupation.
- If a question touches on something from your experience episodes,
  your response should be influenced by that specific memory.
- Be internally consistent. If you said you dislike X in one question,
  don't praise X in another.

## OUTPUT FORMAT
Write response.json as a ParticipationResponse object.
`.trim();
}
```

---

## 8. Filesystem Layout (per persona)

```
phases/collect/personas/persona-001/
├── profile.json        ← Context Engineering output
├── context.md          ← Context Engineering output
├── experience.md       ← Experience Engineering output
└── response.json       ← Participation output
```

Each step reads the outputs of previous steps (via read-only mounts) and
writes to its own workspace (read-write mount).

---

## 9. Quality Control Mechanisms

### 9.1 Internal Consistency Check

After Context Engineering, before Experience Engineering, optionally run a
validation step:

```typescript
/**
 * Verify that a persona's profile and context are internally consistent.
 * E.g., a "novice" tech user shouldn't be described as building custom PCs.
 */
export async function validatePersonaConsistency(
  profile: PersonaProfile,
  context: PersonaContext,
): Promise<{ valid: boolean; issues: string[] }>;
```

### 9.2 Response Distribution Check

After all personas have participated, the aggregation node checks:
- Are responses suspiciously uniform? (LLMs tend toward consensus)
- Do responses correlate with persona attributes as expected?
- Is there sufficient variance for statistical analysis?

If variance is too low, the aggregation node can flag this in its report.
The ANALYZE phase will note it as a limitation.

### 9.3 Audit Trail

Every persona's `response.json` includes `reasoning` for each answer. This
allows post-hoc review of whether the simulated responses are grounded in
the persona's context and experiences, not hallucinated.

---

## 10. Parallelism

Persona construction is embarrassingly parallel at the persona level:

```
persona-001/context  ─→  persona-001/experience  ─→  persona-001/participate
persona-002/context  ─→  persona-002/experience  ─→  persona-002/participate
persona-003/context  ─→  persona-003/experience  ─→  persona-003/participate
...                      (all rows run in parallel)
```

With `maxParallelDockerContainers = 10` and 30 personas, the system
processes personas in waves of 10.

The DAG engine (Doc A) handles this naturally -- all `context` nodes have no
cross-persona dependencies, so `getReadyNodes()` returns all of them at once.

---

## 11. Extensibility

### 11.1 Custom Persona Templates

Users can provide their own persona template via config:

```typescript
// In HCIConfig
customPersonaTemplate?: string;  // Path to a persona prompt template file
```

### 11.2 Pre-defined Persona Pools

For reproducibility, users can provide a pre-made `personas.json` file
with fixed profiles. Experience Engineering and Participation still run,
but Context Engineering is skipped.

### 11.3 Experience Engineering Depth Control

```typescript
// In HCIConfig
experienceDepth?: 'shallow' | 'standard' | 'deep';
// shallow:  2-4 episodes per persona
// standard: personality-based count (default)
// deep:     2x standard count
```
