import { type PhaseNode, PhaseStatus } from './phase';

/**
 * Directed Acyclic Graph engine for pipeline scheduling.
 *
 * Pure logic module (no I/O). Manages the dependency graph: determines
 * which nodes are ready to run, validates the graph, provides topological
 * ordering, and supports dynamic expansion of nodes at runtime.
 */
export class DAG {
  private nodes: Map<string, PhaseNode>;

  constructor(nodes: PhaseNode[]) {
    this.nodes = new Map();
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  /**
   * Returns nodes whose dependencies are ALL completed
   * and whose own status is PENDING.
   */
  getReadyNodes(): PhaseNode[] {
    const ready: PhaseNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.status !== PhaseStatus.PENDING) continue;
      const allDepsCompleted = node.dependsOn.every((depId) => {
        const dep = this.nodes.get(depId);
        return dep && (dep.status === PhaseStatus.COMPLETED || dep.status === PhaseStatus.SKIPPED);
      });
      if (allDepsCompleted) {
        ready.push(node);
      }
    }
    return ready;
  }

  /**
   * Update a node's status. When marking COMPLETED or FAILED,
   * sets the corresponding timestamp.
   */
  updateStatus(nodeId: string, status: PhaseStatus, error?: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`DAG: node "${nodeId}" not found`);
    }
    node.status = status;
    if (status === PhaseStatus.RUNNING) {
      node.startedAt = Date.now();
    }
    if (status === PhaseStatus.COMPLETED || status === PhaseStatus.FAILED || status === PhaseStatus.SKIPPED) {
      node.completedAt = Date.now();
    }
    if (error) {
      node.error = error;
    }

    // If a parent node exists (virtual parent from expansion),
    // check if all children are done
    this.updateParentStatus(nodeId);
  }

  /**
   * Get a node by ID.
   */
  getNode(nodeId: string): PhaseNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Validate graph integrity:
   * - No cycles
   * - All dependsOn references point to existing nodes
   * - At least one root node (no dependencies)
   * Returns list of validation errors (empty = valid).
   */
  validate(): string[] {
    const errors: string[] = [];

    // Check all dependencies reference existing nodes
    for (const node of this.nodes.values()) {
      for (const depId of node.dependsOn) {
        if (!this.nodes.has(depId)) {
          errors.push(`Node "${node.id}" depends on non-existent node "${depId}"`);
        }
      }
    }

    // Check for at least one root node
    const roots = [...this.nodes.values()].filter((n) => n.dependsOn.length === 0);
    if (roots.length === 0 && this.nodes.size > 0) {
      errors.push('DAG has no root nodes (all nodes have dependencies)');
    }

    // Check for cycles using DFS
    const cycleError = this.detectCycle();
    if (cycleError) {
      errors.push(cycleError);
    }

    return errors;
  }

  /**
   * Returns a topological ordering of all node IDs.
   * Throws if the graph contains a cycle.
   */
  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error(`DAG contains a cycle involving node "${nodeId}"`);
      }
      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependsOn) {
          visit(depId);
        }
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  /**
   * Add new nodes to the DAG at runtime.
   * Used after the PLAN phase completes to populate the real pipeline
   * based on the AI agent's pipeline plan.
   */
  addNodes(newNodes: PhaseNode[]): void {
    for (const node of newNodes) {
      this.nodes.set(node.id, node);
    }
  }

  /**
   * Expand a node by replacing it with child subtasks.
   * The original node becomes a virtual parent: it is COMPLETED
   * when all children are COMPLETED.
   *
   * Used when a phase (e.g. COLLECT) needs to dynamically generate
   * subtasks after an upstream phase completes.
   */
  expandNode(parentId: string, children: PhaseNode[]): void {
    const parent = this.nodes.get(parentId);
    if (!parent) {
      throw new Error(`DAG: cannot expand non-existent node "${parentId}"`);
    }

    // Store children on the parent
    parent.children = children;

    // Set parent to RUNNING (it completes when all children complete)
    parent.status = PhaseStatus.RUNNING;
    parent.startedAt = Date.now();

    // Add all children as top-level nodes in the DAG.
    // Children's dependsOn are relative within the expansion,
    // but we also need to add the parent's original dependencies
    // to root children (children with no intra-expansion deps).
    for (const child of children) {
      // Prefix children's dependsOn that don't already include full paths
      const resolvedDeps = child.dependsOn.map((depId) => {
        // If the dep exists as a sibling child, keep as-is
        if (children.some((c) => c.id === depId)) return depId;
        // If the dep is an existing node, keep as-is
        if (this.nodes.has(depId)) return depId;
        return depId;
      });
      child.dependsOn = resolvedDeps;
      this.nodes.set(child.id, child);
    }

    // Rewrite downstream nodes that depend on the parent
    // to instead depend on the last child(ren) or an aggregation node.
    // Convention: the last child added is the aggregation node.
    const aggregationNode = children[children.length - 1];
    for (const node of this.nodes.values()) {
      if (node.id === parentId) continue;
      node.dependsOn = node.dependsOn.map((depId) => {
        if (depId === parentId) return aggregationNode.id;
        return depId;
      });
    }
  }

  /**
   * Returns all nodes as a flat array.
   */
  getAllNodes(): PhaseNode[] {
    return [...this.nodes.values()];
  }

  /**
   * Check if entire DAG is complete (all nodes COMPLETED or SKIPPED,
   * or FAILED with no pending downstream).
   */
  isComplete(): boolean {
    for (const node of this.nodes.values()) {
      if (node.status === PhaseStatus.PENDING || node.status === PhaseStatus.RUNNING) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if DAG is stuck: no ready nodes, some nodes still pending,
   * but nothing is running.
   */
  isStuck(): boolean {
    if (this.isComplete()) return false;
    const ready = this.getReadyNodes();
    const running = [...this.nodes.values()].filter((n) => n.status === PhaseStatus.RUNNING);
    return ready.length === 0 && running.length === 0;
  }

  /**
   * Returns summary stats about the DAG.
   */
  getSummary(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    skipped: number;
  } {
    let pending = 0, running = 0, completed = 0, failed = 0, skipped = 0;
    for (const node of this.nodes.values()) {
      switch (node.status) {
        case PhaseStatus.PENDING: pending++; break;
        case PhaseStatus.RUNNING: running++; break;
        case PhaseStatus.COMPLETED: completed++; break;
        case PhaseStatus.FAILED: failed++; break;
        case PhaseStatus.SKIPPED: skipped++; break;
      }
    }
    return { total: this.nodes.size, pending, running, completed, failed, skipped };
  }

  // --- Private helpers ---

  private detectCycle(): string | null {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (nodeId: string): string | null => {
      if (visited.has(nodeId)) return null;
      if (visiting.has(nodeId)) return `DAG contains a cycle involving node "${nodeId}"`;
      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependsOn) {
          const result = dfs(depId);
          if (result) return result;
        }
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
      return null;
    };

    for (const nodeId of this.nodes.keys()) {
      const result = dfs(nodeId);
      if (result) return result;
    }
    return null;
  }

  /**
   * When a child node completes, check if all siblings under the same
   * virtual parent are also done. If so, mark the parent as COMPLETED.
   */
  private updateParentStatus(childId: string): void {
    for (const node of this.nodes.values()) {
      if (!node.children) continue;
      const isChild = node.children.some((c) => c.id === childId);
      if (!isChild) continue;

      const allChildrenDone = node.children.every((c) => {
        const childNode = this.nodes.get(c.id);
        return childNode && (
          childNode.status === PhaseStatus.COMPLETED ||
          childNode.status === PhaseStatus.SKIPPED
        );
      });
      const anyChildFailed = node.children.some((c) => {
        const childNode = this.nodes.get(c.id);
        return childNode && childNode.status === PhaseStatus.FAILED;
      });

      if (allChildrenDone) {
        node.status = PhaseStatus.COMPLETED;
        node.completedAt = Date.now();
      } else if (anyChildFailed && !node.children.some((c) => {
        const cn = this.nodes.get(c.id);
        return cn && (cn.status === PhaseStatus.PENDING || cn.status === PhaseStatus.RUNNING);
      })) {
        node.status = PhaseStatus.FAILED;
        node.completedAt = Date.now();
        node.error = 'One or more child nodes failed';
      }
    }
  }
}
