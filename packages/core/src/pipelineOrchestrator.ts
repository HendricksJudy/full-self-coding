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
 * The pipeline is fully AI-driven:
 *   1. A PLAN node runs first — the AI reads the input and designs
 *      the pipeline DAG (which phases, what order, what dependencies).
 *   2. The orchestrator builds the DAG from the AI's plan.
 *   3. Phases execute according to the DAG schedule.
 *   4. Dynamic expansion happens at two points:
 *      - COLLECT expands into persona subtasks (Mode A)
 *      - SYNTHESIZE expands into paper sections chosen by the
 *        synthesize/plan node
 *
 * Infrastructure code handles scheduling, isolation, and data flow.
 * AI agents make ALL intelligent decisions.
 */
export class PipelineOrchestrator {
  private dag!: DAG;
  private workspace!: WorkspaceManager;
  private config: HCIConfig;
  private activeExecutions: Map<string, Promise<PhaseResult>> = new Map();
  private mode!: PipelineMode;
  private planExpanded = false;
  private synthesisPlanExpanded = false;

  constructor(config: HCIConfig) {
    this.config = config;
  }

  /**
   * Main entry point. Runs the full pipeline from input to final artifacts.
   */
  async run(inputPath: string): Promise<PipelineState> {
    // 1. Detect input type (infrastructure-level: file extensions only)
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

    // 3. Write input metadata (AI PLAN phase reads this)
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

    // 4. Build initial DAG with just the PLAN node.
    //    The AI agent reads the input and outputs a pipeline_plan.json
    //    describing the full phase structure. The orchestrator then
    //    populates the DAG from that plan.
    const nodes = this.buildInitialDAG();
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

    // Detect which expansions already happened
    const planNode = this.dag.getNode('plan');
    if (planNode && planNode.status === PhaseStatus.COMPLETED) {
      this.planExpanded = true;
    }
    const synthPlanNode = this.dag.getNode('synthesize/plan');
    const synthNode = this.dag.getNode('synthesize');
    if (synthPlanNode?.status === PhaseStatus.COMPLETED && synthNode?.children) {
      this.synthesisPlanExpanded = true;
    }

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

  /**
   * Build the initial DAG with just a PLAN node.
   * The AI agent reads the input and designs the full pipeline.
   * After PLAN completes, expandPlanPhase() populates the real DAG.
   */
  private buildInitialDAG(): PhaseNode[] {
    return [
      {
        id: 'plan',
        type: PhaseType.PLAN,
        title: 'AI pipeline planning',
        description: 'Read the input, classify it, and design the optimal research pipeline.',
        dependsOn: [],
        status: PhaseStatus.PENDING,
        outputArtifacts: ['plan/pipeline_plan'],
        inputArtifacts: [],
      },
    ];
  }

  // --- Dynamic expansion ---

  private async maybeExpandDAG(): Promise<void> {
    const allNodes = this.dag.getAllNodes();

    for (const node of allNodes) {
      if (node.status !== PhaseStatus.COMPLETED) continue;

      // After PLAN completes → build the real pipeline from AI output
      if (node.id === 'plan' && !this.planExpanded) {
        await this.expandPlanPhase();
        this.planExpanded = true;
      }

      // After any DESIGN-type node completes in Mode A → expand COLLECT with persona nodes
      if (node.type === PhaseType.DESIGN && this.mode === PipelineMode.SIMULATED) {
        const collectNode = this.dag.getNode('collect');
        if (collectNode && collectNode.status === PhaseStatus.PENDING && !collectNode.children) {
          // Verify all collect dependencies are met
          const allDepsDone = collectNode.dependsOn.every((depId) => {
            const dep = this.dag.getNode(depId);
            return dep && (dep.status === PhaseStatus.COMPLETED || dep.status === PhaseStatus.SKIPPED);
          });
          if (allDepsDone) {
            await this.expandCollectPhase();
          }
        }
      }

      // After synthesize/plan completes → expand SYNTHESIZE with AI-chosen sections
      if (node.id === 'synthesize/plan' && !this.synthesisPlanExpanded) {
        const synthNode = this.dag.getNode('synthesize');
        if (synthNode && synthNode.status === PhaseStatus.PENDING) {
          await this.expandSynthesizeSections();
          this.synthesisPlanExpanded = true;
        }
      }
    }
  }

  /**
   * Read the AI's pipeline plan and populate the DAG with the real phases.
   * The PLAN node output contains pipeline_plan.json with the full phase
   * structure designed by the AI agent.
   */
  private async expandPlanPhase(): Promise<void> {
    const outputDir = this.workspace.getOutputDir('plan');

    let planJson: string;
    try {
      planJson = await fs.promises.readFile(
        path.join(outputDir, 'pipeline_plan.json'), 'utf8',
      );
    } catch {
      // Fallback: AI might have written to result.json
      planJson = await fs.promises.readFile(
        path.join(outputDir, 'result.json'), 'utf8',
      );
    }

    const plan = JSON.parse(planJson);

    // Update mode from AI classification
    if (plan.inputClassification) {
      const aiMode = plan.inputClassification.mode === 'B'
        ? PipelineMode.REAL_DATA
        : PipelineMode.SIMULATED;
      this.mode = aiMode;
      console.log(
        `[Pipeline] AI classified input as: ${plan.inputClassification.type} (Mode ${plan.inputClassification.mode})`,
      );
      if (plan.inputClassification.reasoning) {
        console.log(`[Pipeline] Reasoning: ${plan.inputClassification.reasoning}`);
      }
    }

    // Parse AI-designed nodes into PhaseNode objects
    const validTypes = new Set(Object.values(PhaseType));
    const newNodes: PhaseNode[] = (plan.nodes || []).map((n: any) => ({
      id: n.id,
      type: validTypes.has(n.type) ? (n.type as PhaseType) : PhaseType.SCOPE,
      title: n.title || n.id,
      description: n.description || '',
      dependsOn: Array.isArray(n.dependsOn) ? n.dependsOn : [],
      status: PhaseStatus.PENDING,
      outputArtifacts: Array.isArray(n.outputArtifacts) ? n.outputArtifacts : [],
      inputArtifacts: Array.isArray(n.inputArtifacts) ? n.inputArtifacts : [],
    }));

    // Add all AI-planned nodes to the DAG
    this.dag.addNodes(newNodes);

    // Validate the expanded DAG
    const errors = this.dag.validate();
    if (errors.length > 0) {
      console.warn('[Pipeline] DAG validation warnings after plan expansion:', errors);
    }

    console.log(`[Pipeline] PLAN phase expanded DAG with ${newNodes.length} nodes`);
  }

  /**
   * Expand the COLLECT phase with persona subtask nodes.
   * Uses PersonaEngine to generate context → experience → participate chains.
   */
  private async expandCollectPhase(): Promise<void> {
    const personaCount = this.config.simulatedParticipantCount || 30;
    console.log(`[Pipeline] Expanding COLLECT phase with ${personaCount} personas`);

    const personaNodes = PersonaEngine.generatePersonaNodes(
      personaCount,
      this.config,
    );
    this.dag.expandNode('collect', personaNodes);
  }

  /**
   * Read the AI's section plan and expand SYNTHESIZE with paper sections.
   * The synthesize/plan node output contains section_plan.json with
   * the paper structure designed by the AI agent.
   */
  private async expandSynthesizeSections(): Promise<void> {
    const outputDir = this.workspace.getOutputDir('synthesize/plan');

    let planJson: string;
    try {
      planJson = await fs.promises.readFile(
        path.join(outputDir, 'section_plan.json'), 'utf8',
      );
    } catch {
      planJson = await fs.promises.readFile(
        path.join(outputDir, 'result.json'), 'utf8',
      );
    }

    const plan = JSON.parse(planJson);
    const sections: any[] = plan.sections || [];

    console.log(`[Pipeline] Expanding SYNTHESIZE with ${sections.length} AI-planned sections`);

    // Build section nodes from AI plan
    const sectionNodes: PhaseNode[] = sections.map((s: any) => ({
      id: `synthesize/${s.id}`,
      type: PhaseType.SYNTHESIZE,
      title: `Write: ${s.title || s.id}`,
      description: s.description || `Write the ${s.title || s.id} section of the paper.`,
      dependsOn: [], // All sections can be written in parallel
      status: PhaseStatus.PENDING,
      outputArtifacts: [`synthesize/${s.id}`],
      inputArtifacts: Array.isArray(s.inputArtifacts) ? s.inputArtifacts : [],
    }));

    // Add compile node that waits for all sections
    const compileDescription = plan.paperTitle
      ? `Assemble all sections into a cohesive paper draft. Suggested title: "${plan.paperTitle}"`
      : 'Assemble all sections into a cohesive paper draft.';

    sectionNodes.push({
      id: 'synthesize/compile',
      type: PhaseType.SYNTHESIZE,
      title: 'Compile full paper draft',
      description: compileDescription,
      dependsOn: sections.map((s: any) => `synthesize/${s.id}`),
      status: PhaseStatus.PENDING,
      outputArtifacts: ['synthesize/paper_draft'],
      inputArtifacts: sections.map((s: any) => `synthesize/${s.id}`),
    });

    this.dag.expandNode('synthesize', sectionNodes);
  }

  // --- Command building ---

  private buildExecutionCommands(node: PhaseNode): string[] {
    const commands: string[] = [];

    // Install base tools
    commands.push('apt-get update -qq && apt-get install -y -qq curl python3 python3-pip > /dev/null 2>&1');

    // Install Python scientific stack for ALL phases that may need data science.
    // The AI agents are autonomous data scientists — they write and execute
    // Python scripts for analysis, visualization, data profiling, etc.
    // Every phase might need Python (e.g., SCOPE/data-profile runs pandas,
    // ANALYZE runs scipy, COLLECT/aggregate processes JSON), so install everywhere.
    commands.push(
      'pip3 install -q pandas numpy scipy statsmodels matplotlib seaborn pingouin 2>/dev/null'
    );

    // Create /app/scripts/ for AI-written code
    commands.push('mkdir -p /app/scripts /app/output/figures');

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

    // Run the AI agent with the prompt.
    // The agent reads /app/prompt.txt, examines /app/input/,
    // writes and executes Python scripts, and writes results to /app/output/.
    commands.push(this.buildAgentCommand(node));

    return commands;
  }

  private buildAgentCommand(node: PhaseNode): string {
    // The AI agent operates in /app/. It can:
    //   - Read prompt.txt (its instructions)
    //   - Read input/ (upstream artifacts and data files)
    //   - Write and execute Python scripts (for data science)
    //   - Write results to output/
    const apiKeyExport = this.getAPIKeyExport();
    const baseCmd = `cd /app && ${apiKeyExport}`;

    switch (this.config.agentType) {
      case SWEAgentType.CLAUDE_CODE:
        // Claude Code gets the prompt and runs autonomously in /app/
        // It can use tools: write files, run Python, read data, etc.
        return `${baseCmd} claude --print "$(cat prompt.txt)" 2>/dev/null`;
      case SWEAgentType.GEMINI_CLI:
        return `${baseCmd} gemini "$(cat prompt.txt)" 2>/dev/null`;
      default:
        return `${baseCmd} claude --print "$(cat prompt.txt)" 2>/dev/null`;
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
