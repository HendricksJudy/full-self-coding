import type { PhaseNode } from './phase';
import type { Artifact } from './artifact';
import type { PipelineMode, InputType } from './hciConfig';

/**
 * Top-level pipeline state, persisted to pipeline.json in the workspace root.
 * Enables resumability: if the pipeline is interrupted, it can be reloaded
 * and execution continues from where it stopped.
 */
export interface PipelineState {
  /** Unique project identifier */
  projectId: string;

  /** Execution mode */
  mode: PipelineMode;

  /** Detected input type */
  inputType: InputType;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;

  /** Flat list of all nodes in the DAG (including subtasks) */
  nodes: PhaseNode[];

  /** All known artifacts */
  artifacts: Artifact[];
}
