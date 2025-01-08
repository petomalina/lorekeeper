'use client';

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { PlusIcon, Cog8ToothIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { loadChatMessages, sendUserMessage, Message, getKnowledgeBases, KnowledgeBase, getChat, Chat, Knowledge } from "../../actions";
import { AgentName } from "../../agents";
import Markdown from 'react-markdown';
import { useParams, useRouter } from "next/navigation";
import { Switch } from "@/components/switch";
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from "@/components/dropdown";

interface MessageWithKnowledge extends Message {
  learnedKnowledge?: Knowledge[];
}

export default function ChatPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<MessageWithKnowledge[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(0);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [agent, setAgent] = useState<AgentName>('base');
  const [chat, setChat] = useState<Chat | null>(null);
  const [shouldExtractKnowledge, setShouldExtractKnowledge] = useState(true);

  const { id } = useParams();
  const chatIdFromParams = id ? parseInt(id[0]) : 0;

  // tracks the chat id, if 0, then it's a new chat
  const [chatId, setChatId] = useState(chatIdFromParams);
  const userId = 1;

  useEffect(() => {
    if (chatId === 0) {
      return;
    }

    getChat(chatId).then((chat) => {
      setChat(chat);
      setSelectedKnowledgeBase(chat.default_knowledge_base_id);
      setAgent(chat.default_agent_name as AgentName);
    }).catch((error) => {
      console.error('Error loading chat:', error);
    });

    loadChatMessages(chatId).then((messages) => {
      if (messages.length === 0) {
        router.push('/chat');
      }
      setMessages(messages);
      setTimeout(scrollToBottom, 0);
    }).catch((error) => {
      console.error('Error loading chat messages:', error);
    });
  }, [chatId, router]);

  useEffect(() => {
    getKnowledgeBases(userId).then((knowledgeBases) => {
      setKnowledgeBases(knowledgeBases);
    });
  }, []);

  const scrollToBottom = () => {
    const messages = document.querySelectorAll('[data-message]');
    const lastMessage = messages[messages.length - 1];
    lastMessage?.scrollIntoView({ behavior: 'smooth' });
  };

  // Add effect to scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const addMessage = (msg: MessageWithKnowledge) => {
    setMessages(prev => {
      const newMessages = [...prev, msg];
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
      const { response, chatId: newChatId, learnedKnowledge } = await sendUserMessage(
        chatId,
        userId,
        selectedKnowledgeBase,
        text,
        agent,
        shouldExtractKnowledge
      );
      addMessage({
        id: 0,
        chat_id: newChatId,
        content: response,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        learnedKnowledge,
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
    <div className="flex flex-col h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-6rem)] relative">
      <div className="absolute top-0 left-0 z-10">
        <Dropdown>
          <DropdownButton plain>
            <Cog8ToothIcon className="h-6 w-6" />
          </DropdownButton>
          <DropdownMenu>
            <DropdownItem
              href="#"
              className="flex items-center justify-between gap-3"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setShouldExtractKnowledge(!shouldExtractKnowledge);
              }}
            >
              <Switch
                checked={shouldExtractKnowledge}
              />
              <span className="text-sm">Extract Knowledge</span>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {messages.map((message, index) => (
          <div
            key={index}
            data-message
            className={`mb-4 rounded-lg p-4 ${message.user_id === userId
              ? 'ml-auto bg-blue-600/75 text-white'
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
        <div className="flex gap-4 items-center w-full">
          <div className="w-60">
            <Select
              onChange={(e) => setSelectedKnowledgeBase(parseInt(e.target.value))}
              value={selectedKnowledgeBase || chat?.default_knowledge_base_id || 0}
            >
              <option value="0">No Knowledge Base</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-60">
            <Select
              onChange={(e) => setAgent(e.target.value as AgentName)}
              value={agent || chat?.default_agent_name || 'base'}
            >
              <option value="base">Base</option>
              <option value="businessCoach">Business Coach</option>
              <option value="infantMentor">Infant Mentor</option>
              <option value="securityMentor">Security Mentor</option>
              <option value="recruitingMentor">Recruiting Mentor</option>
              <option value="leadershipCoach">Leadership Coach</option>
            </Select>
          </div>
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