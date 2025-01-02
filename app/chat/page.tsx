'use client';

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { sendMessage } from "../actions";
import Markdown from 'react-markdown';

export default function ChatPage() {
  const [messages, setMessages] = useState<Array<{ text: string; role: 'user' | 'assistant' }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('');
  const [knowledgeBases] = useState<Array<{ id: string; name: string }>>([]);

  // tracks the chat id, if 0, then it's a new chat
  const [chatId, setChatId] = useState(0);
  const userId = 1;

  const scrollToBottom = () => {
    const messages = document.querySelectorAll('[data-message]');
    const lastMessage = messages[messages.length - 1];
    lastMessage?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (text: string, role: 'user' | 'assistant') => {
    setMessages(prev => {
      const newMessages = [...prev, { text, role }];
      setTimeout(scrollToBottom, 0);
      return newMessages;
    });
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    addMessage(inputValue, 'user');
    setInputValue('');
    setIsThinking(true);
    generateAIResponse(inputValue);
  };

  const generateAIResponse = async (prompt: string) => {
    try {
      const { response, chatId: newChatId } = await sendMessage(chatId, userId, prompt);
      addMessage(response, 'assistant');
      setChatId(newChatId);
    } catch (error) {
      console.error('Error generating response:', error);
    } finally {
      setIsThinking(false);
    }
  };

  const handleNewChat = () => {
    setChatId(0);
    setMessages([]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full">
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
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex gap-4">
          <Select
            className="w-44"
            onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
            value={selectedKnowledgeBase}
          >
            <option value="">No knowledge base</option>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name}
              </option>
            ))}
          </Select>
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
            className="font-medium"
            onClick={handleSubmit}
          >
            Send
          </Button>
          <Button
            onClick={handleNewChat}
            plain
            className="p-2 border-0"
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
} 