'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from '@/lib/db';

const modelName = 'gemini-exp-1206';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: modelName });

export async function generateResponse(prompt: string, history: Message[]) {
  const historySimple = history.map(h => {
    return {
      role: h.user_id === null ? 'assistant' : 'user',
      content: h.content,
    }
  });

  const fullPrompt = `
    You are a helpful assistant. You are currently in a chat with a user.

    ${historySimple.map(h => `${h.role}: ${h.content}`).join('\n')}
    User: ${prompt}
  `;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Error in server action:', error);
    throw new Error('Failed to generate response');
  }
}

// getChats returns the chats for the user
export async function getChats(userId: number) {
  const chats = db.prepare('SELECT * FROM chats WHERE user_id = ?').all(userId);
  return chats;
}

// createChat creates a new chat for the user
export async function createChat(userId: number, description: string) {
  const chat = db.prepare('INSERT INTO chats (user_id, description) VALUES (?, ?)').run(userId, description);
  return chat;
}

// sendMessage sends a message to the chat and generates a response. If the chatId is 0,
// a new chat is created.
export async function sendMessage(chatId: number, userId: number, messageText: string) {
  if (chatId === 0) {
    const newChat = await createChat(userId, messageText);
    chatId = newChat.lastInsertRowid as number;
  }

  await db.prepare('INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)').run(chatId, messageText, userId);
  
  const history = await loadChatMessages(chatId);
  const response = await generateResponse(messageText, history);
  await db.prepare('INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)').run(chatId, response, null);

  return {
    response,
    chatId,
  }
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
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ?').all(chatId);
  return messages as Message[];
}

export async function getPrompts(userId: number) {
  const prompts = db.prepare('SELECT * FROM prompts WHERE user_id = ?').all(userId);
  return prompts;
}