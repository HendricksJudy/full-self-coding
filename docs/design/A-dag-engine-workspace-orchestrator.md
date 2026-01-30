# Design Doc A: DAG Engine, Workspace Manager, Pipeline Orchestrator

## 1. Overview

This document describes the core infrastructure for the HCI research toolchain:
three modules that replace FSC's linear `TaskSolverManager` with a DAG-based
multi-phase execution engine backed by filesystem isolation.

**Modules covered:**

| Module | File | Replaces |
|--------|------|----------|
| DAG Engine | `core/src/dag.ts` | (new) |
| Workspace Manager | `core/src/workspace.ts` | (new) |
| Pipeline Orchestrator | `core/src/pipelineOrchestrator.ts` | `taskSolverManager.ts` |
| Phase & Artifact models | `core/src/phase.ts`, `core/src/artifact.ts` | `task.ts` (extended) |
| Input Analyzer | `core/src/inputAnalyzer.ts` | `analyzer.ts` |
| HCI Config extensions | `core/src/config.ts` (extended) | - |

---

## 2. Data Models

### 2.1 Phase

Replaces the flat `Task` concept with a typed, dependency-aware unit of work.

```typescript
/**
 * The six ordered research phases.
 * Each phase may contain parallel subtasks internally.
 */
export enum PhaseType {
  SCOPE       = 'scope',
  DESIGN      = 'design',
  COLLECT     = 'collect',
  ANALYZE     = 'analyze',
  SYNTHESIZE  = 'synthesize',
  REVIEW      = 'review',
}

export enum PhaseStatus {
  PENDING     = 'pending',
  RUNNING     = 'running',
  COMPLETED   = 'completed',
  FAILED      = 'failed',
  SKIPPED     = 'skipped',
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
```

### 2.2 Artifact

Typed intermediate outputs that flow between phases via the filesystem.

```typescript
export enum ArtifactType {
  RESEARCH_PLAN     = 'research_plan',
  STUDY_PROTOCOL    = 'study_protocol',
  QUESTIONNAIRE     = 'questionnaire',
  VARIABLES         = 'variables',
  PERSONA_PROFILE   = 'persona_profile',
  PERSONA_CONTEXT   = 'persona_context',
  PERSONA_EXPERIENCE = 'persona_experience',
  PERSONA_RESPONSE  = 'persona_response',
  RAW_DATA          = 'raw_data',
  ANALYSIS_SCRIPT   = 'analysis_script',
  RESULTS           = 'results',
  RESULTS_APA       = 'results_apa',
  FIGURE            = 'figure',
  PAPER_SECTION     = 'paper_section',
  PAPER_DRAFT       = 'paper_draft',
  REVIEW_REPORT     = 'review_report',
  FINAL_PACKAGE     = 'final_package',
}

export enum ArtifactFormat {
  JSON = 'json',
  CSV  = 'csv',
  MD   = 'md',
  PDF  = 'pdf',
  PNG  = 'png',
  R    = 'r',
  PY   = 'py',
  TEX  = 'tex',
}

export interface Artifact {
  /** Unique ID, e.g. "scope/research_plan" */
  id: string;

  type: ArtifactType;
  format: ArtifactFormat;

  /** Relative path within the workspace, e.g. "phases/scope/output/research_plan.json" */
  path: string;

  /** ID of the PhaseNode that produced this artifact */
  producedBy: string;

  /** Timestamp when artifact was written */
  createdAt?: number;
}
```

### 2.3 Pipeline State

The top-level object persisted to `pipeline.json` in the workspace root.

```typescript
export enum PipelineMode {
  /** LLM simulates participants */
  SIMULATED = 'A',
  /** Human provides real data */
  REAL_DATA = 'B',
}

export enum InputType {
  TOPIC             = 'topic',
  RESEARCH_QUESTION = 'research_question',
  DATASET           = 'dataset',
}

export interface PipelineState {
  projectId: string;
  mode: PipelineMode;
  inputType: InputType;
  createdAt: number;
  updatedAt: number;

  /** Flat list of all nodes in the DAG (including subtasks) */
  nodes: PhaseNode[];

  /** All known artifacts */
  artifacts: Artifact[];
}
```

---

## 3. Module: DAG Engine (`dag.ts`)

### 3.1 Responsibility

Pure logic module (no I/O). Manages the dependency graph: determines which nodes
are ready to run, validates the graph has no cycles, and provides topological
ordering.

### 3.2 Interface

```typescript
export class DAG {
  private nodes: Map<string, PhaseNode>;

  constructor(nodes: PhaseNode[]);

  /**
   * Returns nodes whose dependencies are ALL completed
   * and whose own status is PENDING.
   */
  getReadyNodes(): PhaseNode[];

  /**
   * Mark a node as RUNNING / COMPLETED / FAILED.
   * When marking COMPLETED, automatically checks if
   * downstream nodes become ready.
   */
  updateStatus(nodeId: string, status: PhaseStatus, error?: string): void;

  /**
   * Validate graph integrity:
   * - No cycles
   * - All dependsOn references point to existing nodes
   * - At least one root node (no dependencies)
   * Returns list of validation errors (empty = valid).
   */
  validate(): string[];

  /**
   * Returns full topological ordering (for display / logging).
   */
  getTopologicalOrder(): string[];

  /**
   * Expand a node by adding child subtasks.
   * Used when a phase (e.g. COLLECT) needs to dynamically
   * generate persona subtasks after DESIGN completes.
   */
  expandNode(parentId: string, children: PhaseNode[]): void;

  /**
   * Returns all nodes as a flat array (including children).
   */
  getAllNodes(): PhaseNode[];

  /**
   * Check if entire DAG is complete (all nodes COMPLETED or SKIPPED).
   */
  isComplete(): boolean;

  /**
   * Check if DAG is stuck (no ready nodes, but not complete).
   */
  isStuck(): boolean;
}
```

### 3.3 Key Algorithm: `getReadyNodes()`

```
for each node in nodes:
  if node.status !== PENDING: skip
  if all nodes in node.dependsOn have status COMPLETED:
    add to readyList
return readyList
```

This is the scheduling heartbeat. The Orchestrator calls this in a loop.

### 3.4 Dynamic Expansion

After the DESIGN phase completes, the COLLECT phase needs to generate N persona
subtasks. The DAG supports this via `expandNode()`:

```
Before expansion:
  design (COMPLETED) --> collect (PENDING)

expandNode("collect", [
  { id: "collect/persona-001/context", dependsOn: [] },
  { id: "collect/persona-001/experience", dependsOn: ["collect/persona-001/context"] },
  { id: "collect/persona-001/participate", dependsOn: ["collect/persona-001/experience"] },
  { id: "collect/persona-002/context", dependsOn: [] },
  ...
  { id: "collect/aggregate", dependsOn: ["collect/persona-001/participate", "collect/persona-002/participate", ...] },
])

After expansion:
  The "collect" node status becomes a virtual parent.
  It is COMPLETED when all children are COMPLETED.
```

---

## 4. Module: Workspace Manager (`workspace.ts`)

### 4.1 Responsibility

Manages the filesystem layout for a research project. Creates directories,
enforces isolation rules, reads/writes artifacts.

### 4.2 Directory Structure

```
{workspaceRoot}/
├── pipeline.json
├── input/
│   └── (user-provided files + auto-generated meta.json)
├── phases/
│   ├── scope/
│   │   ├── status.json
│   │   └── output/
│   ├── design/
│   │   ├── status.json
│   │   └── output/
│   ├── collect/
│   │   ├── status.json
│   │   ├── personas/
│   │   │   ├── persona-001/
│   │   │   │   ├── profile.json
│   │   │   │   ├── context.md
│   │   │   │   ├── experience.md
│   │   │   │   └── response.json
│   │   │   └── ...
│   │   └── output/
│   ├── analyze/
│   │   ├── status.json
│   │   ├── scripts/
│   │   ├── figures/
│   │   └── output/
│   ├── synthesize/
│   │   ├── status.json
│   │   ├── sections/
│   │   └── output/
│   └── review/
│       ├── status.json
│       └── output/
└── artifacts/
    ├── manifest.json
    ├── paper.md
    ├── figures/
    ├── data/
    └── analysis_code/
```

### 4.3 Interface

```typescript
export class WorkspaceManager {
  private rootPath: string;

  constructor(projectId: string, baseDir?: string);

  /**
   * Create the full directory skeleton.
   * Called once when a new project starts.
   */
  async initialize(): Promise<void>;

  /**
   * Resolve absolute path for a phase node's working directory.
   * E.g., nodeId "collect/persona-001/context" -->
   *        "{root}/phases/collect/personas/persona-001/"
   */
  getNodeWorkDir(nodeId: string): string;

  /**
   * Resolve paths that a node is allowed to READ from,
   * based on its inputArtifacts / dependsOn.
   */
  getReadablePaths(node: PhaseNode): string[];

  /**
   * Resolve the path where a node should WRITE its output.
   */
  getOutputDir(nodeId: string): string;

  /**
   * Write an artifact file and register it in manifest.json.
   */
  async writeArtifact(artifact: Artifact, content: string | Buffer): Promise<void>;

  /**
   * Read an artifact by ID.
   */
  async readArtifact(artifactId: string): Promise<string>;

  /**
   * Persist pipeline state to pipeline.json.
   */
  async savePipelineState(state: PipelineState): Promise<void>;

  /**
   * Load pipeline state from pipeline.json.
   * Returns null if no saved state (new project).
   */
  async loadPipelineState(): Promise<PipelineState | null>;

  /**
   * Copy user input files into the input/ directory.
   */
  async importInput(sourcePath: string): Promise<void>;

  /**
   * Compile final deliverables into artifacts/ directory.
   */
  async compileArtifacts(state: PipelineState): Promise<void>;

  /**
   * Return workspace root path.
   */
  getRootPath(): string;
}
```

### 4.4 Isolation Rules

The filesystem is the isolation boundary. When the Orchestrator launches a
container for a node, it mounts:

| Mount | Mode | Purpose |
|-------|------|---------|
| `getNodeWorkDir(nodeId)` | read-write | Node's own workspace |
| `getOutputDir(depId)` for each dependency | read-only | Upstream artifacts |
| `input/` | read-only | Original user input |

The node **cannot** access sibling nodes or downstream directories. This is
enforced by Docker volume mount configuration, not by file permissions.

### 4.5 Workspace Location

Default: `~/.fsc-hci/workspace/{projectId}/`

Configurable via `HCIConfig.workspaceBaseDir`.

---

## 5. Module: Pipeline Orchestrator (`pipelineOrchestrator.ts`)

### 5.1 Responsibility

Top-level execution controller. Replaces `TaskSolverManager`. Drives the DAG
to completion by repeatedly finding ready nodes, executing them (in parallel
up to concurrency limit), and updating state.

### 5.2 Interface

```typescript
export class PipelineOrchestrator {
  private dag: DAG;
  private workspace: WorkspaceManager;
  private config: HCIConfig;
  private activeExecutions: Map<string, Promise<PhaseResult>>;

  constructor(config: HCIConfig);

  /**
   * Main entry point. Runs the full pipeline from input to final artifacts.
   *
   * Steps:
   * 1. Detect input type (topic / RQ / dataset)
   * 2. Build initial DAG (6 phases, linear dependencies)
   * 3. Initialize workspace
   * 4. Loop: getReadyNodes() -> execute in parallel -> update state
   * 5. When DAG complete, compile final artifacts
   */
  async run(inputPath: string): Promise<PipelineState>;

  /**
   * Resume a previously interrupted pipeline.
   * Loads state from workspace, reconstructs DAG, continues.
   */
  async resume(projectId: string): Promise<PipelineState>;
}
```

### 5.3 Execution Loop (Core Algorithm)

```
async run(inputPath):
  // 1. Detect input
  inputType = await InputAnalyzer.detect(inputPath)
  mode = inputType === DATASET ? PipelineMode.REAL_DATA : PipelineMode.SIMULATED

  // 2. Build initial DAG
  nodes = buildInitialDAG(mode)
  dag = new DAG(nodes)
  dag.validate()

  // 3. Init workspace
  workspace = new WorkspaceManager(projectId)
  await workspace.initialize()
  await workspace.importInput(inputPath)

  // 4. Execution loop
  while (!dag.isComplete()):
    readyNodes = dag.getReadyNodes()

    if readyNodes.length === 0 && !dag.isComplete():
      throw new Error("Pipeline stuck: no ready nodes but not complete")

    // Respect concurrency limit
    batch = readyNodes.slice(0, maxParallel - activeExecutions.size)

    for node in batch:
      dag.updateStatus(node.id, RUNNING)
      promise = executeNode(node)
      activeExecutions.set(node.id, promise)

    // Wait for at least one to complete
    completedId = await Promise.race(activeExecutions.values())
    activeExecutions.delete(completedId)

    // Persist state after each completion
    await workspace.savePipelineState(dag.getAllNodes())

    // Dynamic expansion: if a phase just completed and the next
    // phase needs subtask generation (e.g., DESIGN -> COLLECT),
    // expand the DAG now
    await maybeExpandDAG(completedId)

  // 5. Compile
  await workspace.compileArtifacts(state)
  return state
```

### 5.4 Node Execution (`executeNode`)

```
async executeNode(node: PhaseNode):
  // 1. Prepare Docker container
  docker = new DockerInstance()
  containerName = `hci-${node.id.replace(/\//g, '-')}-${Date.now()}`
  await docker.startContainer(config.dockerImageRef, containerName)

  // 2. Mount workspace paths
  //    (In practice: copy files into container, since FSC uses docker cp)
  workDir = workspace.getNodeWorkDir(node.id)
  readPaths = workspace.getReadablePaths(node)

  // Copy upstream artifacts into container at /app/input/
  for path in readPaths:
    await docker.copyFilesToContainer(path, '/app/input/')

  // 3. Generate prompt for this phase type
  prompt = PromptRouter.getPrompt(node, config)
  await docker.copyFileToContainer(prompt, '/app/prompt.txt')

  // 4. Run AI agent
  commands = AgentCommandRouter.getCommands(node.type, config)
  result = await docker.runCommandAsync(commands, config.dockerTimeoutSeconds)

  // 5. Extract output artifacts from container
  outputFiles = await docker.copyFileFromContainer('/app/output/')
  await workspace.writeArtifact(...)

  // 6. Cleanup
  await docker.shutdownContainer()

  // 7. Update DAG
  dag.updateStatus(node.id, COMPLETED)
```

### 5.5 Dynamic DAG Expansion

Certain phase transitions require generating new nodes:

| Trigger | Expansion |
|---------|-----------|
| DESIGN completed (Mode A) | Generate N persona subtask chains under COLLECT |
| DESIGN completed (Mode B) | Skip COLLECT or make it a single "data import" node |
| ANALYZE completed | Generate paper section subtasks under SYNTHESIZE |

```typescript
async maybeExpandDAG(completedNodeId: string): Promise<void> {
  const node = dag.getNode(completedNodeId);

  if (node.type === PhaseType.DESIGN && mode === PipelineMode.SIMULATED) {
    // Read study_protocol.json to determine persona count & attributes
    const protocol = await workspace.readArtifact('design/study_protocol');
    const parsed = JSON.parse(protocol);
    const personaCount = parsed.participants.sampleSize;

    const personaNodes: PhaseNode[] = [];
    const participateIds: string[] = [];

    for (let i = 1; i <= personaCount; i++) {
      const pid = String(i).padStart(3, '0');
      const contextId    = `collect/persona-${pid}/context`;
      const experienceId = `collect/persona-${pid}/experience`;
      const participateId = `collect/persona-${pid}/participate`;

      personaNodes.push(
        { id: contextId,     type: PhaseType.COLLECT, dependsOn: [],            ... },
        { id: experienceId,  type: PhaseType.COLLECT, dependsOn: [contextId],   ... },
        { id: participateId, type: PhaseType.COLLECT, dependsOn: [experienceId], ... },
      );
      participateIds.push(participateId);
    }

    // Aggregation node: waits for all personas to finish
    personaNodes.push({
      id: 'collect/aggregate',
      type: PhaseType.COLLECT,
      dependsOn: participateIds,
      ...
    });

    dag.expandNode('collect', personaNodes);
  }

  if (node.type === PhaseType.DESIGN && mode === PipelineMode.REAL_DATA) {
    // Mode B: the "collect" phase is just a passthrough.
    // User already provided data. Mark collect as completed immediately,
    // link input data as its output artifact.
    dag.updateStatus('collect', PhaseStatus.COMPLETED);
  }

  if (node.type === PhaseType.ANALYZE) {
    // Generate parallel paper sections under SYNTHESIZE
    const sections = ['abstract', 'introduction', 'related_work',
                      'method', 'results', 'discussion', 'conclusion'];
    const sectionNodes = sections.map(s => ({
      id: `synthesize/${s}`,
      type: PhaseType.SYNTHESIZE,
      dependsOn: [],  // all sections can be written in parallel
      ...
    }));
    sectionNodes.push({
      id: 'synthesize/compile',
      type: PhaseType.SYNTHESIZE,
      dependsOn: sections.map(s => `synthesize/${s}`),
      ...
    });
    dag.expandNode('synthesize', sectionNodes);
  }
}
```

---

## 6. Module: Input Analyzer (`inputAnalyzer.ts`)

### 6.1 Responsibility

Replaces `analyzer.ts`. Detects what the user provided and routes to the
correct pipeline mode.

### 6.2 Detection Logic

```typescript
export class InputAnalyzer {
  /**
   * Examine input path and determine:
   * - InputType (topic, research_question, dataset)
   * - PipelineMode (A or B)
   */
  static async detect(inputPath: string): Promise<{
    inputType: InputType;
    mode: PipelineMode;
    meta: Record<string, any>;
  }> {
    const stat = await fs.stat(inputPath);

    // Case 1: CSV / JSON data file -> Mode B (real data)
    if (isDataFile(inputPath)) {
      return {
        inputType: InputType.DATASET,
        mode: PipelineMode.REAL_DATA,
        meta: await profileDataFile(inputPath),
      };
    }

    // Case 2: Directory containing data files -> Mode B
    if (stat.isDirectory()) {
      return {
        inputType: InputType.DATASET,
        mode: PipelineMode.REAL_DATA,
        meta: await profileDataDirectory(inputPath),
      };
    }

    // Case 3: Text file -> analyze content with LLM to determine if
    //         it's a topic or a specific RQ
    if (isTextFile(inputPath)) {
      const content = await fs.readFile(inputPath, 'utf8');
      const classification = await classifyTextInput(content);
      return {
        inputType: classification.type,  // TOPIC or RESEARCH_QUESTION
        mode: PipelineMode.SIMULATED,    // Default to Mode A for text inputs
        meta: { content, ...classification },
      };
    }

    throw new Error(`Cannot determine input type for: ${inputPath}`);
  }
}
```

File type detection helpers:

```typescript
function isDataFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ['csv', 'tsv', 'json', 'jsonl', 'xlsx', 'parquet'].includes(ext || '');
}

function isTextFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ['txt', 'md', 'text'].includes(ext || '');
}
```

---

## 7. Config Extensions

Extend the existing `Config` interface:

```typescript
export interface HCIConfig extends Config {
  /** Pipeline mode override (auto-detected if not set) */
  pipelineMode?: PipelineMode;

  /** Where to store workspace data */
  workspaceBaseDir?: string;  // default: ~/.fsc-hci/workspace/

  /** Research domain hint (helps prompt generation) */
  researchDomain?: string;  // e.g., "voice interfaces", "mobile UX"

  /** Target venue format */
  targetVenue?: string;  // e.g., "CHI", "UIST", "CSCW", "IEEE VR"

  /** Preferred statistical framework */
  statisticalFramework?: 'frequentist' | 'bayesian' | 'both';

  /** Number of simulated participants (Mode A) */
  simulatedParticipantCount?: number;  // default: 30

  /** Research paradigm */
  researchParadigm?: 'quantitative' | 'qualitative' | 'mixed';

  /** Language for paper output */
  outputLanguage?: string;  // default: 'en'
}
```

---

## 8. Prompt Routing

Each phase type maps to a different prompt template:

```typescript
export class PromptRouter {
  static getPrompt(node: PhaseNode, config: HCIConfig): string {
    switch (node.type) {
      case PhaseType.SCOPE:      return scopePrompt(node, config);
      case PhaseType.DESIGN:     return designPrompt(node, config);
      case PhaseType.COLLECT:    return collectPrompt(node, config);  // routes to persona or data import
      case PhaseType.ANALYZE:    return analyzePrompt(node, config);
      case PhaseType.SYNTHESIZE: return synthesizePrompt(node, config);
      case PhaseType.REVIEW:     return reviewPrompt(node, config);
    }
  }
}
```

Prompt files live in `core/src/prompts/hci/` (see Doc B and Doc C for
persona-specific and analysis-specific prompt designs).

---

## 9. Relationship to Existing FSC Modules

| Existing Module | Disposition |
|----------------|-------------|
| `dockerInstance.ts` | **Kept as-is**. Orchestrator uses it for container lifecycle. |
| `taskSolverManager.ts` | **Replaced** by `pipelineOrchestrator.ts`. |
| `taskSolver.ts` | **Replaced** by node execution logic in Orchestrator. |
| `analyzer.ts` | **Replaced** by `inputAnalyzer.ts`. |
| `codeCommitter.ts` | **Replaced** by `workspace.compileArtifacts()`. |
| `task.ts` | **Replaced** by `phase.ts` + `artifact.ts`. |
| `config.ts` | **Extended** with `HCIConfig`. |
| `workStyle.ts` | **Replaced** by `researchParadigm` in config. |
| `SWEAgent/` | **Kept**. AI agent commands reused for container execution. |
| `prompts/` | **Extended** with `prompts/hci/` subdirectory. |

---

## 10. Error Handling

| Scenario | Behavior |
|----------|----------|
| Node execution fails | Mark node FAILED, log error. Check if downstream can be skipped or if pipeline is stuck. |
| Node timeout | Mark FAILED with timeout error. Same downstream logic. |
| DAG stuck (no ready nodes, not complete) | Save state, report which nodes are blocked and why. |
| Workspace I/O error | Retry once, then fail the node. |
| Invalid input | Fail at InputAnalyzer.detect() with descriptive error. |
| Container crash | DockerInstance already handles this. Node gets FAILED status. |

---

## 11. Resumability

The pipeline is resumable by design:

1. `pipeline.json` is persisted after every node completion.
2. `resume(projectId)` loads state, reconstructs DAG with current statuses,
   and continues the execution loop from where it stopped.
3. COMPLETED nodes are never re-executed.
4. RUNNING nodes (interrupted) are reset to PENDING on resume.
5. All artifacts are on disk, so upstream data is always available.

This also enables Mode B's async pattern: the pipeline runs up through DESIGN,
the user provides data externally, then `resume()` picks up from ANALYZE.
