# @full-self-coding/core

Core library for automated code analysis, task execution, and HCI research pipelines. Written in pure TypeScript and optimized for Bun runtime.

## Installation

```bash
npm install @full-self-coding/core
```

## Software Engineering API

### Usage

```typescript
import {
  analyzeCodebase,
  TaskSolverManager,
  createConfig,
  readConfigWithEnv,
  CodeCommitter,
  type Config,
  type Task
} from '@full-self-coding/core';

// Create configuration
const config = createConfig({
  agentType: 'claude-code',
  anthropicAPIKey: 'your-api-key',
  maxDockerContainers: 10,
  maxParallelDockerContainers: 3
});

// Or read from environment and config files
const envConfig = readConfigWithEnv();

// Analyze codebase
const gitUrl = 'https://github.com/user/repo.git';
const tasks: Task[] = await analyzeCodebase(config, gitUrl);

// Execute tasks
const taskSolver = new TaskSolverManager(config, gitUrl);
for (const task of tasks) {
  taskSolver.addTask(task);
}
await taskSolver.start();

// Get results
const reports = taskSolver.getReports();

// Commit changes
const committer = new CodeCommitter(reports);
await committer.commitAllChanges();
```

### Core Classes

- **`createConfig(userConfig)`** — Create configuration from user values
- **`readConfigWithEnv()`** — Read config with environment variable support
- **`analyzeCodebase(config, gitUrl)`** — Analyze repository and generate tasks
- **`TaskSolverManager`** — Execute multiple tasks in parallel
- **`TaskSolver`** — Execute a single task in a Docker container
- **`DockerInstance`** — Manage Docker container lifecycle
- **`CodeCommitter`** — Commit AI-generated changes to git

## HCI Research Pipeline API

The HCI Research Toolchain extends FSC for fully automated human-computer interaction research. Same philosophy: AI agents make all intelligent decisions inside Docker containers.

### Usage

```typescript
import {
  PipelineOrchestrator,
  createHCIConfig,
  PipelineMode,
  type HCIConfig,
  type PipelineState,
} from '@full-self-coding/core';

// Mode A: Start from a research topic (LLM-simulated participants)
const config = createHCIConfig({
  agentType: 'claude-code',
  anthropicAPIKey: 'sk-ant-...',
  targetVenue: 'CHI',
  simulatedParticipantCount: 30,
  researchParadigm: 'quantitative',
  outputLanguage: 'en',
});

const pipeline = new PipelineOrchestrator(config);
const state = await pipeline.run('./input/my-topic.txt');

// Mode B: Start from a dataset (zero-context analysis)
const state = await pipeline.run('./data/experiment-results.csv');

// Resume an interrupted pipeline
const state = await pipeline.resume('hci-m1abc2d');
```

### Pipeline Architecture

The pipeline is fully AI-driven:

1. **PLAN phase**: AI reads the input and designs the pipeline DAG
2. **Execution loop**: Orchestrator runs phases according to DAG dependencies
3. **Dynamic expansion**: COLLECT expands into persona subtasks; SYNTHESIZE expands into paper sections
4. **Resumable**: State persisted after every node completion

```
Input --> PLAN --> [AI-designed DAG] --> SCOPE --> DESIGN --> COLLECT --> ANALYZE --> SYNTHESIZE --> REVIEW
                                                     |                      |
                                                  N personas          AI-planned sections
                                                 (parallel)           (parallel writing)
```

### Key Classes

#### PipelineOrchestrator

Top-level controller. Replaces `TaskSolverManager` with DAG-based multi-phase execution.

```typescript
import { PipelineOrchestrator, createHCIConfig } from '@full-self-coding/core';

const config = createHCIConfig({ agentType: 'claude-code', anthropicAPIKey: '...' });
const pipeline = new PipelineOrchestrator(config);

// Run from input file/directory
const state = await pipeline.run('./input/topic.txt');

// Resume from saved state
const state = await pipeline.resume('hci-m1abc2d');
```

#### DAG

Pure logic module for dependency graph scheduling.

```typescript
import { DAG, PhaseStatus, type PhaseNode } from '@full-self-coding/core';

const dag = new DAG(nodes);
const ready = dag.getReadyNodes();        // Nodes whose deps are all completed
dag.updateStatus('scope', PhaseStatus.COMPLETED);
dag.addNodes(newNodes);                   // Add nodes at runtime (after PLAN)
dag.expandNode('collect', personaNodes);  // Replace node with subtask children
dag.validate();                           // Check for cycles and broken refs
```

#### WorkspaceManager

Filesystem isolation and artifact management.

```typescript
import { WorkspaceManager } from '@full-self-coding/core';

const ws = new WorkspaceManager('hci-m1abc2d');
await ws.initialize();
await ws.importInput('./data/experiment.csv');
const outputDir = ws.getOutputDir('analyze');
const readPaths = ws.getReadablePaths(node);  // Isolation enforcement
await ws.savePipelineState(state);
```

#### InputAnalyzer

Infrastructure-level input routing (file extensions only; AI does classification).

```typescript
import { InputAnalyzer } from '@full-self-coding/core';

const detection = await InputAnalyzer.detect('./input/data.csv');
// { inputType: 'dataset', mode: 'B', meta: { fileName: 'data.csv', ... } }

const detection = await InputAnalyzer.detect('./input/topic.txt');
// { inputType: 'topic', mode: 'A', meta: { content: '...', provisional: true } }
```

#### PersonaEngine

Generates persona DAG subtask chains for Mode A.

```typescript
import { PersonaEngine } from '@full-self-coding/core';

const personaNodes = PersonaEngine.generatePersonaNodes(30, config);
// Returns 91 nodes: 30 * (context + experience + participate) + 1 aggregate
```

#### DataProfiler

Thin data loader (AI agents handle actual analysis).

```typescript
import { DataProfiler } from '@full-self-coding/core';

const snapshot = await DataProfiler.snapshot('./data/results.csv');
// { source: '...', shape: [120, 15], columns: [...], sampleRows: [...] }
```

### Prompts

All prompts are routed through `PromptRouter`:

```typescript
import { PromptRouter } from '@full-self-coding/core';

const prompt = PromptRouter.getPrompt(node, config, mode);
```

Individual prompt generators:

| Module | Prompts |
|--------|---------|
| `planPrompt` | `pipelinePlanPrompt()`, `sectionPlanPrompt()` |
| `scopePrompt` | `scopePrompt()`, `dataProfilePrompt()`, `studyReconstructPrompt()` |
| `designPrompt` | `designPrompt()`, `analysisDesignPrompt()` |
| `collectPrompt` | `contextPrompt()`, `experiencePrompt()`, `participatePrompt()`, `aggregatePrompt()` |
| `analyzePrompt` | `analyzePrompt()` |
| `synthesizePrompt` | `synthesizeSectionPrompt()`, `synthesizeCompilePrompt()` |
| `reviewPrompt` | `reviewPrompt()` |

### Types

```typescript
import {
  PhaseType,        // PLAN, SCOPE, DESIGN, COLLECT, ANALYZE, SYNTHESIZE, REVIEW
  PhaseStatus,      // PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
  PipelineMode,     // SIMULATED (A), REAL_DATA (B)
  InputType,        // TOPIC, RESEARCH_QUESTION, DATASET
  ArtifactType,     // RAW_DATA, RESEARCH_PLAN, STUDY_PROTOCOL, etc.
  type PhaseNode,
  type PhaseResult,
  type PipelineState,
  type HCIConfig,
  type Artifact,
  type PersonaProfile,
  type PersonaContext,
  type PersonaExperience,
} from '@full-self-coding/core';
```

## Package Structure

```
packages/core/src/
├── index.ts                    # All exports (SWE + HCI)
├── analyzer.ts                 # Codebase analyzer
├── taskSolver.ts               # Single-task executor
├── taskSolverManager.ts        # Multi-task manager
├── config.ts                   # Configuration types
├── dockerInstance.ts           # Docker container management
│
├── # --- HCI Research Toolchain ---
├── pipelineOrchestrator.ts     # DAG-based pipeline controller
├── dag.ts                      # DAG engine
├── workspace.ts               # Filesystem isolation
├── inputAnalyzer.ts           # Input detection
├── phase.ts                    # Phase types
├── artifact.ts                # Artifact types
├── pipelineState.ts           # Pipeline state
├── hciConfig.ts               # HCI configuration
│
├── persona/
│   ├── personaEngine.ts       # Persona DAG generation
│   └── types.ts              # Persona types
│
├── dataProfiler/
│   ├── dataProfiler.ts        # Thin data loader
│   ├── types.ts              # Snapshot types
│   └── knownQuestionnaires.ts # Known scales
│
└── prompts/hci/
    ├── promptRouter.ts        # Phase-to-prompt routing
    ├── planPrompt.ts          # Pipeline + section planning
    ├── scopePrompt.ts         # Scoping prompts
    ├── designPrompt.ts        # Design prompts
    ├── collectPrompt.ts       # Persona prompts
    ├── analyzePrompt.ts       # Analysis prompts
    ├── synthesizePrompt.ts    # Writing prompts
    └── reviewPrompt.ts        # Review prompts
```

## Features

- **Code Analysis Engine**: Intelligent codebase analysis and task generation
- **HCI Research Pipeline**: Fully automated research from topic/data to paper
- **AI-Driven Planning**: AI agents design pipeline structure and paper sections
- **Multi-Agent Support**: Claude Code, Gemini CLI, extensible architecture
- **Docker Container Management**: Secure, isolated task execution
- **DAG Scheduling**: Dependency-aware parallel execution with dynamic expansion
- **Persona Engine**: Three-level persona construction for simulated participants
- **Autonomous Data Science**: AI writes and executes Python for statistical analysis
- **Resumable Pipelines**: Interrupt and resume from any phase
- **Type-Safe API**: Full TypeScript definitions

## Development

This package uses `.ts` files directly — no build step required. Compatible with Bun and other TypeScript runtimes.

## License

MIT
