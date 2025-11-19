# Full Self Coding (FSC)

An advanced AI-powered automated software engineering framework that leverages containerized agents to analyze, modify, and improve codebases autonomously.

## 🌟 Overview

Full Self Coding (FSC) is a sophisticated framework designed to automate software engineering tasks by integrating multiple AI agents (Claude Code, Gemini CLI) within Docker containers. It provides intelligent codebase analysis, task decomposition, automated code modification, and comprehensive reporting capabilities.

### Key Features

- **🤖 Multi-Agent Support**: Integration with Claude Code, Gemini CLI, and extensible agent architecture
- **📦 Containerized Execution**: Secure, isolated Docker-based task execution
- **🔍 Intelligent Analysis**: Automated codebase analysis and task identification
- **⚙️ Flexible Configuration**: Hierarchical configuration system with environment variable support
- **📊 Comprehensive Reporting**: Detailed execution reports with git diff tracking
- **🔄 Parallel Processing**: Multi-container parallel task execution with resource management
- **🛡️ Robust Error Handling**: Comprehensive error recovery and graceful degradation

## 🏗️ Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ConfigReader  │    │   DockerInstance │    │   TaskSolver    │
│                 │    │                  │    │                 │
│ • Configuration │    │ • Container      │    │ • Task          │
│   Management    │    │   Management     │    │   Execution     │
│ • Validation    │    │ • File Operations│    │ • Result        │
│ • Merging       │    │ • Command        │    │   Processing    │
│ • Environment   │    │   Execution      │    │                 │
│   Variables     │    │ • Monitoring     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │     Analyzer     │
                    │                  │
                    │ • Codebase       │
                    │   Analysis       │
                    │ • Task           │
                    │   Generation     │
                    │ • Agent          │
                    │   Coordination   │
                    └──────────────────┘
```

### Supported Agent Types

| Agent Type | Description | Container Image | Key Features |
|------------|-------------|----------------|--------------|
| **CLAUDE_CODE** | Anthropic Claude Code integration | `node:latest` | Advanced code analysis, natural language processing |
| **GEMINI_CLI** | Google Gemini CLI integration | `node:latest` | Google's AI model integration, fast response |
| **CODEX** | OpenAI Codex integration (planned) | - | OpenAI GPT-based code completion |

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18.0.0 or higher)
- **Docker** (latest version)
- **Git** (for repository operations)
- **Bun** (recommended for package management)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/full-self-coding.git
   cd full-self-coding
   ```

2. **Install dependencies**
   ```bash
   # Using npm
   npm install

   # Or using bun (recommended)
   bun install
   ```

3. **Build the project**
   ```bash
   # Using npm
   npm run build

   # Or using bun
   bun run build
   ```

4. **Verify installation**
   ```bash
   bun test
   ```

### Quick Start

1. **Basic configuration**
   ```bash
   # Create global config
   mkdir -p ~/.config/full-self-coding
   cat > ~/.config/full-self-coding/config.json << EOF
   {
     "agentType": "claude-code",
     "anthropicAPIKey": "your-anthropic-api-key",
     "maxDockerContainers": 5,
     "dockerTimeoutSeconds": 300
   }
   EOF
   ```

2. **Run on a repository**
   ```bash
   # Basic usage
   node dist/main.js https://github.com/user/repo.git

   # With specific configuration
   node dist/main.js https://github.com/user/repo.git \
     --agent-type claude-code \
     --max-containers 10 \
     --timeout 600
   ```

## ⚙️ Configuration

### Configuration Hierarchy

FSC uses a hierarchical configuration system with the following precedence (highest to lowest):

1. **Environment Variables** (`FSC_*`)
2. **Project-level Configuration** (`.fsc/config.json`)
3. **User Configuration** (`~/.config/full-self-coding/config.json`)
4. **Default Values**

### Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `agentType` | `SWEAgentType` | `CLAUDE_CODE` | AI agent to use (`claude-code`, `gemini-cli`) |
| `maxDockerContainers` | `number` | `10` | Maximum Docker containers allowed |
| `maxParallelDockerContainers` | `number` | `3` | Maximum parallel container execution |
| `dockerTimeoutSeconds` | `number` | `600` | Docker command timeout in seconds |
| `dockerMemoryMB` | `number` | `1024` | Docker container memory limit in MB |
| `dockerCpuCores` | `number` | `2` | Docker container CPU core limit |
| `dockerImageRef` | `string` | `"node:latest"` | Docker image reference for containers |
| `maxTasks` | `number` | `100` | Maximum tasks to generate during analysis |
| `minTasks` | `number` | `1` | Minimum tasks to generate during analysis |
| `workStyle` | `WorkStyle` | `DEFAULT` | Work style (`default`, `bold_genius`, `careful`, etc.) |
| `customizedWorkStyle` | `string` | - | Custom work style description |
| `codingStyleLevel` | `number` | `5` | Coding style level (0-10) |
| `customizedCodingStyle` | `string` | - | Custom coding style description |
| `anthropicAPIKey` | `string` | - | Anthropic API key |
| `anthropicAPIBaseUrl` | `string` | - | Custom Anthropic API base URL |
| `anthropicAPIKeyExportNeeded` | `boolean` | `true` | Whether to export Anthropic API key |
| `googleGeminiApiKey` | `string` | - | Google Gemini API key |
| `googleGeminiAPIKeyExportNeeded` | `boolean` | `true` | Whether to export Gemini API key |
| `openAICodexApiKey` | `string` | - | OpenAI Codex API key |
| `openAICodexAPIKeyExportNeeded` | `boolean` | `true` | Whether to export OpenAI API key |

### Configuration Files

#### Global Configuration (`~/.config/full-self-coding/config.json`)

```json
{
  "agentType": "claude-code",
  "anthropicAPIKey": "sk-ant-api03-...",
  "maxDockerContainers": 8,
  "maxParallelDockerContainers": 4,
  "dockerTimeoutSeconds": 600,
  "dockerMemoryMB": 2048,
  "workStyle": "bold_genius",
  "customizedWorkStyle": "Focus on rapid prototyping and innovation"
}
```

#### Project Configuration (`.fsc/config.json`)

```json
{
  "agentType": "gemini-cli",
  "googleGeminiApiKey": "AIzaSy...",
  "maxTasks": 50,
  "minTasks": 5,
  "codingStyleLevel": 8,
  "customizedCodingStyle": "Follow enterprise coding standards with comprehensive documentation"
}
```

#### Environment Variables

```bash
# API Keys
export FSC_ANTHROPIC_API_KEY="sk-ant-api03-..."
export FSC_GOOGLE_GEMINI_API_KEY="AIzaSy..."
export FSC_OPENAI_CODEX_API_KEY="sk-..."

# Docker Settings
export FSC_MAX_DOCKER_CONTAINERS=15
export FSC_DOCKER_TIMEOUT_SECONDS=900
export FSC_DOCKER_MEMORY_MB=4096

# Agent Configuration
export FSC_AGENT_TYPE="claude-code"
export FSC_WORK_STYLE="bold_genius"
export FSC_CODING_STYLE_LEVEL=9
```

## 📖 Usage Guide

### Command Line Interface

The main CLI provides various options for configuration and execution:

```bash
node dist/main.js [options] <git-repository-url>
```

#### Options

| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--agent-type` | `-a` | `string` | AI agent type (`claude-code`, `gemini-cli`) |
| `--max-containers` | `-m` | `number` | Maximum Docker containers |
| `--parallel-containers` | `-p` | `number` | Maximum parallel containers |
| `--timeout` | `-t` | `number` | Docker timeout in seconds |
| `--memory` | `-M` | `number` | Docker memory limit in MB |
| `--cpu` | `-c` | `number` | Docker CPU cores |
| `--work-style` | `-w` | `string` | Work style (`default`, `bold_genius`, etc.) |
| `--coding-style-level` | `-l` | `number` | Coding style level (0-10) |
| `--max-tasks` | `-T` | `number` | Maximum tasks to generate |
| `--min-tasks` | `-n` | `number` | Minimum tasks to generate |
| `--config-dir` | `-C` | `string` | Custom config directory |
| `--no-supplementary` | - | `boolean` | Disable supplementary config reading |
| `--env-override` | `-e` | `boolean` | Enable environment variable override |
| `--help` | `-h` | - | Show help information |

### Examples

#### Basic Repository Analysis

```bash
# Analyze a repository with default settings
node dist/main.js https://github.com/example/awesome-project.git
```

#### Advanced Configuration

```bash
# Analyze with specific agent and resources
node dist/main.js https://github.com/example/complex-project.git \
  --agent-type claude-code \
  --max-containers 15 \
  --parallel-containers 5 \
  --timeout 1200 \
  --memory 4096 \
  --cpu 4
```

#### Custom Work Style

```bash
# Use custom work style and coding level
node dist/main.js https://github.com/example/creative-project.git \
  --work-style bold_genius \
  --coding-style-level 8 \
  --max-tasks 200
```

#### Project-specific Configuration

```bash
# Use project-specific configuration
node dist/main.js https://github.com/my-org/my-project.git \
  --config-dir ./project-config \
  --no-supplementary
```

## 🔧 API Reference

### Core Classes

#### ConfigReader

Manages configuration loading, validation, and merging.

```typescript
import { ConfigReader, readConfig } from './src/configReader';

// Create with custom options
const reader = new ConfigReader({
  configDir: '/custom/path',
  throwOnMissing: true,
  readSupplementaryConfig: true
});

// Read configuration
const config = reader.readConfig();

// Read with environment variable override
const configWithEnv = reader.readConfigWithEnvOverride();
```

**Methods**

- `readConfig(): Config` - Read and validate configuration
- `readConfigWithEnvOverride(): Config` - Read config with environment variables
- `writeConfig(config: Partial<Config>): void` - Write configuration to file
- `configExists(): boolean` - Check if configuration file exists
- `getConfigPath(): string` - Get configuration file path

#### DockerInstance

Manages Docker container lifecycle and operations.

```typescript
import { DockerInstance, DockerRunStatus } from './src/dockerInstance';

const docker = new DockerInstance();

// Start container
const containerName = await docker.startContainer('node:latest', 'my-task');

// Run commands
const result = await docker.runCommands(['npm', 'install']);

// Copy files
await docker.copyFileToContainer('local.txt', '/app/remote.txt');
await docker.copyFilesToContainer('./src', '/app/src');

// Copy files from container
const content = await docker.copyFileFromContainer('/app/output.txt');

// Shutdown
await docker.shutdownContainer();
```

**Methods**

- `startContainer(imageRef: string, taskName?: string): Promise<string>` - Start new container
- `runCommands(commands: string[], timeout?: number): Promise<DockerRunResult>` - Execute commands
- `copyFileToContainer(localPath: string, containerPath: string): Promise<void>` - Copy single file
- `copyFilesToContainer(localPath: string, containerPath: string): Promise<void>` - Copy recursively
- `copyFileFromContainer(containerPath: string): Promise<string>` - Copy file from container
- `shutdownContainer(): Promise<void>` - Stop and remove container

#### TaskSolver

Executes individual tasks within Docker containers.

```typescript
import { TaskSolver } from './src/taskSolver';
import { SWEAgentType } from './src/config';

const taskSolver = new TaskSolver(
  config,
  task,
  SWEAgentType.CLAUDE_CODE,
  'https://github.com/user/repo.git'
);

// Solve the task
await taskSolver.solve();

// Get results
const result = taskSolver.getResult();
```

**Methods**

- `solve(shutdown?: boolean): Promise<void>` - Execute the task
- `getResult(): TaskResult` - Get task execution result

#### Analyzer

Analyzes codebases and generates task lists.

```typescript
import { analyzeCodebase } from './src/analyzer';

// Analyze a repository
const tasks = await analyzeCodebase(
  config,
  'https://github.com/user/repo.git',
  true, // shutdown container
  'npm run build' // extra commands before analysis
);
```

### Configuration Types

```typescript
interface Config {
  agentType: SWEAgentType;
  maxDockerContainers: number;
  maxParallelDockerContainers: number;
  dockerTimeoutSeconds: number;
  dockerMemoryMB: number;
  dockerCpuCores: number;
  dockerImageRef: string;
  maxTasks: number;
  minTasks: number;
  workStyle: WorkStyle;
  customizedWorkStyle?: string;
  codingStyleLevel: number;
  customizedCodingStyle?: string;
  anthropicAPIKey?: string;
  anthropicAPIBaseUrl?: string;
  anthropicAPIKeyExportNeeded: boolean;
  googleGeminiApiKey?: string;
  googleGeminiAPIKeyExportNeeded: boolean;
  openAICodexApiKey?: string;
  openAICodexAPIKeyExportNeeded: boolean;
}

enum SWEAgentType {
  CLAUDE_CODE = 'claude-code',
  GEMINI_CLI = 'gemini-cli',
  CODEX = 'codex'
}

enum WorkStyle {
  DEFAULT = 'default',
  BOLDGENIUS = 'bold_genius',
  CAREFUL = 'careful',
  AGILE = 'agile',
  RESEARCH = 'research'
}
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test files
bun test test/dockerInstance.test.ts
bun test test/configReaderSupplementary.test.ts

# Run with coverage
bun test --coverage
```

### Test Structure

```
test/
├── dockerInstance.test.ts           # Docker functionality tests
├── configReaderSupplementary.test.ts # Configuration system tests
└── integration/                     # Integration tests
    ├── full-workflow.test.ts        # End-to-end workflow tests
    └── multi-agent.test.ts          # Multi-agent integration tests
```

### Writing Tests

```typescript
import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { DockerInstance } from '../src/dockerInstance';

describe('DockerInstance', () => {
  let docker: DockerInstance;
  let containerName: string;

  beforeAll(async () => {
    docker = new DockerInstance();
    containerName = await docker.startContainer('node:latest', 'test-container');
  });

  afterAll(async () => {
    await docker.shutdownContainer();
  });

  test('should run simple commands', async () => {
    const result = await docker.runCommands(['echo', 'hello']);
    expect(result.status).toBe(DockerRunStatus.SUCCESS);
    expect(result.output).toContain('hello');
  });
});
```

## 🐳 Docker Integration

### Container Management

FSC creates isolated Docker containers for each task execution, ensuring:

- **Security**: Complete isolation from host system
- **Consistency**: Reproducible execution environments
- **Parallelism**: Multiple tasks can run simultaneously
- **Resource Management**: Controlled CPU and memory usage

### Supported Operations

- File copying (both directions)
- Command execution with timeout protection
- Real-time output streaming
- Resource monitoring
- Graceful shutdown

### Custom Docker Images

You can use custom Docker images:

```json
{
  "dockerImageRef": "custom/node:18-alpine",
  "dockerMemoryMB": 1536,
  "dockerCpuCores": 3
}
```

## 🔍 Troubleshooting

### Common Issues

#### Docker Connectivity

```bash
# Check Docker daemon
docker --version
docker info

# Test container creation
docker run --rm hello-world
```

#### Permission Issues

```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

#### API Key Problems

```bash
# Verify API key format
echo $FSC_ANTHROPIC_API_KEY | head -c 20

# Test API connectivity
curl -H "x-api-key: $FSC_ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/messages \
     -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Debug Mode

Enable debug logging:

```bash
export DEBUG=fsc:*
node dist/main.js --debug https://github.com/user/repo.git
```

### Performance Tuning

#### Resource Optimization

```json
{
  "maxParallelDockerContainers": 2,
  "dockerTimeoutSeconds": 900,
  "dockerMemoryMB": 2048
}
```

#### Task Limiting

```json
{
  "maxTasks": 50,
  "minTasks": 5
}
```

## 🤝 Contributing

### Development Setup

1. **Fork and clone**
   ```bash
   git clone https://github.com/your-username/full-self-coding.git
   cd full-self-coding
   ```

2. **Install development dependencies**
   ```bash
   bun install
   ```

3. **Set up pre-commit hooks**
   ```bash
   bun run setup-hooks
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb style guide
- **Prettier**: Consistent formatting
- **Husky**: Pre-commit hooks

```bash
# Lint code
bun run lint

# Format code
bun run format

# Run pre-commit checks
bun run pre-commit
```

### Testing Requirements

- **Coverage**: Minimum 90% coverage required
- **Unit Tests**: All public methods must have tests
- **Integration Tests**: Critical workflows must be tested

```bash
# Run tests with coverage
bun run test:coverage

# Generate coverage report
bun run coverage:report
```

### Pull Request Process

1. **Create feature branch**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make changes and test**
   ```bash
   bun run lint
   bun run test
   bun run build
   ```

3. **Commit and push**
   ```bash
   git commit -m "feat: add new feature"
   git push origin feature/new-feature
   ```

4. **Create pull request**
   - Include comprehensive description
   - Reference related issues
   - Include test results

## 📚 Advanced Topics

### Custom Agent Integration

To add a new agent type:

1. **Define enum value**
   ```typescript
   // src/config.ts
   export enum SWEAgentType {
     CLAUDE_CODE = 'claude-code',
     GEMINI_CLI = 'gemini-cli',
     CODEX = 'codex',
     CUSTOM_AGENT = 'custom-agent'
   }
   ```

2. **Implement agent commands**
   ```typescript
   // src/SWEAgent/customAgentCommands.ts
   export function customAgentCommands(
     config: Config,
     task: Task,
     gitUrl: string
   ): string[] {
     // Implementation
   }
   ```

3. **Update command builder**
   ```typescript
   // src/SWEAgent/SWEAgentTaskSolverCommands.ts
   switch (agentType) {
     case SWEAgentType.CUSTOM_AGENT:
       return customAgentCommands(config, task, gitUrl);
   }
   ```

### Custom Work Styles

Define custom work styles by extending the `WorkStyle` enum and implementing corresponding prompt generation logic.

### Monitoring and Observability

#### Metrics Collection

FSC supports integration with monitoring systems:

```typescript
// Add custom metrics
import { MetricsCollector } from './src/metrics';

const metrics = new MetricsCollector();
metrics.recordTaskExecution(task, duration, success);
metrics.recordResourceUsage(containerId, cpu, memory);
```

#### Logging

Configure logging levels and outputs:

```typescript
import { Logger } from './src/logger';

const logger = new Logger({
  level: 'debug',
  output: 'file',
  filename: 'fsc.log'
});
```

### Security Considerations

- **API Key Management**: Use environment variables or secure vault
- **Container Isolation**: Containers run with limited privileges
- **Network Access**: Control container network access
- **File System**: Limit file system access within containers

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** - For Claude Code integration
- **Google** - For Gemini CLI integration
- **Docker** - For containerization platform
- **Bun** - For fast JavaScript runtime

## 📞 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/NO-CHATBOT-REVOLUTION/full-self-coding/issues)
- **Discussions**: [Community discussions and Q&A](https://github.com/NO-CHATBOT-REVOLUTION/full-self-coding/discussions)
- **Documentation**: [Full documentation site](https://full-self-coding.docs.com) (Coming Soon)

---

**Built with ❤️ by the Full Self Coding team**