import { expect, test } from "bun:test";
import { spawnSync } from "bun"; // Added this line
import { DockerInstance, DockerRunStatus } from "../src/dockerInstance";


test.only("DockerInstance runs gemini to create hello world", async () => {
    const instance = new DockerInstance();
    const image = "ubuntu_with_node_and_git:latest";
    const commands = [
        // "apt-get update",
        "apt-get install -y curl",
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g @google/gemini-cli",
        "export GEMINI_API_KEY='YOUR_API_KEY'",
        "gemini -p \"write a hello world js script\" --yolo"
    ];
    let containerName: string | undefined;

    containerName = await instance.startContainer(image);
    const result = await instance.runCommands(commands, 3000);
    expect(result.status).toBe(DockerRunStatus.SUCCESS);

    // try {
    //     containerName = await instance.startContainer(image);
    //     const result = await instance.runCommands(commands, 3000);
    //     expect(result.status).toBe(DockerRunStatus.SUCCESS);
    // } 
    // catch(e: any) {
    //     console.error(`Error running commands: ${e?.message || e}`);
    // }
    // finally {
    //     if (containerName) {
    //         await instance.shutdownContainer();
    //     }
    // }
}, 3000000);