'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from '@/lib/db';

const modelName = 'gemini-exp-1206';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: modelName });

export async function generateResponse(prompt: string) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(text);
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

  const message = await db.prepare('INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)').run(chatId, messageText, userId);
  const response = await generateResponse(messageText);
  await db.prepare('INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)').run(chatId, response, null);

  return {
    message,
    response,
    chatId,
  }
}

export async function getPrompts(userId: number) {
  const prompts = db.prepare('SELECT * FROM prompts WHERE user_id = ?').all(userId);
  return prompts;
}