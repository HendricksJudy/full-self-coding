// Core functionality exports for the full-self-coding library

// Main engines (original FSC)
export { default as analyzeCodebase } from './analyzer';
export { TaskSolver } from './taskSolver';
export { TaskSolverManager } from './taskSolverManager';
export { CodeCommitter } from './codeCommitter';
export { DockerInstance } from './dockerInstance';

// Configuration (original FSC)
export { createConfig, type Config } from './config';
export { readConfigWithEnv } from './configReader';

// Types and interfaces (original FSC)
export type { Task } from './task';
export { getCodingStyle } from './codingStyle';
export type { WorkStyle } from './workStyle';

// Utilities
export * from './utils/getDateAndTime';
export * from './utils/trimJSON';
export * from './utils/git';

// Prompts (original FSC)
export * from './prompts/analyzerPrompt';
export * from './prompts/taskSolverPrompt';
export * from './prompts/codingStylePrompt';
export * from './prompts/diff_nodejs';

// SWE Agent commands
export * from './SWEAgent/claudeCodeCommands';
export * from './SWEAgent/codexCommands';
export * from './SWEAgent/cursorCommands';
export * from './SWEAgent/geminiCodeCommands';
export * from './SWEAgent/SWEAgentTaskSolverCommands';

// ====================================================================
// HCI Research Toolchain
// ====================================================================

// HCI Pipeline
export { PipelineOrchestrator } from './pipelineOrchestrator';
export { DAG } from './dag';
export { WorkspaceManager } from './workspace';
export { InputAnalyzer } from './inputAnalyzer';

// HCI Configuration
export { createHCIConfig, PipelineMode, InputType, type HCIConfig } from './hciConfig';

// HCI Data Models
export { PhaseType, PhaseStatus, type PhaseNode, type PhaseResult } from './phase';
export { ArtifactType, ArtifactFormat, type Artifact, type ArtifactManifest } from './artifact';
export type { PipelineState } from './pipelineState';

// Persona Engine
export { PersonaEngine } from './persona';
export type {
  PersonaProfile,
  PersonaContext,
  PersonaExperience,
  ExperienceEpisode,
  ParticipationResponse,
  StudyResponse,
  ParticipantRequirements,
  PersonaSlot,
} from './persona';
export { getEpisodeCount, getDepthMultiplier } from './persona';

// Data Profiler (thin loader — AI agents do the real data science)
export { DataProfiler, type DataSnapshot } from './dataProfiler';
export { KNOWN_QUESTIONNAIRES } from './dataProfiler';
export type { QuestionnaireSignature } from './dataProfiler';

// HCI Prompts
export { PromptRouter } from './prompts/hci/promptRouter';