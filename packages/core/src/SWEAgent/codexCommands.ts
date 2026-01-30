import { type Config, SWEAgentType } from "../config";

/**
 * Returns the command to run OpenAI Codex, either for analysis or task solving.
 * @param config The configuration object.
 * @param bIsAnalyzer Whether to run the analyzer or the task solver. True for analyzer, false for task solver.
 * @returns The command to run Codex.
 */
export function getCodexCommand(config: Config, bIsAnalyzer: boolean = true): string {
    if (config.agentType !== SWEAgentType.CODEX) {
        throw new Error("getCodexCommand: config.agentType must be CODEX");
    }

    const promptFile = bIsAnalyzer
        ? '/app/codeAnalyzerPrompt.txt'
        : '/app/taskSolverPrompt.txt';

    let cmd = `codex exec --sandbox danger-full-access "all the task descriptions are located at ${promptFile}, please read and execute"`;

    const envExports: string[] = [];

    if (config.openAICodexApiKey && config.openAICodexAPIKeyExportNeeded) {
        envExports.push(`export OPENAI_API_KEY=${config.openAICodexApiKey}`);
    }

    if (config.openAICodexAPIBaseUrl) {
        envExports.push(`export OPENAI_BASE_URL=${config.openAICodexAPIBaseUrl}`);
    }

    if (envExports.length > 0) {
        cmd = `${envExports.join(' && ')} && ${cmd}`;
    }

    return cmd;
}
