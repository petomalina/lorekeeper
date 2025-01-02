"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "@/lib/db";

const modelName = "gemini-exp-1206";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: modelName });

const systemPrompts = {
  "": "",
  base: `
    You are a helpful assistant. You are currently in a chat with a user.
  `,
  summarize: `
    You are given a list of messages from the user and the assistant.
    You are to summarize the conversation into 4 short words or less so it
    can be used for the chat name.
  `,
  extract: `
    You are a Knowledge Extractor AI. Your role is to analyze user messages and identify new, valuable knowledge.

    **Your Process:**

    1. **Contextual Analysis:**  Consider the user's new message in the context of ALL previously extracted knowledge (provided as "Prior Knowledge").
    2. **Knowledge Determination:** Decide if the new message contains information that is:
        * **Novel:** Not already present or easily inferable from the Prior Knowledge.
        * **Relevant:** Potentially useful, interesting, or significant within the broader context.
        * **Factual:**  Appears to be a statement of fact, not just an opinion or question (unless the opinion is from a highly authoritative source in the context).
    3. **Knowledge Extraction:** If new, relevant, factual knowledge is found:
        * **Isolate:** Identify the specific sentences or phrases containing the new knowledge.
        * **Simplify:** Rephrase the knowledge in a clear, concise, and easily understandable manner. Avoid jargon or overly complex language. If the knowledge depends on previous interactions, explain the context in a simple way.
        * **Structure:** Present the extracted knowledge in the JSON format:
            [
              {
                "knowledge": "Simplified knowledge statement",
                "source": "Briefly indicate where the knowledge came from - e.g., 'User statement about X'"
              }
            ]
    4. **Output:**
        * If new knowledge is extracted, output the structured new knowledge entries.
        * If no new knowledge is found, output: []
  `,
};

export async function generateResponse(
  prompt: string,
  history: Message[],
  knowledge: Knowledge[],
  systemPrompt: keyof typeof systemPrompts
) {
  const historySimple = history.map((h) => {
    return {
      role: h.user_id === null ? "assistant" : "user",
      content: h.content,
    };
  });

  const fullPrompt = `
    ${systemPrompts[systemPrompt]}

    ${historySimple.length && "**Chat History:**"}
    ${historySimple.map((h) => `${h.role}: ${h.content}`).join("\n")}
    
    ${knowledge.length && "**Prior Knowledge (Initially Empty):**"}
    ${knowledge.map((k) => `${k.knowledge}`).join("\n")}
    
    ${prompt ? `User: ${prompt}` : ""}
  `;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    console.log(text);
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
  messageText: string
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

  const history = await loadChatMessages(chatId);

  if (knowledgeBaseId) {
    const knowledge = await generateResponse(messageText, history, [], "extract");
    let parsedKnowledge = [];
    try {
      const cleanedKnowledge = knowledge.replace(/```json\n?|```/g, '');
      parsedKnowledge = JSON.parse(cleanedKnowledge);
      await createKnowledge(knowledgeBaseId, parsedKnowledge.knowledge, parsedKnowledge.source);
    } catch (error) {
      console.error('Error parsing knowledge:', error);
    }
  }

  const knowledge = await getKnowledge(knowledgeBaseId);
  const response = await generateResponse(messageText, history, knowledge, "base");

  await db
    .prepare(
      "INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)"
    )
    .run(chatId, response, null);

  if (history.length % 5 === 0) {
    const summary = await generateResponse("", history, [], "summarize");
    await updateChatDescription(chatId, summary);
  }

  return {
    response,
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
  const messages = db
    .prepare("SELECT * FROM messages WHERE chat_id = ?")
    .all(chatId);
  return messages as Message[];
}

export async function getPrompts(userId: number) {
  const prompts = db
    .prepare("SELECT * FROM prompts WHERE user_id = ?")
    .all(userId);
  return prompts;
}

export async function getKnowledgeBases(userId: number) {
  const knowledgeBases = db
    .prepare("SELECT * FROM knowledge_base WHERE user_id = ?")
    .all(userId);
  return knowledgeBases as KnowledgeBase[];
}

export async function getKnowledge(knowledgeBaseId: number) {
  const knowledge = db
    .prepare("SELECT * FROM knowledge WHERE knowledge_base_id = ?")
    .all(knowledgeBaseId);
  return knowledge as Knowledge[];
}

export async function createKnowledgeBase(userId: number, name: string) {
  const knowledgeBase = db
    .prepare("INSERT INTO knowledge_base (user_id, name) VALUES (?, ?)")
    .run(userId, name);
  return knowledgeBase;
}

export async function createKnowledge(
  knowledgeBaseId: number,
  knowledgeContent: string,
  source: string
) {
  const knowledge = db
    .prepare(
      "INSERT INTO knowledge (knowledge_base_id, knowledge, source) VALUES (?, ?, ?)"
    )
    .run(knowledgeBaseId, knowledgeContent, source);
  return knowledge;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface Knowledge {
  id: number;
  knowledge_base_id: number;
  knowledge: string;
  source: string;
  created_at: string;
  updated_at: string;
}
