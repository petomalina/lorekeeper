'use client';

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { loadChatMessages, sendMessage, Message } from "../../actions";
import Markdown from 'react-markdown';
import { useParams } from "next/navigation";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('');
  const [knowledgeBases] = useState<Array<{ id: string; name: string }>>([]);

  const { id } = useParams();
  const chatIdFromParams = id ? parseInt(id[0]) : 0;

  // tracks the chat id, if 0, then it's a new chat
  const [chatId, setChatId] = useState(chatIdFromParams);
  const userId = 1;  

  useEffect(() => {
    if (chatId === 0) {
      return;
    }

    loadChatMessages(chatId).then((messages) => {
      setMessages(messages);
    });
  }, [chatId]);

  const scrollToBottom = () => {
    const messages = document.querySelectorAll('[data-message]');
    const lastMessage = messages[messages.length - 1];
    lastMessage?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => {
      const newMessages = [...prev, msg];
      setTimeout(scrollToBottom, 0);
      return newMessages;
    });
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    addMessage({
      id: 0,
      chat_id: chatId,
      content: inputValue,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setInputValue('');
    setIsThinking(true);
    generateAIResponse(inputValue);
  };

  const generateAIResponse = async (text: string) => {
    try {
      const { response, chatId: newChatId } = await sendMessage(chatId, userId, text);
      addMessage({
        id: 0,
        chat_id: newChatId,
        content: response,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setChatId(newChatId);
    } catch (error) {
      console.error('Error generating response:', error);
    } finally {
      setIsThinking(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-6rem)]">
      <div className="flex-1 overflow-y-auto relative">
        {messages.map((message, index) => (
          <div
            key={index}
            data-message
            className={`mb-4 rounded-lg p-4 ${
              message.user_id === userId
                ? 'ml-auto bg-blue-500 text-white'
                : 'mr-auto bg-gray-100 dark:bg-zinc-800'
            } max-w-[80%]`}
          >
            {message.user_id === userId ? (
              message.content
            ) : (
              <Markdown
                className="prose dark:prose-invert prose-zinc max-w-none"
              >
                {message.content}
              </Markdown>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-center">
            <div className="w-28 mb-4 text-center bg-white dark:bg-zinc-900 px-4 py-2 rounded-full shadow-lg text-sm text-zinc-500 italic z-10">
              thinking ...
            </div>
          </div>
        )}
      </div>
      <div className="border-t pt-4 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex gap-4">
          <Select
            className="w-48"
            onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
            value={selectedKnowledgeBase}
          >
            <option value="">No Knowledge Base</option>
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