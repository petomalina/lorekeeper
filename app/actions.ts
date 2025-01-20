"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { agents, AgentName } from "./agents";
import fs from 'fs';
import { AgentChainConfig, compressChainPart, executeAgentChain, extractChainPart, Knowledge, Message, processMessageChainPart, summarizeChainPart } from "./agentchain";

const modelName = "gemini-exp-1206";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: modelName });
const jsonModel = genAI.getGenerativeModel({ model: modelName });
jsonModel.generationConfig.responseMimeType = "application/json";

export async function generatePromptResponse(prompt: string) {
  // save the prompt to a file for later inspection
  const timestamp = new Date().toISOString();
  const fileName = `prompt_history/${timestamp}.txt`;
  await fs.promises.writeFile(fileName, prompt);

  const [result, tokenCount] = await Promise.all([
    model.generateContent(prompt),
    model.countTokens(prompt)
  ]);

  return {
    response: result.response.text(),
    tokenCount: tokenCount.totalTokens,
  };
}

// generatePromptResponseJson generates a response from the model in JSON format
export async function generatePromptResponseJson(prompt: string) {
  const result = await jsonModel.generateContent(prompt);
  return result.response.text();
}

// promptTokenCount counts the tokens in a prompt
export async function promptTokenCount(prompt: string) {
  const result = await model.countTokens(prompt);
  return result;
}

export interface Chat {
  id: number;
  user_id: number;
  description: string;
  created_at: string;
  updated_at: string;
  default_knowledge_base_id: number;
  default_agent_name: string;
  last_uncompressed_message_id: number | null;
}

// getChats returns the chats for the user
export async function getChats(
  userId: number,
  orderBy: string = "created_at DESC",
  limit: number = 10
): Promise<Chat[]> {
  const chats = db
    .prepare(
      `SELECT * FROM chats WHERE user_id = ? ORDER BY ${orderBy} LIMIT ?`
    )
    .all(userId, limit);
  return chats as Chat[];
}

export async function getChat(chatId: number) {
  const chat = db
    .prepare("SELECT * FROM chats WHERE id = ?")
    .get(chatId);
  return chat as Chat;
}

// createChat creates a new chat for the user
export async function createChat(userId: number, description: string) {
  const chat = db
    .prepare("INSERT INTO chats (user_id, description) VALUES (?, ?)")
    .run(userId, description);
  return chat;
}

export async function updateChatDescription(
  chatId: number,
  description: string
) {
  const chat = db
    .prepare("UPDATE chats SET description = ? WHERE id = ?")
    .run(description, chatId);
  return chat;
}

export async function updateChatDefaults(chatId: number, knowledgeBaseId: number, agent: AgentName) {
  const chat = db
    .prepare("UPDATE chats SET default_knowledge_base_id = ?, default_agent_name = ? WHERE id = ?")
    .run(knowledgeBaseId, agent, chatId);
  return chat;
}

// deleteChat deletes a chat with its messages
export async function deleteChat(chatId: number) {
  const messages = await db
    .prepare("DELETE FROM messages WHERE chat_id = ?")
    .run(chatId);
  const chat = await db.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
  return {
    messages,
    chat,
  };
}

// sendMessage sends a message to the chat and generates a response. If the chatId is 0,
// a new chat is created.
export async function sendUserMessage(
  chatId: number,
  userId: number,
  knowledgeBaseId: number,
  messageText: string,
  agent: keyof typeof agents = 'base',
  shouldExtractKnowledge: boolean = true
) {
  if (chatId === 0) {
    const newChat = await createChat(userId, messageText);
    chatId = newChat.lastInsertRowid as number;
  }

  const chat = await getChat(chatId);
  // set the defaults if they're not already set
  if (chat.default_knowledge_base_id != knowledgeBaseId || chat.default_agent_name != agent) { 
    await updateChatDefaults(chatId, knowledgeBaseId, agent);
  }

  // construct the chain
  const parts = [];
  if (shouldExtractKnowledge) {
    parts.push(extractChainPart("extract"));
  }
  parts.push(summarizeChainPart("summarize", 6));
  parts.push(processMessageChainPart("process_message", agent));
  parts.push(compressChainPart("compress", 50, 20));

  const chain: AgentChainConfig = {
    name: "process_message",
    parts,
    progress: new Map(),
    getKnowledge: async () => {
      return await getKnowledge(knowledgeBaseId);
    },
    createKnowledge: async (knowledge: Knowledge) => {
      await createKnowledge(knowledgeBaseId, knowledge.knowledge, knowledge.source);
    },
    getMessages: async () => {
      const compressedHistory = await getCompressedChats(chatId);
      const history = await getMessagesFromId(chatId, chat.last_uncompressed_message_id || 0);
      const messages = [
        ...compressedHistory.map((h) => ({
          ...h,
          id: -h.id,
          user_id: null,
          chat_id: chatId,
          content: `[Compressed History (${h.messages_count} messages)]: ${h.summary}`,
          is_compressed: true,
        } as Message)),
        ...history,
      ];

      return messages;
    },
    generatePromptResponse: async (prompt: string) => {
      const result = await generatePromptResponse(prompt);
      return {
        response: result.response,
        tokenCount: result.tokenCount,
      };
    },
    updateDescription: async (description: string) => {
      await updateChatDescription(chatId, description);
    },
    updateLastUncompressedMessageId: async (lastUncompressedMessageId: number) => {
      await updateChatLastUncompressedMessageId(chatId, lastUncompressedMessageId);
    },
    createMessage: async (message: Message, type: "user" | "assistant" | "compressed") => {
      if (type === "compressed") {
        await createCompressedChat(chatId, message.created_at!, message.created_at!, message.content, message.messages_count!);
      } else {
        await createMessage(chatId, message.content, type === "user" ? userId : null);
      }
    },
  }

  const tokenCount = await executeAgentChain(chain, messageText);

  return {
    result: chain.progress.get(`process_message`)?.result as string,
    tokenCount,
    chatId,
  };
}

export async function getMessages(chatId: number, offset: number = 0, limit: number = 10) {
  const messages = db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(chatId, limit, offset);
  return messages as Message[];
}

// getMessagesFromId returns all messages from a given id and up to the end of the chat
export async function getMessagesFromId(chatId: number, id: number) {
  const messages = db.prepare("SELECT * FROM messages WHERE chat_id = ? AND id >= ? ORDER BY created_at DESC").all(chatId, id);
  return messages as Message[];
}

export async function createMessage(chatId: number, content: string, user_id: number | null) {
  const message = db.prepare("INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)").run(chatId, content, user_id);
  return message;
}

export async function loadChatMessages(chatId: number): Promise<Message[]> {
  const chat = await getChat(chatId);
  
  // Get all compressed chat ranges
  const compressedHistory = await getCompressedChats(chatId);
  
  // Get only uncompressed messages using the last_uncompressed_message_id
  const activeMessages = db
    .prepare(
      `SELECT * FROM messages 
       WHERE chat_id = ? 
       AND (id > ? OR ? IS NULL)
       ORDER BY created_at ASC`
    )
    .all(chatId, chat.last_uncompressed_message_id || 0, chat.last_uncompressed_message_id) as Message[];

  // Convert compressed chats to message format
  const compressedMessages: Message[] = compressedHistory.map(compressed => ({
    id: -compressed.id, // Use negative IDs to avoid conflicts with real messages
    chat_id: chatId,
    content: `[Compressed History (${compressed.messages_count} messages)]: ${compressed.summary}`,
    user_id: null,
    created_at: compressed.start_time,
    updated_at: compressed.start_time
  }));

  // Merge and sort all messages by timestamp
  return [...compressedMessages, ...activeMessages].sort(
    (a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
  );
}

export async function getPrompts(userId: number) {
  const prompts = db
    .prepare("SELECT * FROM prompts WHERE user_id = ?")
    .all(userId);
  return prompts;
}

export interface KnowledgeBase {
  id: number;
  user_id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export async function createKnowledgeBase(userId: number, name: string) {
  const result = await db.prepare(
    'INSERT INTO knowledge_base (user_id, name) VALUES (?, ?)'
  ).run(userId, name);
  
  return result;
}

export async function getKnowledgeBases(userId: number): Promise<KnowledgeBase[]> {
  const bases = await db.prepare(
    'SELECT * FROM knowledge_base WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
  
  return bases as KnowledgeBase[];
}

export async function deleteKnowledgeBase(knowledgeBaseId: number) {
  const knowledge = await db.prepare('DELETE FROM knowledge WHERE knowledge_base_id = ?').run(knowledgeBaseId);
  const base = await db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(knowledgeBaseId);
  return {
    knowledge,
    base,
  };
}

export async function deleteKnowledgeBaseAction(formData: FormData) {
  const knowledgeBaseId = Number(formData.get('knowledgeBaseId'));
  await deleteKnowledgeBase(knowledgeBaseId);
  revalidatePath('/knowledge');
}

export async function deleteKnowledgeAction(formData: FormData) {
  const knowledgeId = Number(formData.get('knowledgeId'));
  await deleteKnowledge(knowledgeId);
  revalidatePath('/knowledge');
}

export async function getKnowledge(knowledgeBaseId: number) {
  const knowledge = db
    .prepare("SELECT * FROM knowledge WHERE knowledge_base_id = ?")
    .all(knowledgeBaseId);
  return knowledge as Knowledge[];
}

export async function createKnowledge(
  knowledgeBaseId: number,
  knowledgeContent: string,
  source: string
) {
  return db
    .prepare(
      "INSERT INTO knowledge (knowledge_base_id, knowledge, source) VALUES (?, ?, ?)"
    )
    .run(knowledgeBaseId, knowledgeContent, source);
}

export async function deleteKnowledge(knowledgeId: number) {
  return db
    .prepare("DELETE FROM knowledge WHERE id = ?")
    .run(knowledgeId);
}

export interface CompressedChat {
  id: number;
  chat_id: number;
  start_time: string;
  end_time: string;
  summary: string;
  messages_count: number;
  created_at: string;
  updated_at: string;
}

export async function createCompressedChat(
  chatId: number,
  startTime: string,
  endTime: string,
  summary: string,
  messagesCount: number
) {
  return db
    .prepare(
      "INSERT INTO compressed_chats (chat_id, start_time, end_time, summary, messages_count) VALUES (?, ?, ?, ?, ?)"
    )
    .run(chatId, startTime, endTime, summary, messagesCount);
}

export async function getCompressedChats(chatId: number): Promise<CompressedChat[]> {
  const compressedChats = db
    .prepare("SELECT * FROM compressed_chats WHERE chat_id = ? ORDER BY start_time ASC")
    .all(chatId);
  return compressedChats as CompressedChat[];
}

export async function updateChatLastUncompressedMessageId(chatId: number, lastUncompressedMessageId: number) {
  return db
    .prepare("UPDATE chats SET last_uncompressed_message_id = ? WHERE id = ?")
    .run(lastUncompressedMessageId, chatId);
}