import { PhaseType, PhaseStatus, type PhaseNode } from '../phase';
import type { HCIConfig } from '../hciConfig';
import type { PersonaSlot } from './types';

/**
 * Generates DAG nodes for persona construction and study participation.
 *
 * This is a node factory, not an executor. It produces the PhaseNode[]
 * that the PipelineOrchestrator's DAG will schedule and execute.
 *
 * For each persona, three sequential nodes are created:
 *   1. Context Engineering   — build full life context
 *   2. Experience Engineering — simulate domain-relevant experiences
 *   3. Participation          — respond to study materials as this persona
 *
 * Plus an aggregation node that waits for all personas to finish.
 */
export class PersonaEngine {
  /**
   * Generate DAG nodes for N personas.
   * Called by PipelineOrchestrator.maybeExpandDAG() when DESIGN completes.
   */
  static generatePersonaNodes(
    personaCount: number,
    config: HCIConfig,
  ): PhaseNode[] {
    const nodes: PhaseNode[] = [];
    const participateIds: string[] = [];

    for (let i = 1; i <= personaCount; i++) {
      const pid = String(i).padStart(3, '0');
      const slot: PersonaSlot = {
        index: i,
        personaId: `persona-${pid}`,
      };

      // Step 1: Context Engineering
      nodes.push({
        id: `collect/persona-${pid}/context`,
        type: PhaseType.COLLECT,
        title: `Build context for Persona ${pid}`,
        description: PersonaEngine.buildContextDescription(slot, config),
        dependsOn: [],  // Can start immediately (parallel with other personas)
        status: PhaseStatus.PENDING,
        outputArtifacts: [
          `persona-${pid}/profile`,
          `persona-${pid}/context`,
        ],
        inputArtifacts: [
          'design/study_protocol',
          'design/questionnaire',
        ],
      });

      // Step 2: Experience Engineering
      nodes.push({
        id: `collect/persona-${pid}/experience`,
        type: PhaseType.COLLECT,
        title: `Engineer experience for Persona ${pid}`,
        description: PersonaEngine.buildExperienceDescription(slot, config),
        dependsOn: [`collect/persona-${pid}/context`],
        status: PhaseStatus.PENDING,
        outputArtifacts: [`persona-${pid}/experience`],
        inputArtifacts: [
          `persona-${pid}/profile`,
          `persona-${pid}/context`,
          'design/study_protocol',
        ],
      });

      // Step 3: Participation
      nodes.push({
        id: `collect/persona-${pid}/participate`,
        type: PhaseType.COLLECT,
        title: `Persona ${pid} participates in study`,
        description: PersonaEngine.buildParticipateDescription(slot, config),
        dependsOn: [`collect/persona-${pid}/experience`],
        status: PhaseStatus.PENDING,
        outputArtifacts: [`persona-${pid}/response`],
        inputArtifacts: [
          `persona-${pid}/profile`,
          `persona-${pid}/context`,
          `persona-${pid}/experience`,
          'design/study_protocol',
          'design/questionnaire',
        ],
      });

      participateIds.push(`collect/persona-${pid}/participate`);
    }

    // Aggregation node: collects all responses into raw_data.json
    nodes.push({
      id: 'collect/aggregate',
      type: PhaseType.COLLECT,
      title: 'Aggregate all participant responses',
      description:
        'Combine all persona responses into a unified dataset for statistical analysis. ' +
        'Read all response.json files from each persona directory, merge into a single ' +
        'CSV/JSON dataset with one row per participant (or one row per trial for within-subjects). ' +
        'Include all questionnaire responses, behavioral data, and demographic variables.',
      dependsOn: participateIds,
      status: PhaseStatus.PENDING,
      outputArtifacts: ['collect/raw_data'],
      inputArtifacts: participateIds.map(
        (id) => id.replace('/participate', '/response'),
      ),
    });

    return nodes;
  }

  /**
   * Build the description for a Context Engineering node.
   */
  private static buildContextDescription(slot: PersonaSlot, config: HCIConfig): string {
    return [
      `Construct a complete, psychologically coherent simulated research participant (${slot.personaId}).`,
      '',
      'Read the study protocol from /app/input/ and create:',
      '1. profile.json — PersonaProfile with demographics, tech profile, Big Five personality, study-relevant attributes',
      '2. context.md — Rich life narrative, relevant habits, attitudes, pain points, motivations',
      '',
      'Key principles:',
      '- Build the persona TOP-DOWN from a narrative, not bottom-up from random attributes.',
      '- The narrative must explain WHY this person has these attributes.',
      '- Personality traits must be internally consistent with behaviors.',
      config.researchDomain ? `- Research domain: ${config.researchDomain}` : '',
      '',
      'Write output to /app/output/profile.json and /app/output/context.md',
    ].filter(Boolean).join('\n');
  }

  /**
   * Build the description for an Experience Engineering node.
   */
  private static buildExperienceDescription(slot: PersonaSlot, config: HCIConfig): string {
    const depth = config.experienceDepth || 'standard';
    return [
      `Engineer simulated experiential memories for ${slot.personaId}.`,
      '',
      'Read the persona profile and context from /app/input/, then generate:',
      '- A chronological sequence of experience episodes with the study domain',
      '- Each episode: specific scenario, persona reaction, takeaway, emotional valence',
      '- Episodes must be CONSISTENT with the persona personality',
      '- Later episodes must REFERENCE earlier ones (learned behaviors carry forward)',
      '',
      `Experience depth: ${depth}`,
      config.researchDomain ? `Domain: ${config.researchDomain}` : '',
      '',
      'Output: experience.md with:',
      '- Numbered episodes',
      '- Synthesized Memory section',
      '- Emotional Residue section',
      '- Learned Behaviors section',
      '',
      'Write to /app/output/experience.md',
    ].filter(Boolean).join('\n');
  }

  /**
   * Build the description for a Participation node.
   */
  private static buildParticipateDescription(slot: PersonaSlot, config: HCIConfig): string {
    return [
      `${slot.personaId} participates in the study as a simulated participant.`,
      '',
      'Read the persona profile, context, experience, study protocol, and questionnaire from /app/input/.',
      '',
      'BECOME this persona. Internalize their profile, context, and experiences.',
      'For each questionnaire item or study task:',
      '1. Think about how THIS PERSON would respond, given their experiences',
      '2. Record the response AND internal reasoning',
      '3. Be internally consistent across all responses',
      '',
      'Rules:',
      '- Likert responses reflect personality (high agreeableness → positive bias)',
      '- Free-text uses vocabulary matching education level and occupation',
      '- If a question touches a specific experience episode, that memory influences the response',
      '- Never break character. You are this person, not an AI.',
      '',
      'Output: response.json as a ParticipationResponse object.',
      'Write to /app/output/response.json',
    ].join('\n');
  }
}
