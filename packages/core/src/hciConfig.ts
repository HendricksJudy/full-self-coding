import { type Config, createConfig } from './config';

/**
 * Pipeline execution mode.
 */
export enum PipelineMode {
  /** Mode A: LLM simulates participants */
  SIMULATED = 'A',
  /** Mode B: Human provides real data, everything else automated */
  REAL_DATA = 'B',
}

/**
 * Type of input the user provided.
 */
export enum InputType {
  TOPIC             = 'topic',
  RESEARCH_QUESTION = 'research_question',
  DATASET           = 'dataset',
}

/**
 * HCI-specific configuration extending the base FSC Config.
 */
export interface HCIConfig extends Config {
  /** Pipeline mode override (auto-detected from input if not set) */
  pipelineMode?: PipelineMode;

  /** Where to store workspace data. Default: ~/.fsc-hci/workspace/ */
  workspaceBaseDir?: string;

  /** Research domain hint (helps prompt generation) */
  researchDomain?: string;

  /** Target venue format, e.g. "CHI", "UIST", "CSCW", "IEEE VR" */
  targetVenue?: string;

  /** Preferred statistical framework */
  statisticalFramework?: 'frequentist' | 'bayesian' | 'both';

  /** Number of simulated participants for Mode A. Default: 30 */
  simulatedParticipantCount?: number;

  /** Research paradigm */
  researchParadigm?: 'quantitative' | 'qualitative' | 'mixed';

  /** Language for paper output. Default: 'en' */
  outputLanguage?: string;

  /** Experience engineering depth control */
  experienceDepth?: 'shallow' | 'standard' | 'deep';

  /** Custom persona template file path */
  customPersonaTemplate?: string;

  /** Pre-defined persona pool file path (skips context engineering) */
  personaPoolPath?: string;
}

/**
 * Default HCI configuration values.
 */
export const DEFAULT_HCI_CONFIG: Partial<HCIConfig> = {
  workspaceBaseDir: undefined,  // resolved at runtime to ~/.fsc-hci/workspace/
  statisticalFramework: 'frequentist',
  simulatedParticipantCount: 30,
  researchParadigm: 'quantitative',
  outputLanguage: 'en',
  experienceDepth: 'standard',
};

/**
 * Merge user HCI config with defaults.
 */
export function createHCIConfig(userConfig: Partial<HCIConfig>): HCIConfig {
  const baseConfig = createConfig(userConfig);
  return {
    ...baseConfig,
    ...DEFAULT_HCI_CONFIG,
    ...userConfig,
  };
}
