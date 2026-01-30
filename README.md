# Full Self Coding (FSC)

No prompts, no instructions, no plans, you have 100~1000 AI agent coding in parallel now, solving all possible problems and issues in your codebase.

## Overview

Full Self Coding (FSC) is a framework that automates software engineering tasks by running multiple AI agents (Claude Code, Gemini CLI) inside Docker containers. It provides intelligent codebase analysis, task decomposition, automated code modification, and comprehensive reporting.

The framework now includes an **HCI Research Toolchain** — a fully automated research pipeline that applies the same FSC philosophy (AI agents do ALL intelligent work) to human-computer interaction research.

### Key Features

**Software Engineering (Original FSC)**
- Multi-agent support: Claude Code, Gemini CLI, extensible architecture
- Containerized execution: secure, isolated Docker-based task execution
- Intelligent analysis: automated codebase analysis and task identification
- Parallel processing: multi-container parallel task execution
- Comprehensive reporting: detailed execution reports with git diff tracking

**HCI Research Toolchain (New)**
- AI-driven pipeline planning: AI agent reads input and designs the optimal research pipeline
- Two modes: Mode A (LLM-simulated participants) and Mode B (real data analysis)
- Persona engine: nested FSC process for context + experience engineering
- Autonomous data science: AI agents write and execute Python scripts for statistical analysis
- Full paper generation: AI decides paper structure and writes every section
- DAG-based orchestration: multi-phase pipeline with dynamic expansion
- Resumable execution: interrupt and resume from any point

## Architecture

### Software Engineering Pipeline

```
Input (git repo)
  |
  v
Analyzer --> Task Decomposition --> [Task 1] --> Docker + AI Agent --> Commit
                                    [Task 2] --> Docker + AI Agent --> Commit
                                    [Task N] --> Docker + AI Agent --> Commit
```

### HCI Research Pipeline

```
Input (topic / RQ / dataset)
  |
  v
PLAN --> AI designs pipeline DAG
  |
  v
+------------- Mode A (simulated) -----------------------------------+
| SCOPE --> DESIGN --> COLLECT --> ANALYZE --> SYNTHESIZE --> REVIEW   |
|                       |                       |                     |
|                       v                       v                     |
|                   N personas             AI plans sections          |
|                  (parallel)              (parallel writing)         |
+--------------------------------------------------------------------+

+------------- Mode B (real data) -----------------------------------+
| DATA-PROFILE --> STUDY-RECONSTRUCT --> ANALYZE --> SYNTHESIZE -->   |
|                                                    REVIEW          |
+--------------------------------------------------------------------+
```

All intelligent decisions are made by AI agents inside Docker containers. The infrastructure only handles scheduling, filesystem isolation, and data flow.

### Supported Agent Types

| Agent Type | Description | Key Features |
|------------|-------------|--------------|
| **CLAUDE_CODE** | Anthropic Claude Code | Advanced code analysis, natural language processing |
| **GEMINI_CLI** | Google Gemini CLI | Google's AI model integration |
| **CODEX** | OpenAI Codex (planned) | OpenAI GPT-based code completion |

## Getting Started

### Prerequisites

- **Bun** (v1.0.0 or higher)
- **Docker** (latest version)
- **Git** (for repository operations)

### Quick Start

1. **Install bun.js on your machine**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and setup the project**
   ```bash
   git clone https://github.com/NO-CHATBOT-REVOLUTION/full-self-coding.git
   cd full-self-coding
   bun install
   ```

3. **Run on a repository (software engineering)**
   ```bash
   bun run start
   ```

### Installation as npm Package

The project is structured as a monorepo:

- **@full-self-coding/core**: Core library (SWE + HCI pipeline)
- **@full-self-coding/cli**: Command-line interface

```bash
npm install @full-self-coding/core
npm install -g @full-self-coding/cli
```

## HCI Research Toolchain

### Design Philosophy

The HCI toolchain follows the same principle as FSC: **AI agents make all intelligent decisions; infrastructure code only handles scheduling, isolation, and data flow.**

This means:
- Pipeline structure is designed by AI (not hardcoded)
- Input classification is done by AI (not regex heuristics)
- Paper sections are chosen by AI (not a fixed template)
- Statistical analysis is written by AI (not a lookup table)
- Data profiling is done by AI (not column-type inference code)

### Two Modes

| Mode | Input | Pipeline | Use Case |
|------|-------|----------|----------|
| **Mode A** (Simulated) | Topic or Research Question | Full pipeline with LLM-simulated participants | Exploratory research, feasibility studies |
| **Mode B** (Real Data) | Dataset (CSV, JSON, etc.) | Zero-context: drops data in, gets paper out | Post-hoc analysis of collected data |

### Pipeline Phases

| Phase | Purpose | AI Agent Task |
|-------|---------|---------------|
| **PLAN** | Pipeline design | Read input, classify it, design optimal DAG |
| **SCOPE** | Research scoping | Literature review, RQ formulation, data profiling |
| **DESIGN** | Study design | Protocol creation, analysis planning |
| **COLLECT** | Data collection | Persona context/experience engineering, participation |
| **ANALYZE** | Statistical analysis | Write + execute Python scripts (pandas, scipy, etc.) |
| **SYNTHESIZE** | Paper writing | Plan sections, write each section, compile draft |
| **REVIEW** | Quality review | Methodological, logical, completeness checks |

### Usage

```typescript
import {
  PipelineOrchestrator,
  createHCIConfig,
} from '@full-self-coding/core';

// Mode A: Start from a research topic
const config = createHCIConfig({
  agentType: 'claude-code',
  anthropicAPIKey: 'sk-ant-...',
  targetVenue: 'CHI',
  simulatedParticipantCount: 30,
  researchParadigm: 'quantitative',
});

const pipeline = new PipelineOrchestrator(config);
const state = await pipeline.run('./input/my-topic.txt');

// Mode B: Start from a dataset (zero-context)
const state = await pipeline.run('./data/experiment-results.csv');

// Resume an interrupted pipeline
const state = await pipeline.resume('hci-m1abc2d');
```

### How It Works

1. **Input Detection**: Infrastructure checks file extensions (data file vs text) to determine Mode A or B
2. **PLAN Phase**: AI agent reads the input and outputs `pipeline_plan.json` — the full pipeline DAG with phases, dependencies, and descriptions
3. **DAG Execution**: Orchestrator builds the DAG from the AI's plan and runs phases according to dependency order
4. **Dynamic Expansion**:
   - After DESIGN: COLLECT expands into N parallel persona chains (context -> experience -> participate)
   - After ANALYZE: synthesize/plan node decides paper sections, SYNTHESIZE expands into parallel section writers
5. **Output**: Complete research paper (Markdown), statistical results (APA), analysis code (Python), figures

### Persona Engine (Mode A)

Mode A simulates participants using a three-level persona construction:

```
Level 1: Context Engineering
  AI creates a rich demographic + psychological profile

Level 2: Experience Engineering
  AI generates chronological life episodes relevant to the study
  (e.g., history of using voice interfaces, frustration events)

Level 3: Participation
  AI role-plays as the persona to provide study responses
```

Each persona runs as a chain of 3 DAG nodes. 30 personas = 90 parallel subtasks.

### HCI Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pipelineMode` | `PipelineMode` | auto-detected | Force Mode A or B |
| `workspaceBaseDir` | `string` | `~/.fsc-hci/workspace/` | Workspace location |
| `researchDomain` | `string` | - | Domain hint (e.g., "mobile interaction") |
| `targetVenue` | `string` | - | Target venue (CHI, UIST, CSCW, etc.) |
| `statisticalFramework` | `string` | `frequentist` | `frequentist`, `bayesian`, or `both` |
| `simulatedParticipantCount` | `number` | `30` | Number of simulated participants |
| `researchParadigm` | `string` | `quantitative` | `quantitative`, `qualitative`, or `mixed` |
| `outputLanguage` | `string` | `en` | Paper language |
| `experienceDepth` | `string` | `standard` | Persona depth: `shallow`, `standard`, `deep` |

## Configuration (SWE)

### Configuration Hierarchy

1. **Environment Variables** (`FSC_*`)
2. **Project-level Configuration** (`.fsc/config.json`)
3. **User Configuration** (`~/.config/full-self-coding/config.json`)
4. **Default Values**

### Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `agentType` | `SWEAgentType` | `CLAUDE_CODE` | AI agent to use |
| `maxDockerContainers` | `number` | `10` | Maximum Docker containers |
| `maxParallelDockerContainers` | `number` | `3` | Maximum parallel containers |
| `dockerTimeoutSeconds` | `number` | `600` | Docker command timeout |
| `dockerMemoryMB` | `number` | `1024` | Container memory limit |
| `dockerCpuCores` | `number` | `2` | Container CPU cores |
| `dockerImageRef` | `string` | `node:latest` | Docker image |
| `maxTasks` | `number` | `100` | Maximum tasks to generate |
| `minTasks` | `number` | `1` | Minimum tasks to generate |
| `workStyle` | `WorkStyle` | `DEFAULT` | Work style |
| `anthropicAPIKey` | `string` | - | Anthropic API key |
| `googleGeminiApiKey` | `string` | - | Google Gemini API key |
| `openAICodexApiKey` | `string` | - | OpenAI Codex API key |

### Environment Variables

```bash
export FSC_ANTHROPIC_API_KEY="sk-ant-api03-..."
export FSC_GOOGLE_GEMINI_API_KEY="AIzaSy..."
export FSC_OPENAI_CODEX_API_KEY="sk-..."
export FSC_MAX_DOCKER_CONTAINERS=15
export FSC_DOCKER_TIMEOUT_SECONDS=900
export FSC_AGENT_TYPE="claude-code"
```

## Usage Guide

### Command Line Interface

```bash
full-self-coding-cli run [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--agent-type` | `-a` | AI agent type |
| `--config` | `-c` | Path to config file |
| `--help` | `-h` | Show help |
| `--version` | `-V` | Show version |

### Core Library Usage (SWE)

```typescript
import { analyzeCodebase, TaskSolverManager, createConfig } from '@full-self-coding/core';

const config = createConfig({
  agentType: 'claude-code',
  anthropicAPIKey: 'your-api-key'
});

const tasks = await analyzeCodebase(config, 'https://github.com/user/repo.git');

const taskSolver = new TaskSolverManager(config, 'https://github.com/user/repo.git');
for (const task of tasks) {
  taskSolver.addTask(task);
}
await taskSolver.start();
```

## Project Structure

```
full-self-coding/
├── packages/
│   ├── core/src/
│   │   ├── index.ts                    # Main exports (SWE + HCI)
│   │   ├── analyzer.ts                 # Codebase analyzer
│   │   ├── taskSolver.ts               # Single-task executor
│   │   ├── taskSolverManager.ts        # Multi-task manager
│   │   ├── config.ts                   # Configuration types
│   │   ├── dockerInstance.ts           # Docker container management
│   │   │
│   │   ├── # --- HCI Research Toolchain ---
│   │   ├── pipelineOrchestrator.ts     # DAG-based pipeline controller
│   │   ├── dag.ts                      # DAG engine (scheduling, validation)
│   │   ├── workspace.ts               # Filesystem isolation manager
│   │   ├── inputAnalyzer.ts           # Input type detection
│   │   ├── phase.ts                    # Phase types and node interface
│   │   ├── artifact.ts                # Artifact types and manifest
│   │   ├── pipelineState.ts           # Resumable pipeline state
│   │   ├── hciConfig.ts               # HCI-specific configuration
│   │   │
│   │   ├── persona/
│   │   │   ├── personaEngine.ts       # Persona DAG node generation
│   │   │   └── types.ts              # Persona profile/context/experience
│   │   │
│   │   ├── dataProfiler/
│   │   │   ├── dataProfiler.ts        # Thin data loader (AI does analysis)
│   │   │   ├── types.ts              # Data snapshot types
│   │   │   └── knownQuestionnaires.ts # SUS, NASA-TLX, UEQ, etc.
│   │   │
│   │   └── prompts/hci/
│   │       ├── promptRouter.ts        # Routes phase nodes to prompts
│   │       ├── planPrompt.ts          # AI pipeline + section planning
│   │       ├── scopePrompt.ts         # Literature review, data profiling
│   │       ├── designPrompt.ts        # Study design, analysis planning
│   │       ├── collectPrompt.ts       # Persona construction pipeline
│   │       ├── analyzePrompt.ts       # Autonomous data science
│   │       ├── synthesizePrompt.ts    # Paper section writing + compilation
│   │       └── reviewPrompt.ts        # Self-review and finalization
│   │
│   └── cli/                            # Command-line interface
│
└── docs/design/
    ├── A-dag-engine-workspace-orchestrator.md
    ├── B-persona-engine.md
    └── C-data-profiler.md
```

## Docker Integration

FSC creates isolated Docker containers for each task, providing:

- **Security**: Complete isolation from host system
- **Consistency**: Reproducible execution environments
- **Parallelism**: Multiple tasks run simultaneously
- **Resource Management**: Controlled CPU and memory usage

For HCI pipelines, each phase node gets its own container with:
- Python 3 + scientific stack (pandas, numpy, scipy, statsmodels, matplotlib, seaborn, pingouin)
- The configured AI agent (Claude Code / Gemini CLI)
- Read-only access to upstream artifacts, write access to output directory

## Testing

```bash
# Run all tests
bun run test

# Run from core package
cd packages/core && bun test

# Run with timeout
bun test --timeout 30000
```

## Contributing

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Create a feature branch: `git checkout -b feature/new-feature`
4. Run tests: `bun run test`
5. Commit and push: `git commit -m "feat: add new feature"`
6. Create a pull request

### Code Style

- TypeScript strict mode
- Pure TypeScript (no build step)
- Bun runtime

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- **Anthropic** - Claude Code integration
- **Google** - Gemini CLI integration
- **Docker** - Containerization platform
- **Bun** - Fast JavaScript runtime
