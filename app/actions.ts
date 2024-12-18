'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

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
