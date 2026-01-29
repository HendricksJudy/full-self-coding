import * as fs from 'fs';
import * as path from 'path';
import { DAG } from './dag';
import { PhaseType, PhaseStatus, type PhaseNode, type PhaseResult } from './phase';
import { ArtifactType, ArtifactFormat, type Artifact } from './artifact';
import type { PipelineState } from './pipelineState';
import { PipelineMode, InputType, type HCIConfig } from './hciConfig';
import { WorkspaceManager } from './workspace';
import { InputAnalyzer, type InputDetectionResult } from './inputAnalyzer';
import { DockerInstance, DockerRunStatus } from './dockerInstance';
import { SWEAgentType } from './config';
import { PersonaEngine } from './persona/personaEngine';
import { PromptRouter } from './prompts/hci/promptRouter';

/**
 * Top-level pipeline execution controller.
 * Replaces TaskSolverManager with a DAG-based multi-phase engine.
 *
 * Drives the DAG to completion by repeatedly finding ready nodes,
 * executing them in parallel (up to concurrency limit), and persisting
 * state after each completion for resumability.
 */
export class PipelineOrchestrator {
  private dag!: DAG;
  private workspace!: WorkspaceManager;
  private config: HCIConfig;
  private activeExecutions: Map<string, Promise<PhaseResult>> = new Map();
  private mode!: PipelineMode;

  constructor(config: HCIConfig) {
    this.config = config;
  }

  /**
   * Main entry point. Runs the full pipeline from input to final artifacts.
   */
  async run(inputPath: string): Promise<PipelineState> {
    // 1. Detect input type
    console.log(`[Pipeline] Analyzing input: ${inputPath}`);
    const detection = await InputAnalyzer.detect(inputPath);
    this.mode = detection.mode;
    console.log(`[Pipeline] Detected: ${detection.inputType}, Mode: ${this.mode}`);

    // 2. Create project
    const projectId = `hci-${Date.now().toString(36)}`;
    this.workspace = new WorkspaceManager(projectId, this.config.workspaceBaseDir);
    await this.workspace.initialize();
    await this.workspace.importInput(inputPath);
    console.log(`[Pipeline] Workspace created: ${this.workspace.getRootPath()}`);

    // 3. Write input metadata
    await this.workspace.writeArtifact(
      {
        id: 'input/meta',
        type: ArtifactType.RAW_DATA,
        format: ArtifactFormat.JSON,
        path: 'input/meta.json',
        producedBy: 'system',
      },
      JSON.stringify({ ...detection, detectedAt: Date.now() }, null, 2),
    );

    // 4. Build initial DAG
    const nodes = this.buildInitialDAG(detection);
    this.dag = new DAG(nodes);
    const errors = this.dag.validate();
    if (errors.length > 0) {
      throw new Error(`DAG validation failed:\n${errors.join('\n')}`);
    }

    // 5. Build initial pipeline state
    const state: PipelineState = {
      projectId,
      mode: this.mode,
      inputType: detection.inputType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: this.dag.getAllNodes(),
      artifacts: [],
    };
    await this.workspace.savePipelineState(state);

    // 6. Execute
    await this.executionLoop(state);

    // 7. Compile final artifacts
    console.log('[Pipeline] Compiling final artifacts...');
    await this.workspace.compileArtifacts();

    console.log('[Pipeline] Pipeline complete.');
    return state;
  }

  /**
   * Resume a previously interrupted pipeline.
   */
  async resume(projectId: string): Promise<PipelineState> {
    this.workspace = new WorkspaceManager(projectId, this.config.workspaceBaseDir);
    const state = await this.workspace.loadPipelineState();
    if (!state) {
      throw new Error(`No saved pipeline state found for project: ${projectId}`);
    }

    this.mode = state.mode;

    // Reset any RUNNING nodes back to PENDING (they were interrupted)
    for (const node of state.nodes) {
      if (node.status === PhaseStatus.RUNNING) {
        node.status = PhaseStatus.PENDING;
        node.startedAt = undefined;
      }
    }

    this.dag = new DAG(state.nodes);
    console.log(`[Pipeline] Resumed project: ${projectId}`);
    const summary = this.dag.getSummary();
    console.log(`[Pipeline] Status: ${summary.completed} done, ${summary.pending} pending, ${summary.failed} failed`);

    await this.executionLoop(state);
    await this.workspace.compileArtifacts();

    console.log('[Pipeline] Pipeline complete (resumed).');
    return state;
  }

  // --- Core execution loop ---

  private async executionLoop(state: PipelineState): Promise<void> {
    const maxParallel = this.config.maxParallelDockerContainers || 2;

    while (!this.dag.isComplete()) {
      // Check for stuck state
      if (this.dag.isStuck()) {
        const summary = this.dag.getSummary();
        console.error('[Pipeline] Pipeline is stuck!', summary);
        throw new Error(
          `Pipeline stuck: ${summary.pending} pending, ${summary.failed} failed, ` +
          `${summary.running} running. No nodes are ready to execute.`
        );
      }

      const readyNodes = this.dag.getReadyNodes();

      // Launch new executions up to the concurrency limit
      const slotsAvailable = maxParallel - this.activeExecutions.size;
      const batch = readyNodes.slice(0, slotsAvailable);

      for (const node of batch) {
        console.log(`[Pipeline] Starting: ${node.id} (${node.title})`);
        this.dag.updateStatus(node.id, PhaseStatus.RUNNING);

        const promise = this.executeNode(node).then(
          (result) => {
            this.dag.updateStatus(node.id, result.status, result.error);
            console.log(`[Pipeline] Completed: ${node.id} → ${result.status}`);
            this.activeExecutions.delete(node.id);
            return result;
          },
          (err) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.dag.updateStatus(node.id, PhaseStatus.FAILED, errMsg);
            console.error(`[Pipeline] Failed: ${node.id} → ${errMsg}`);
            this.activeExecutions.delete(node.id);
            return {
              nodeId: node.id,
              status: PhaseStatus.FAILED,
              error: errMsg,
              outputArtifactIds: [],
              startedAt: node.startedAt || Date.now(),
              completedAt: Date.now(),
            } as PhaseResult;
          },
        );
        this.activeExecutions.set(node.id, promise);
      }

      // Wait for at least one execution to complete
      if (this.activeExecutions.size > 0) {
        await Promise.race(this.activeExecutions.values());
      } else {
        // Small delay before checking again
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Dynamic DAG expansion after certain phases complete
      await this.maybeExpandDAG();

      // Persist state after changes
      state.nodes = this.dag.getAllNodes();
      state.updatedAt = Date.now();
      await this.workspace.savePipelineState(state);
    }

    // Wait for any remaining active executions
    if (this.activeExecutions.size > 0) {
      await Promise.all(this.activeExecutions.values());
    }
  }

  // --- Node execution ---

  private async executeNode(node: PhaseNode): Promise<PhaseResult> {
    const startedAt = Date.now();
    const docker = new DockerInstance();
    const containerName = `hci-${node.id.replace(/\//g, '-')}-${Date.now().toString(36)}`;

    try {
      const imageRef = this.config.dockerImageRef || 'node:latest';
      await docker.startContainer(imageRef, containerName);

      // Create /app directory
      await docker.runCommands(['mkdir -p /app/input /app/output']);

      // Copy upstream artifacts into container
      const readPaths = this.workspace.getReadablePaths(node);
      for (const readPath of readPaths) {
        try {
          await docker.copyFilesToContainer(readPath, '/app/input');
        } catch {
          // Some paths may not exist yet; skip silently
        }
      }

      // Generate prompt for this node
      const prompt = PromptRouter.getPrompt(node, this.config, this.mode);
      await docker.copyFileToContainer(prompt, '/app/prompt.txt');

      // Build and run commands
      const commands = this.buildExecutionCommands(node);
      for (const cmd of commands) {
        const result = await docker.runCommandAsync(
          cmd,
          this.config.dockerTimeoutSeconds || 300,
        );
        if (result.status !== DockerRunStatus.SUCCESS) {
          throw new Error(`Command failed: ${cmd}\n${result.error}`);
        }
      }

      // Extract output from container
      const outputDir = this.workspace.getOutputDir(node.id);
      await fs.promises.mkdir(outputDir, { recursive: true });

      try {
        const outputContent = await docker.copyFileFromContainer('/app/output');
        // If copyFileFromContainer returns content, write it
        if (outputContent) {
          const outputFile = path.join(outputDir, 'result.json');
          await fs.promises.writeFile(outputFile, outputContent, 'utf8');
        }
      } catch {
        // Output extraction is best-effort; some nodes write directly via workspace
      }

      return {
        nodeId: node.id,
        status: PhaseStatus.COMPLETED,
        outputArtifactIds: node.outputArtifacts,
        startedAt,
        completedAt: Date.now(),
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        nodeId: node.id,
        status: PhaseStatus.FAILED,
        error: errMsg,
        outputArtifactIds: [],
        startedAt,
        completedAt: Date.now(),
      };
    } finally {
      await docker.shutdownContainer();
    }
  }

  // --- DAG construction ---

  private buildInitialDAG(detection: InputDetectionResult): PhaseNode[] {
    if (detection.mode === PipelineMode.REAL_DATA) {
      return this.buildModeBDAG();
    }
    return this.buildModeADAG();
  }

  /**
   * Mode A: Full 6-phase pipeline.
   * SCOPE → DESIGN → COLLECT → ANALYZE → SYNTHESIZE → REVIEW
   */
  private buildModeADAG(): PhaseNode[] {
    return [
      {
        id: 'scope',
        type: PhaseType.SCOPE,
        title: 'Research scoping and literature review',
        description: 'Analyze the input topic/RQ, conduct literature review, identify gaps, formulate research plan.',
        dependsOn: [],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['scope/research_plan'],
        inputArtifacts: [],
      },
      {
        id: 'design',
        type: PhaseType.DESIGN,
        title: 'Study design and protocol',
        description: 'Design the experiment: variables, conditions, questionnaires, participant requirements, analysis pre-registration.',
        dependsOn: ['scope'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['design/study_protocol', 'design/questionnaire', 'design/variables'],
        inputArtifacts: ['scope/research_plan'],
      },
      {
        id: 'collect',
        type: PhaseType.COLLECT,
        title: 'Data collection via simulated participants',
        description: 'Generate personas and run simulated experiment. Will be expanded into persona subtasks when design completes.',
        dependsOn: ['design'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['collect/raw_data'],
        inputArtifacts: ['design/study_protocol', 'design/questionnaire'],
      },
      {
        id: 'analyze',
        type: PhaseType.ANALYZE,
        title: 'Statistical analysis and visualization',
        description: 'Run statistical analyses, generate visualizations, produce APA-formatted results.',
        dependsOn: ['collect'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['analyze/results', 'analyze/results_apa'],
        inputArtifacts: ['collect/raw_data', 'design/study_protocol'],
      },
      {
        id: 'synthesize',
        type: PhaseType.SYNTHESIZE,
        title: 'Paper writing',
        description: 'Write all paper sections. Will be expanded into parallel section tasks when analysis completes.',
        dependsOn: ['analyze'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['synthesize/paper_draft'],
        inputArtifacts: ['scope/research_plan', 'design/study_protocol', 'analyze/results', 'analyze/results_apa'],
      },
      {
        id: 'review',
        type: PhaseType.REVIEW,
        title: 'Self-review and finalization',
        description: 'Review paper for methodological soundness, logical consistency, formatting, and identify limitations.',
        dependsOn: ['synthesize'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['review/review_report', 'review/final_paper'],
        inputArtifacts: ['synthesize/paper_draft'],
      },
    ];
  }

  /**
   * Mode B: Data-in pipeline.
   * Data Profile → Study Reconstruct → Analysis Plan → ANALYZE → SYNTHESIZE → REVIEW
   * COLLECT is skipped (user already provided data).
   */
  private buildModeBDAG(): PhaseNode[] {
    return [
      {
        id: 'scope/data-profile',
        type: PhaseType.SCOPE,
        title: 'Profile input dataset',
        description: 'Analyze data structure, column types, detect patterns, match known questionnaires.',
        dependsOn: [],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['scope/data_profile'],
        inputArtifacts: [],
      },
      {
        id: 'scope/study-reconstruct',
        type: PhaseType.SCOPE,
        title: 'Reconstruct study design from data',
        description: 'Reverse-engineer the study design from data structure: identify variables, factors, design type.',
        dependsOn: ['scope/data-profile'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['scope/reconstructed_study'],
        inputArtifacts: ['scope/data_profile'],
      },
      {
        id: 'design/analysis-plan',
        type: PhaseType.DESIGN,
        title: 'Generate analysis plan',
        description: 'Create a complete statistical analysis plan based on the reconstructed study design and data profile.',
        dependsOn: ['scope/study-reconstruct'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['design/analysis_plan'],
        inputArtifacts: ['scope/data_profile', 'scope/reconstructed_study'],
      },
      {
        id: 'analyze',
        type: PhaseType.ANALYZE,
        title: 'Statistical analysis and visualization',
        description: 'Execute the analysis plan: run statistical tests, generate visualizations, produce APA-formatted results.',
        dependsOn: ['design/analysis-plan'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['analyze/results', 'analyze/results_apa'],
        inputArtifacts: ['design/analysis_plan', 'scope/data_profile', 'scope/reconstructed_study'],
      },
      {
        id: 'synthesize',
        type: PhaseType.SYNTHESIZE,
        title: 'Paper writing',
        description: 'Write all paper sections based on analysis results.',
        dependsOn: ['analyze'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['synthesize/paper_draft'],
        inputArtifacts: ['scope/reconstructed_study', 'design/analysis_plan', 'analyze/results', 'analyze/results_apa'],
      },
      {
        id: 'review',
        type: PhaseType.REVIEW,
        title: 'Self-review and finalization',
        description: 'Review paper for methodological soundness, logical consistency, formatting, and identify limitations.',
        dependsOn: ['synthesize'],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['review/review_report', 'review/final_paper'],
        inputArtifacts: ['synthesize/paper_draft'],
      },
    ];
  }

  // --- Dynamic expansion ---

  private async maybeExpandDAG(): Promise<void> {
    const allNodes = this.dag.getAllNodes();

    for (const node of allNodes) {
      if (node.status !== PhaseStatus.COMPLETED) continue;

      // After DESIGN completes in Mode A → expand COLLECT with persona nodes
      if (node.id === 'design' && this.mode === PipelineMode.SIMULATED) {
        const collectNode = this.dag.getNode('collect');
        if (collectNode && collectNode.status === PhaseStatus.PENDING) {
          await this.expandCollectPhase();
        }
      }

      // After ANALYZE completes → expand SYNTHESIZE with section nodes
      if (node.id === 'analyze' || node.id === 'analyze/compile') {
        const synthNode = this.dag.getNode('synthesize');
        if (synthNode && synthNode.status === PhaseStatus.PENDING) {
          this.expandSynthesizePhase();
        }
      }
    }
  }

  private async expandCollectPhase(): Promise<void> {
    const personaCount = this.config.simulatedParticipantCount || 30;
    console.log(`[Pipeline] Expanding COLLECT phase with ${personaCount} personas`);

    const personaNodes = PersonaEngine.generatePersonaNodes(
      personaCount,
      this.config,
    );
    this.dag.expandNode('collect', personaNodes);
  }

  private expandSynthesizePhase(): void {
    const sections = [
      'abstract', 'introduction', 'related_work',
      'method', 'results', 'discussion', 'conclusion',
    ];

    console.log('[Pipeline] Expanding SYNTHESIZE phase with paper sections');

    const sectionNodes: PhaseNode[] = sections.map((section) => ({
      id: `synthesize/${section}`,
      type: PhaseType.SYNTHESIZE,
      title: `Write ${section.replace('_', ' ')} section`,
      description: `Write the ${section.replace('_', ' ')} section of the paper.`,
      dependsOn: [],
      status: PhaseStatus.PENDING,
      outputArtifacts: [`synthesize/${section}`],
      inputArtifacts: [
        'scope/research_plan',
        'design/study_protocol',
        'analyze/results',
        'analyze/results_apa',
      ],
    }));

    // Compile node: waits for all sections then assembles the full paper
    sectionNodes.push({
      id: 'synthesize/compile',
      type: PhaseType.SYNTHESIZE,
      title: 'Compile full paper draft',
      description: 'Assemble all sections into a cohesive paper draft.',
      dependsOn: sections.map((s) => `synthesize/${s}`),
      status: PhaseStatus.PENDING,
      outputArtifacts: ['synthesize/paper_draft'],
      inputArtifacts: sections.map((s) => `synthesize/${s}`),
    });

    this.dag.expandNode('synthesize', sectionNodes);
  }

  // --- Command building ---

  private buildExecutionCommands(node: PhaseNode): string[] {
    const commands: string[] = [];

    // Install base tools
    commands.push('apt-get update -qq && apt-get install -y -qq curl python3 python3-pip > /dev/null 2>&1');

    // Install Python scientific stack for analysis nodes
    if (node.type === PhaseType.ANALYZE) {
      commands.push(
        'pip3 install -q pandas numpy scipy statsmodels matplotlib seaborn 2>/dev/null'
      );
    }

    // Install the AI agent
    switch (this.config.agentType) {
      case SWEAgentType.CLAUDE_CODE:
        commands.push('npm install -g @anthropic-ai/claude-code 2>/dev/null');
        break;
      case SWEAgentType.GEMINI_CLI:
        commands.push('npm install -g @google/gemini-cli 2>/dev/null');
        break;
      case SWEAgentType.CODEX:
        commands.push('npm install -g @openai/codex 2>/dev/null');
        break;
    }

    // Run the AI agent with the prompt
    commands.push(this.buildAgentCommand(node));

    return commands;
  }

  private buildAgentCommand(node: PhaseNode): string {
    // Build the agent-specific command to process /app/prompt.txt
    // and write results to /app/output/
    const apiKeyExport = this.getAPIKeyExport();
    const baseCmd = `cd /app && ${apiKeyExport}`;

    switch (this.config.agentType) {
      case SWEAgentType.CLAUDE_CODE:
        return `${baseCmd} cat prompt.txt | claude --print 2>/dev/null > /app/output/result.json`;
      case SWEAgentType.GEMINI_CLI:
        return `${baseCmd} cat prompt.txt | gemini 2>/dev/null > /app/output/result.json`;
      default:
        return `${baseCmd} cat prompt.txt | claude --print 2>/dev/null > /app/output/result.json`;
    }
  }

  private getAPIKeyExport(): string {
    const parts: string[] = [];
    if (this.config.anthropicAPIKey) {
      parts.push(`export ANTHROPIC_API_KEY='${this.config.anthropicAPIKey}'`);
    }
    if (this.config.googleGeminiApiKey) {
      parts.push(`export GEMINI_API_KEY='${this.config.googleGeminiApiKey}'`);
    }
    if (this.config.openAICodexApiKey) {
      parts.push(`export OPENAI_API_KEY='${this.config.openAICodexApiKey}'`);
    }
    return parts.length > 0 ? parts.join(' && ') + ' && ' : '';
  }
}
