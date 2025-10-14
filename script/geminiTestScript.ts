import { expect, test } from "bun:test";
import { spawnSync } from "bun"; // Added this line
import { DockerInstance, DockerRunStatus } from "../src/dockerInstance";


const instance = new DockerInstance();
const image = "ubuntu_with_node_and_git";
const commands = [
    "apt-get update",
    "apt-get install -y curl",
    "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
    "apt-get install -y nodejs",
    "npm install -g @google/gemini-cli",
    //"export GEMINI_API_KEY='AIzaSyA-v_UD5AHnDvHBZQc2BWf_UQQYebKOkeo'",
    "gemini -p \"write a hello world js script\" --yolo"
];
let containerName: string | undefined;

containerName = await instance.startContainer(image);
const result = await instance.runCommands(commands, 3000);
console.log(await result.error)
console.log(await result.output)

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
