import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { genkit } from "genkit";

const ai = genkit({
  promptDir: "./app/prompts",
  plugins: [googleAI()],
  model: gemini20Flash,
});

const fourWordsPrompt = ai.prompt("fourWords");

export async function debugGenerate() {
  const response = await fourWordsPrompt({
    chat: `
[2025-01-02 16:10:16] User: Hi, I need help with Git branching
[2025-01-02 16:10:25] Assistant: Hello! I'd be happy to help you understand Git branching. What specific questions do you have?
[2025-01-02 16:10:45] User: How do I create a new branch?
[2025-01-02 16:10:55] Assistant: To create a new branch in Git, use the command 'git checkout -b branch-name'. This will create and switch to the new branch in one step.
    `,
  });
  console.log(response.text);
}
