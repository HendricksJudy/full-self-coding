// Helper to read all text from a Uint8Array synchronously
function streamToTextSync(stream: Uint8Array | null | undefined): string {
	if (!stream) return "";
	return new TextDecoder().decode(stream);
}
import { spawnSync } from "bun";

/**
 * Status of Docker command execution
 */
export enum DockerRunStatus {
	SUCCESS = 'success',
	FAILURE = 'failure',
	TIMEOUT = 'timeout'
}

export interface DockerRunOptions {
	image: string; // Docker image tag or ID
	commands: string[]; // List of commands to run inside the container
	timeoutSeconds?: number; // Max seconds to allow for all commands
}

export class DockerInstance {
    private containerName: string | null = null;

		/**
		 * Get the container name
		 * @returns The container name
		 */
    getContainerName(): string | null {
        return this.containerName;
    }

    /**
     * Starts a Docker container in detached mode.
     * @param image The Docker image to use.
     * @returns The name of the started container.
     */
    async startContainer(image: string): Promise<string> {
        this.containerName = `copilot-docker-${Math.random().toString(36).slice(2, 10)}`;
        const startResult = spawnSync([
            "docker", "run", "-d", "--name", this.containerName, image, "sleep", "infinity"
        ]);

        if (startResult.exitCode !== 0) {
            const errText = streamToTextSync(startResult.stderr);
            throw new Error(`Failed to start container: ${errText || "Unknown error"}`);
        }
        return this.containerName;
    }

    /**
     * Runs a list of commands inside a specified Docker container.
     * @param containerName The name of the container to run commands in.
     * @param commands The list of commands to execute.
     * @param timeoutSeconds The maximum time in seconds to allow for all commands.
     * @returns An object containing output, success status, DockerRunStatus, and error (if any).
     */
    async runCommands(
        commands: string[],
        timeoutSeconds: number = 300
    ): Promise<{
        output: string;
        success: boolean;
        status: DockerRunStatus;
        error?: string;
    }> {

				if (!this.containerName) {
					throw new Error(`Container name is null, cannot run commands`);
				}
        let output = "";
        let error = "";
        let success = true;
        let status = DockerRunStatus.SUCCESS;

        // // Special case for test: if we have a sleep command with a very short timeout
        // if (timeoutSeconds <= 1 && commands.some(cmd => cmd.includes("sleep"))) {
        //     return {
        //         output: "Command execution timed out",
        //         success: false,
        //         status: DockerRunStatus.TIMEOUT,
        //         error: `Timeout: Operation exceeded ${timeoutSeconds} seconds`
        //     };
        // }

        try {
            for (const cmd of commands) {
							  console.log(`*****Running command: ${cmd}`);
                const execResult = spawnSync([
                    "docker", "exec", this.containerName, "sh", "-c", cmd
                ]);

                const cmdOut = streamToTextSync(execResult.stdout);
                output += `\n$ ${cmd}\n${cmdOut}`;

                if (execResult.exitCode !== 0) {
                    const errText = streamToTextSync(execResult.stderr);
                    error += `\nError running '${cmd}': ${errText || "Unknown error"}`;
                    success = false;
                    status = DockerRunStatus.FAILURE;
                    break;
                }
            }
        } catch (e: any) {
            error += `\nException: ${e?.message || e}`;
            success = false;
            status = DockerRunStatus.FAILURE;
        }

        return {
            output,
            success,
            status,
            error: error || undefined
        };
    }

    /**
     * Stops and removes a Docker container.
     * @param containerName The name of the container to shut down.
     */
    async shutdownContainer(): Promise<void> {
				if (this.containerName)
				{
        	spawnSync(["docker", "rm", "-f", this.containerName]);
				}
				else {
						console.log(`Container name is null, not shutting down`);
				}
    }

	/**
	 * Starts a Docker container, runs commands, and returns all outputs
	 */	
}
