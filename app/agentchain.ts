import { AgentName, agents } from "./agents";

export interface Message {
  id?: number;
  chat_id?: number;
  content: string;
  // is_compressed is true if the message is a compressed message and thus should be displayed as a summary
  is_compressed?: boolean;
  // only for compressed messages
  messages_count?: number;
  // user_id is either the id of a real user or null if the message is an assistant message
  user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Knowledge {
  id: number;
  knowledge_base_id: number;
  knowledge: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ChainProgress {
  status: "pending" | "success" | "error";
  error?: string;
  tokenCount?: number;
  result?: object | string;
}

// AgentChainConfig is the configuration for an agent chain
export interface AgentChainConfig {
  // name of the chain for logging purposes
  name: string;

  // parts is the list of parts that make up the chain
  parts: AgentChainPart[];

  // progress is the current progress of each part of the chain.
  progress: Map<string, ChainProgress>;

  // generatePromptResponse is a function that the chain calls to generate a response to a prompt
  generatePromptResponse: (
    prompt: string
  ) => Promise<{ response: string; tokenCount: number }>;

  // updateDescription is a function that the chain calls when it needs to update the description of the chat
  updateDescription: (description: string) => Promise<void>;

  // updateLastUncompressedMessageId is a function that the chain calls when it needs to update the last uncompressed message id
  updateLastUncompressedMessageId: (lastUncompressedMessageId: number) => Promise<void>;

  // createMessage is a function that the chain calls when it needs to create a new message
  createMessage: (message: Message, type: "user" | "assistant" | "compressed") => Promise<void>;

  // getMessages is a function that the chain calls to get the messages in the chat
  getMessages: () => Promise<Message[]>;

  // getKnowledge is a function that the chain calls to get the knowledge about the chat conversation
  getKnowledge: () => Promise<Knowledge[]>;

  // createKnowledge is a function that the chain calls to create new knowledge
  createKnowledge: (knowledge: Knowledge) => Promise<void>;
}

// AgentChainPart is a part of an agent chain that is executed in order
export interface AgentChainPart {
  // name is the name of the part for logging purposes
  name: string;

  // precondition is a function that returns true if the part should be executed
  precondition?: (
    chain: AgentChainConfig,
    userMessage: string
  ) => Promise<boolean>;

  // execute is the function that the chain calls to execute the part, returns the number of tokens used
  execute: (
    chain: AgentChainConfig,
    userMessage: string
  ) => Promise<{ tokenCount: number; result: object | string }>;
}

// executeAgentChain executes the given chain and parts.
export const executeAgentChain = async (
  chain: AgentChainConfig,
  userMessage: string
) => {
  let tokenCount = 0;
  for (const part of chain.parts) {
    const progress = chain.progress.get(part.name);
    if (progress && progress.status === "success") {
      continue;
    }

    console.log(`Executing part ${part.name}`);

    try {
      if (part.precondition && !(await part.precondition(chain, userMessage))) {
        continue;
      }
      const result = await part.execute(chain, userMessage);
      tokenCount += result.tokenCount;
      console.log(`Part ${part.name}, result: ${result.result}`);
      chain.progress.set(part.name, {
        status: "success",
        result: result.result,
      });
    } catch (error) {
      console.error(`Error executing part ${part.name}: ${error}`);
      chain.progress.set(part.name, {
        status: "error",
        error: (error as Error).message,
      });
      break;
    }
  }
  return tokenCount;
};

export const extractChainPart = (name?: string): AgentChainPart => {
  return {
    name: name || "extract",
    execute: async (chain: AgentChainConfig, userMessage: string) => {
      const knowledge = await chain.getKnowledge();

      let prompt = `${agents["extract"]}\n\n`;
      prompt += `\n\n# Current Knowledge:\n${knowledge
        .map((k) => `[${k.created_at}] ${k.knowledge}`)
        .join("\n")}`;
      prompt += `\n\n# User Message:\n${userMessage}`;

      const newKnowledge = await chain.generatePromptResponse(prompt);
      const cleanedKnowledge = newKnowledge.response.replace(
        /```json\n?|```/g,
        ""
      );
      const learnedKnowledge = JSON.parse(cleanedKnowledge);
      for (const k of learnedKnowledge) {
        await chain.createKnowledge(k);
      }
      return { tokenCount: newKnowledge.tokenCount, result: learnedKnowledge };
    },
  };
};

export const summarizeChainPart = (name: string, at: number): AgentChainPart => {
  return {
    name: name || "summarize",
    precondition: async (chain: AgentChainConfig) => {
      const messages = await chain.getMessages();
      return messages.length === at;
    },
    execute: async (chain: AgentChainConfig, userMessage: string) => {
      const messages = await chain.getMessages();

      let prompt = `${agents["summarize"]}\n\n`;

      prompt += `\n\n# Chat History (Chronological):\n${messages
        .map(
          (m) =>
            `[${m.created_at}] ${m.user_id ? "User" : "Assistant"}: ${
              m.content
            }`
        )
        .join("\n")}`;
      prompt += `\n\n# User Message:\n${userMessage}`;

      const summary = await chain.generatePromptResponse(prompt);
      await chain.updateDescription(summary.response);

      return { tokenCount: summary.tokenCount, result: summary.response };
    },
  };
};

export const processMessageChainPart = (name: string, agent: AgentName): AgentChainPart => {
  return {
    name: name || `process_message_${agent}`,
    execute: async (chain: AgentChainConfig, userMessage: string) => {
      // create the user message
      await chain.createMessage({ content: userMessage }, "user");

      const [messages, knowledge] = await Promise.all([
        chain.getMessages(),
        chain.getKnowledge(),
      ]);

      let prompt = `${agents[agent]}\n\n`;
      if (messages.length > 0) {
        prompt += `# Chat History (Chronological, chats prefixed with 'Summarized' are compressed longer messages between user and the assistant):`;
        prompt += `\n${messages
          .map(
            (h) =>
              `[${h.created_at}] ${h.user_id ? "User" : "Assistant"}: ${
                h.content
              }`
          )
          .join("\n")}`;
      }
      if (knowledge.length > 0) {
        prompt += `\n\n# Current Knowledge:\n${knowledge
          .map((k) => `[${k.created_at}] ${k.knowledge}`)
          .join("\n")}`;
      }
      prompt += `\n\n# User Message:\n${userMessage}`;

      const response = await chain.generatePromptResponse(prompt);
      await chain.createMessage({ content: response.response }, "assistant");

      return { tokenCount: response.tokenCount, result: response.response };
    },
  };
};

export const compressChainPart = (
  name: string,
  atMessageCount: number,
  toCompressCount: number
): AgentChainPart => {
  return {
    name: name || "compress",
    precondition: async (chain: AgentChainConfig) => {
      const messages = await chain.getMessages();
      return messages.length === atMessageCount;
    },
    execute: async (chain: AgentChainConfig) => {
      const messages = await chain.getMessages();
      const messagesToCompress = messages.slice(0, toCompressCount);
      const startTime = messagesToCompress[0].created_at;
      const endTime =
        messagesToCompress[messagesToCompress.length - 1].created_at;

      // for an array of x messages, [1, 2, ... x], we take the first n messages
      // [1, 2, ... n] (index 0 to n-1), so the n-th index is the last uncompressed message
      const lastUncompressedMessageId = messages[messagesToCompress.length].id;

      let prompt = `${agents["compress"]}\n\n`;
      prompt += `\n\n# Chat History (Chronological, partial):`;
      prompt += `\n${messagesToCompress.map((h) => `[${h.created_at}] ${h.user_id ? "User" : "Assistant"}: ${h.content}`).join("\n")}`;

      const compressedSummary = await chain.generatePromptResponse(prompt);
      await chain.createMessage({ content: compressedSummary.response, created_at: startTime, updated_at: endTime, messages_count: messagesToCompress.length}, "compressed");

      return { tokenCount: compressedSummary.tokenCount, result: {startTime, endTime, lastUncompressedMessageId, message_count: messagesToCompress.length} };
    },
  };
};

