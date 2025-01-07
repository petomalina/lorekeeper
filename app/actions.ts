"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { agents, AgentName } from "./agents";
import fs from 'fs';

const modelName = "gemini-exp-1206";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: modelName });

export async function generateResponse(
  prompt: string,
  history: Message[],
  knowledge: Knowledge[],
  agent: AgentName,
) {
  const historySimple = history.map((h) => {
    return {
      role: h.user_id === null ? "assistant" : "user",
      content: h.content,
      timestamp: h.created_at
    };
  });

  const fullPrompt = `${agents[agent]}

${historySimple.length ? "# Chat History (Chronological):" : ""}
${historySimple.map((h) => `[${h.timestamp}] ${h.role}: ${h.content}`).join("\n")}

${knowledge.length ? "# Current Knowledge (Initially Empty):" : ""}
${knowledge.map((k) => `[${k.created_at}] ${k.knowledge}`).join("\n")}

${prompt ? "# User Input:" : ""}
${prompt ? `User: ${prompt}` : ""}`;

  const timestamp = new Date().toISOString();
  const fileName = `prompt_history/${timestamp}.txt`;
  const fileContent = fullPrompt;

  await fs.promises.writeFile(fileName, fileContent);

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error in server action:", error);
    throw new Error("Failed to generate response");
  }
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
export async function sendMessage(
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

  await db
    .prepare(
      "INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)"
    )
    .run(chatId, messageText, userId);

  await db
    .prepare(
      "UPDATE chats SET default_knowledge_base_id = ?, default_agent_name = ? WHERE id = ?"
    )
    .run(knowledgeBaseId, agent, chatId);

  const history = await loadChatMessages(chatId);
  // newly learned knowledge that will be passed into the response
  const learnedKnowledge = [];

  if (knowledgeBaseId && shouldExtractKnowledge) {
    const knowledge = await generateResponse(messageText, history, [], "extract");
    let parsedKnowledge = [];
    try {
      const cleanedKnowledge = knowledge.replace(/```json\n?|```/g, '');
      parsedKnowledge = JSON.parse(cleanedKnowledge);
      for (const knowledge of parsedKnowledge) {
        console.log("New knowledge extracted:", knowledge);
        await createKnowledge(knowledgeBaseId, knowledge.knowledge, knowledge.source);
      }
      learnedKnowledge.push(...parsedKnowledge);
    } catch (error) {
      console.error('Error parsing knowledge:', error);
    }
  }

  const knowledge = await getKnowledge(knowledgeBaseId);
  const response = await generateResponse(messageText, history, knowledge, agent);
  console.log("Response:", response);
  await db
    .prepare(
      "INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)"
    )
    .run(chatId, response, null);

  if (history.length % 5 === 0) {
    const summary = await generateResponse("", history, [], "summarize");
    await updateChatDescription(chatId, summary);
  }

  const chat = await getChat(chatId);
  // count the uncompressed messages
  const uncompressedMessages = await db.prepare("SELECT COUNT(*) AS count FROM messages WHERE chat_id = ? AND user_id IS NOT NULL AND id > ?").get(chatId, chat.last_uncompressed_message_id || 0) as { count: number };

  // Compress chat history if it's getting long (e.g., more than 30 messages)
  if (uncompressedMessages.count > 20) {
    const messagesToCompress = history.slice(0, -10); // Keep last 10 messages uncompressed
    const startTime = messagesToCompress[0].created_at;
    const endTime = messagesToCompress[messagesToCompress.length - 1].created_at;
    const lastCompressedMessageId = messagesToCompress[messagesToCompress.length - 1].id;
    
    // Generate a compressed summary using the compress agent
    const compressedSummary = await generateResponse(
      "",
      messagesToCompress,
      [],
      "compress"
    );

    await createCompressedChat(
      chatId,
      startTime,
      endTime,
      compressedSummary,
      messagesToCompress.length
    );

    // Update the last_uncompressed_message_id in chats
    await db
      .prepare(
        "UPDATE chats SET last_uncompressed_message_id = ? WHERE id = ?"
      )
      .run(lastCompressedMessageId, chatId);
  }

  return {
    response,
    learnedKnowledge,
    chatId,
  };
}

export interface Message {
  id: number;
  chat_id: number;
  content: string;
  user_id: number | null;
  created_at: string;
  updated_at: string;
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
    content: `[Compressed History (${compressed.messages_count} messages): ${compressed.summary}]`,
    user_id: null,
    created_at: compressed.start_time,
    updated_at: compressed.updated_at
  }));

  // Merge and sort all messages by timestamp
  return [...compressedMessages, ...activeMessages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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

export interface Knowledge {
  id: number;
  knowledge_base_id: number;
  knowledge: string;
  source: string;
  created_at: string;
  updated_at: string;
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
