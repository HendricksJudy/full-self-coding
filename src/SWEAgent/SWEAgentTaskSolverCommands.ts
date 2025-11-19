import { SWEAgentType } from "../config";
import type { Config } from "../config";
import type {Task} from "../task";
import {diffNodejsSourceCode} from "../prompts/diff_nodejs";
import {getClaudeCommand} from "./claudeCodeCommands";

const diffjsPrompt = diffNodejsSourceCode;

function environmentSetup(config: Config, gitRemoteUrl: string, task: Task, bInstallAgent: boolean = true): string[] {
  let setupCommands = [
    `git clone ${gitRemoteUrl} /app/repo`,
    "apt-get update",
    "apt-get install -y curl",
    "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
    "apt-get install -y nodejs",
    "mkdir /app/diff && cd /app/diff && npm install simple-git",
    
    // save diffjsPrompt into /app/diff/run.js
    `echo "${diffjsPrompt}" > /app/diff/run.js`,
  ];

  if (bInstallAgent) {
    switch (config.agentType) {
      case SWEAgentType.GEMINI_CLI:
        setupCommands.push(
          "npm install -g @google/gemini-cli",
        );
        break;
      case SWEAgentType.CLAUDE_CODE:
        setupCommands.push(
          "npm install -g @anthropic-ai/claude-code",
        );
        break;
      case SWEAgentType.CODEX:
        setupCommands.push(
          "npm install -g @openai/codex",
        );
        break;
      default:
        throw new Error(`Unsupported agent type: ${config.agentType}`);
   }
  }
  setupCommands.push("mkdir /app/repo/fsc");
  // setupCommands.push(
  //   ...addTaskSolverPromptIntoPath(
  //     taskSolverPrompt(task, config),"/app/taskSolverPrompt.txt"));
  return setupCommands;
}

export function taskSolverCommands(
  agentType:SWEAgentType,
  config: Config,
  task: Task,
  gitRemoteUrl: string,
): string[] {
  if (agentType == SWEAgentType.CODEX){
    throw new Error("CODEX is not supported yet for the task solver."); 
  }

  let finalCommandsList = [] 
  finalCommandsList.push(...environmentSetup(config , gitRemoteUrl , task));

  switch (agentType) {
    case SWEAgentType.GEMINI_CLI:
      finalCommandsList.push(GeminiExecutionCommand(config));
      return finalCommandsList;
    case SWEAgentType.CLAUDE_CODE:
      finalCommandsList.push(getClaudeCommand(config, false));
      return finalCommandsList;
    default:
      break;
  }

  throw new Error(`Unsupported agent type: ${agentType}`);
}

function GeminiExecutionCommand(config: Config): string{
  if (config.googleGeminiApiKey && config.googleGeminiAPIKeyExportNeeded) {
    return `export GEMINI_API_KEY=${config.googleGeminiApiKey} && gemini -p "all the task descriptions are located at /app/taskSolverPrompt.txt, please read and execute" --yolo`;
  }
  return `gemini -p "all the task descriptions are located at /app/taskSolverPrompt.txt, please read and execute" --yolo`;
}