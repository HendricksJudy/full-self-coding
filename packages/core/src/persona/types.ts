/**
 * Demographic and psychological profile of a simulated participant.
 */
export interface PersonaProfile {
  id: string;

  demographics: {
    age: number;
    gender: string;
    ethnicity?: string;
    education: string;
    occupation: string;
    incomeLevel?: string;
    location?: string;
    languages: string[];
  };

  techProfile: {
    proficiency: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
    dailyDevices: string[];
    frequentApps: string[];
    attitudeTowardTech: string;
  };

  personality: {
    openness: number;         // 0-100
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    summary: string;
  };

  studyRelevantAttributes: Record<string, any>;
}

/**
 * Full life context narrative for a persona.
 * Output of Context Engineering.
 */
export interface PersonaContext {
  personaId: string;
  lifeNarrative: string;
  relevantHabits: string;
  attitudesAndOpinions: string;
  painPoints: string;
  motivations: string;
}

/**
 * A single experience episode in a persona's history.
 */
export interface ExperienceEpisode {
  index: number;
  timeframe: string;
  scenario: string;
  reaction: string;
  takeaway: string;
  valence: number;  // -1.0 to +1.0
}

/**
 * Simulated experiential memory for a persona.
 * Output of Experience Engineering.
 */
export interface PersonaExperience {
  personaId: string;
  episodes: ExperienceEpisode[];
  synthesizedMemory: string;
  emotionalResidue: string;
  learnedBehaviors: string;
}

/**
 * A single response to a study item.
 */
export interface StudyResponse {
  itemId: string;
  value: string | number;
  reasoning: string;
}

/**
 * A persona's full response to the experimental materials.
 */
export interface ParticipationResponse {
  personaId: string;
  studyProtocolId: string;
  timestamp: number;
  responses: StudyResponse[];
  thinkAloud?: string;
  behavioralData?: Record<string, any>;
}

/**
 * Participant requirements extracted from study protocol.
 */
export interface ParticipantRequirements {
  totalCount: number;
  distributions?: Record<string, Record<string, number>>;
  conditions?: string[];
  assignmentStrategy?: 'random' | 'balanced';
  inclusionCriteria?: string[];
  exclusionCriteria?: string[];
}

/**
 * Slot info for a single persona during generation.
 */
export interface PersonaSlot {
  index: number;
  personaId: string;
  assignedCondition?: string;
  constrainedDemographics?: Record<string, string>;
}

/**
 * Episode count recommendations based on tech proficiency.
 */
export function getEpisodeCount(proficiency: string): { min: number; max: number } {
  switch (proficiency) {
    case 'novice':       return { min: 2, max: 4 };
    case 'beginner':     return { min: 4, max: 6 };
    case 'intermediate': return { min: 6, max: 10 };
    case 'advanced':     return { min: 10, max: 15 };
    case 'expert':       return { min: 15, max: 20 };
    default:             return { min: 4, max: 8 };
  }
}

/**
 * Depth multiplier for experience engineering.
 */
export function getDepthMultiplier(depth: 'shallow' | 'standard' | 'deep'): number {
  switch (depth) {
    case 'shallow':  return 0.5;
    case 'standard': return 1.0;
    case 'deep':     return 2.0;
    default:         return 1.0;
  }
}
