'use client';

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useState } from "react";
import { generateResponse } from "./actions";

export default function Home() {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { text: inputValue, isUser: true }]);

    try {
      const text = await generateResponse(inputValue);
      
      // Add AI response
      setMessages(prev => [...prev, { text, isUser: false }]);
    } catch (error) {
      console.error('Error generating response:', error);
    }

    setInputValue('');
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 rounded-lg p-4 ${
              message.isUser
                ? 'ml-auto bg-blue-500 text-white'
                : 'mr-auto bg-gray-100 dark:bg-zinc-800'
            } max-w-[80%]`}
          >
            {message.text}
          </div>
        ))}
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
