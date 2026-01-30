import { type PhaseNode, PhaseType } from './phase';
import type { Artifact, ArtifactManifest } from './artifact';
import type { PipelineState } from './pipelineState';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Manages the filesystem layout for an HCI research project.
 * Creates directories, enforces isolation rules, reads/writes artifacts,
 * and persists pipeline state for resumability.
 */
export class WorkspaceManager {
  private rootPath: string;
  private projectId: string;

  constructor(projectId: string, baseDir?: string) {
    this.projectId = projectId;
    const base = baseDir || path.join(os.homedir(), '.fsc-hci', 'workspace');
    this.rootPath = path.join(base, projectId);
  }

  /**
   * Create the full directory skeleton for a new project.
   */
  async initialize(): Promise<void> {
    const dirs = [
      '',
      'input',
      'phases',
      'phases/plan',
      'phases/plan/output',
      'phases/scope',
      'phases/scope/output',
      'phases/design',
      'phases/design/output',
      'phases/collect',
      'phases/collect/output',
      'phases/collect/personas',
      'phases/analyze',
      'phases/analyze/output',
      'phases/analyze/scripts',
      'phases/analyze/figures',
      'phases/synthesize',
      'phases/synthesize/output',
      'phases/synthesize/sections',
      'phases/review',
      'phases/review/output',
      'artifacts',
      'artifacts/figures',
      'artifacts/data',
      'artifacts/analysis_code',
    ];

    for (const dir of dirs) {
      const fullPath = path.join(this.rootPath, dir);
      await fs.promises.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Resolve absolute path for a phase node's working directory.
   * Maps node IDs to filesystem paths:
   *   "scope"                           → phases/scope/
   *   "collect/persona-001/context"     → phases/collect/personas/persona-001/
   *   "analyze/desc-1"                  → phases/analyze/scripts/desc-1/
   *   "synthesize/introduction"         → phases/synthesize/sections/introduction/
   */
  getNodeWorkDir(nodeId: string): string {
    const parts = nodeId.split('/');
    const phaseType = parts[0];

    if (parts.length === 1) {
      // Top-level phase
      return path.join(this.rootPath, 'phases', phaseType);
    }

    if (phaseType === 'collect' && parts[1]?.startsWith('persona-')) {
      // Persona subtask: collect/persona-001/context
      return path.join(this.rootPath, 'phases', 'collect', 'personas', parts[1]);
    }

    if (phaseType === 'analyze') {
      // Analysis subtask
      return path.join(this.rootPath, 'phases', 'analyze', 'scripts', parts.slice(1).join('/'));
    }

    if (phaseType === 'synthesize') {
      // Paper section subtask
      return path.join(this.rootPath, 'phases', 'synthesize', 'sections', parts.slice(1).join('/'));
    }

    // Generic fallback
    return path.join(this.rootPath, 'phases', ...parts);
  }

  /**
   * Resolve the output directory for a node.
   */
  getOutputDir(nodeId: string): string {
    const workDir = this.getNodeWorkDir(nodeId);
    const parts = nodeId.split('/');

    // Persona subtasks write directly to their persona directory
    if (parts[0] === 'collect' && parts[1]?.startsWith('persona-')) {
      return workDir;
    }

    // Top-level phases use output/ subdirectory
    if (parts.length === 1) {
      return path.join(workDir, 'output');
    }

    // Analysis and synthesize subtasks use their own directory
    return workDir;
  }

  /**
   * Resolve paths that a node is allowed to READ from,
   * based on its inputArtifacts.
   */
  getReadablePaths(node: PhaseNode): string[] {
    const paths: string[] = [];

    // Always readable: input directory
    paths.push(path.join(this.rootPath, 'input'));

    // Readable based on input artifacts
    for (const artifactId of node.inputArtifacts) {
      const artifactPath = this.resolveArtifactPath(artifactId);
      if (artifactPath) {
        paths.push(artifactPath);
      }
    }

    // Also readable: output of dependency nodes
    for (const depId of node.dependsOn) {
      paths.push(this.getOutputDir(depId));
    }

    return [...new Set(paths)]; // deduplicate
  }

  /**
   * Write an artifact file and register it in the manifest.
   */
  async writeArtifact(artifact: Artifact, content: string | Buffer): Promise<void> {
    const fullPath = path.join(this.rootPath, artifact.path);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });

    if (typeof content === 'string') {
      await fs.promises.writeFile(fullPath, content, 'utf8');
    } else {
      await fs.promises.writeFile(fullPath, content);
    }

    artifact.createdAt = Date.now();

    // Update manifest
    await this.addToManifest(artifact);
  }

  /**
   * Read an artifact by its relative path.
   */
  async readArtifact(relativePath: string): Promise<string> {
    const fullPath = path.join(this.rootPath, relativePath);
    return fs.promises.readFile(fullPath, 'utf8');
  }

  /**
   * Read an artifact by ID from the manifest.
   */
  async readArtifactById(artifactId: string): Promise<string> {
    const manifest = await this.loadManifest();
    const artifact = manifest.artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      throw new Error(`Artifact "${artifactId}" not found in manifest`);
    }
    return this.readArtifact(artifact.path);
  }

  /**
   * Persist pipeline state to pipeline.json.
   */
  async savePipelineState(state: PipelineState): Promise<void> {
    state.updatedAt = Date.now();
    const filePath = path.join(this.rootPath, 'pipeline.json');
    await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Load pipeline state from pipeline.json.
   * Returns null if no saved state exists (new project).
   */
  async loadPipelineState(): Promise<PipelineState | null> {
    const filePath = path.join(this.rootPath, 'pipeline.json');
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content) as PipelineState;
    } catch {
      return null;
    }
  }

  /**
   * Copy user input files into the input/ directory.
   * Handles both single files and directories.
   */
  async importInput(sourcePath: string): Promise<void> {
    const inputDir = path.join(this.rootPath, 'input');
    const stat = await fs.promises.stat(sourcePath);

    if (stat.isFile()) {
      const fileName = path.basename(sourcePath);
      await fs.promises.copyFile(sourcePath, path.join(inputDir, fileName));
    } else if (stat.isDirectory()) {
      await this.copyDirRecursive(sourcePath, inputDir);
    }
  }

  /**
   * Create a persona directory under collect/personas/.
   */
  async createPersonaDir(personaId: string): Promise<string> {
    const personaDir = path.join(this.rootPath, 'phases', 'collect', 'personas', personaId);
    await fs.promises.mkdir(personaDir, { recursive: true });
    return personaDir;
  }

  /**
   * Compile final deliverables into the artifacts/ directory.
   */
  async compileArtifacts(): Promise<void> {
    const artifactsDir = path.join(this.rootPath, 'artifacts');

    // Copy paper draft
    const paperPath = path.join(this.rootPath, 'phases', 'synthesize', 'output', 'paper_draft.md');
    if (await this.fileExists(paperPath)) {
      await fs.promises.copyFile(paperPath, path.join(artifactsDir, 'paper.md'));
    }

    // Copy figures
    const figuresDir = path.join(this.rootPath, 'phases', 'analyze', 'figures');
    if (await this.dirExists(figuresDir)) {
      await this.copyDirRecursive(figuresDir, path.join(artifactsDir, 'figures'));
    }

    // Copy analysis scripts
    const scriptsDir = path.join(this.rootPath, 'phases', 'analyze', 'scripts');
    if (await this.dirExists(scriptsDir)) {
      await this.copyDirRecursive(scriptsDir, path.join(artifactsDir, 'analysis_code'));
    }

    // Copy raw data
    const collectOutput = path.join(this.rootPath, 'phases', 'collect', 'output');
    if (await this.dirExists(collectOutput)) {
      await this.copyDirRecursive(collectOutput, path.join(artifactsDir, 'data'));
    }

    // Write manifest
    const manifest = await this.loadManifest();
    await fs.promises.writeFile(
      path.join(artifactsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );
  }

  /**
   * Return workspace root path.
   */
  getRootPath(): string {
    return this.rootPath;
  }

  /**
   * Return project ID.
   */
  getProjectId(): string {
    return this.projectId;
  }

  // --- Private helpers ---

  private resolveArtifactPath(artifactId: string): string | null {
    // Artifact IDs follow patterns like:
    //   "design/study_protocol" → phases/design/output/study_protocol.json
    //   "persona-001/profile"   → phases/collect/personas/persona-001/profile.json
    //   "collect/raw_data"      → phases/collect/output/raw_data.json

    const parts = artifactId.split('/');

    if (parts[0]?.startsWith('persona-')) {
      return path.join(this.rootPath, 'phases', 'collect', 'personas', parts[0]);
    }

    if (parts.length === 2) {
      const phase = parts[0];
      return path.join(this.rootPath, 'phases', phase, 'output');
    }

    return null;
  }

  private async addToManifest(artifact: Artifact): Promise<void> {
    const manifest = await this.loadManifest();
    const existing = manifest.artifacts.findIndex((a) => a.id === artifact.id);
    if (existing >= 0) {
      manifest.artifacts[existing] = artifact;
    } else {
      manifest.artifacts.push(artifact);
    }
    manifest.updatedAt = Date.now();
    const manifestPath = path.join(this.rootPath, 'artifacts', 'manifest.json');
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  private async loadManifest(): Promise<ArtifactManifest> {
    const manifestPath = path.join(this.rootPath, 'artifacts', 'manifest.json');
    try {
      const content = await fs.promises.readFile(manifestPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {
        projectId: this.projectId,
        artifacts: [],
        updatedAt: Date.now(),
      };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async dirExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async copyDirRecursive(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
}
