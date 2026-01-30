/**
 * Phase types for the HCI research pipeline.
 * Each phase represents a distinct stage of the research process.
 */
export enum PhaseType {
  PLAN       = 'plan',
  SCOPE      = 'scope',
  DESIGN     = 'design',
  COLLECT    = 'collect',
  ANALYZE    = 'analyze',
  SYNTHESIZE = 'synthesize',
  REVIEW     = 'review',
}

/**
 * Execution status for a phase node.
 */
export enum PhaseStatus {
  PENDING   = 'pending',
  RUNNING   = 'running',
  COMPLETED = 'completed',
  FAILED    = 'failed',
  SKIPPED   = 'skipped',
}

/**
 * A node in the execution DAG.
 * Can represent a top-level phase or a subtask within a phase
 * (e.g., a single persona construction job inside the COLLECT phase).
 */
export interface PhaseNode {
  /** Unique identifier, e.g. "scope", "collect/persona-007/context" */
  id: string;

  /** Phase category this node belongs to */
  type: PhaseType;

  /** Human-readable label */
  title: string;

  /** Detailed instruction for the AI agent executing this node */
  description: string;

  /** IDs of nodes that must complete before this node can start */
  dependsOn: string[];

  /** Current execution status */
  status: PhaseStatus;

  /** Artifact IDs this node is expected to produce */
  outputArtifacts: string[];

  /** Artifact IDs this node needs to read (derived from dependsOn) */
  inputArtifacts: string[];

  /** Timestamps */
  startedAt?: number;
  completedAt?: number;

  /** Error message if status === FAILED */
  error?: string;

  /** Subtask nodes (only for top-level phases that expand internally) */
  children?: PhaseNode[];
}

/**
 * Result of executing a phase node.
 */
export interface PhaseResult {
  nodeId: string;
  status: PhaseStatus;
  error?: string;
  outputArtifactIds: string[];
  startedAt: number;
  completedAt: number;
}
