'use client';

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useState } from "react";
import { generateResponse } from "./actions";
import Markdown from 'react-markdown';

export default function Home() {
  const [messages, setMessages] = useState<Array<{ text: string; role: 'user' | 'assistant' }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const scrollToBottom = () => {
    // Find all message elements and scroll to the last one
    const messages = document.querySelectorAll('[data-message]');
    const lastMessage = messages[messages.length - 1];
    lastMessage?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (text: string, role: 'user' | 'assistant') => {
    setMessages(prev => {
      const newMessages = [...prev, { text, role }];
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(scrollToBottom, 0);
      return newMessages;
    });
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    // Add user message
    addMessage(inputValue, 'user');
    setInputValue('');
    setIsThinking(true);

    // Start generating response in separate function
    generateAIResponse(inputValue);
  };

  const generateAIResponse = async (prompt: string) => {
    try {
      const text = await generateResponse(prompt);
      
      // Add AI response
      addMessage(text, 'assistant');
    } catch (error) {
      console.error('Error generating response:', error);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-4 relative">
        {messages.map((message, index) => (
          <div
            key={index}
            data-message
            className={`mb-4 rounded-lg p-4 ${
              message.role === 'user'
                ? 'ml-auto bg-blue-500 text-white'
                : 'mr-auto bg-gray-100 dark:bg-zinc-800'
            } max-w-[80%]`}
          >
            {message.role === 'user' ? (
              message.text
            ) : (
              <Markdown
                className="prose dark:prose-invert prose-zinc max-w-none"
              >
                {message.text}
              </Markdown>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 px-4 py-2 rounded-full shadow-lg text-sm text-zinc-500 italic z-10">
            thinking ...
          </div>
        )}
      </div>
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-4">
          <Input
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button 
            color="blue" 
            className="font-medium"
            onClick={handleSubmit}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
