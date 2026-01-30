import { type PhaseNode, PhaseType } from '../../phase';
import type { HCIConfig } from '../../hciConfig';
import { PipelineMode } from '../../hciConfig';
import { pipelinePlanPrompt, sectionPlanPrompt } from './planPrompt';
import { scopePrompt, dataProfilePrompt, studyReconstructPrompt } from './scopePrompt';
import { designPrompt, analysisDesignPrompt } from './designPrompt';
import { contextPrompt, experiencePrompt, participatePrompt, aggregatePrompt } from './collectPrompt';
import { analyzePrompt } from './analyzePrompt';
import { synthesizeSectionPrompt, synthesizeCompilePrompt } from './synthesizePrompt';
import { reviewPrompt } from './reviewPrompt';

/**
 * Routes a PhaseNode to its appropriate prompt template.
 */
export class PromptRouter {
  static getPrompt(node: PhaseNode, config: HCIConfig, mode: PipelineMode): string {
    // Handle sub-node IDs (e.g., "collect/persona-001/context")
    const parts = node.id.split('/');

    switch (node.type) {
      case PhaseType.PLAN:
        return pipelinePlanPrompt(config);

      case PhaseType.SCOPE:
        return PromptRouter.getScopePrompt(node, config, mode);

      case PhaseType.DESIGN:
        return PromptRouter.getDesignPrompt(node, config, mode);

      case PhaseType.COLLECT:
        return PromptRouter.getCollectPrompt(node, parts, config);

      case PhaseType.ANALYZE:
        return analyzePrompt(node, config);

      case PhaseType.SYNTHESIZE:
        return PromptRouter.getSynthesizePrompt(node, parts, config);

      case PhaseType.REVIEW:
        return reviewPrompt(node, config);

      default:
        return `Execute task: ${node.title}\n\n${node.description}`;
    }
  }

  private static getScopePrompt(node: PhaseNode, config: HCIConfig, mode: PipelineMode): string {
    if (node.id === 'scope/data-profile') {
      return dataProfilePrompt(config);
    }
    if (node.id === 'scope/study-reconstruct') {
      return studyReconstructPrompt(config);
    }
    return scopePrompt(config);
  }

  private static getDesignPrompt(node: PhaseNode, config: HCIConfig, mode: PipelineMode): string {
    if (node.id === 'design/analysis-plan') {
      return analysisDesignPrompt(config);
    }
    return designPrompt(config);
  }

  private static getCollectPrompt(node: PhaseNode, parts: string[], config: HCIConfig): string {
    if (parts[1]?.startsWith('persona-') && parts[2]) {
      const personaId = parts[1];
      const step = parts[2];
      switch (step) {
        case 'context':     return contextPrompt(personaId, config);
        case 'experience':  return experiencePrompt(personaId, config);
        case 'participate': return participatePrompt(personaId, config);
      }
    }
    if (node.id === 'collect/aggregate') {
      return aggregatePrompt(config);
    }
    return `Collect data: ${node.description}`;
  }

  private static getSynthesizePrompt(node: PhaseNode, parts: string[], config: HCIConfig): string {
    // Section planning is routed via synthesize/plan node ID
    if (node.id === 'synthesize/plan') {
      return sectionPlanPrompt(config);
    }
    if (node.id === 'synthesize/compile') {
      return synthesizeCompilePrompt(config);
    }
    if (parts.length >= 2 && parts[0] === 'synthesize') {
      const section = parts.slice(1).join('/');
      // Pass the node's AI-planned description as writing context
      return synthesizeSectionPrompt(section, config, node.description);
    }
    return `Write paper: ${node.description}`;
  }
}
