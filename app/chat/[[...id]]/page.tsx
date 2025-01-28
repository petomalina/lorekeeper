'use client';

import { Button } from "@/components/button";
import { Select } from "@/components/select";
import { Cog8ToothIcon, ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { loadChatMessages, sendUserMessage, getKnowledgeBases, KnowledgeBase, getChat, Chat } from "../../actions";
import { AgentName } from "../../agents";
import Markdown from 'react-markdown';
import { useParams, useRouter } from "next/navigation";
import { Switch } from "@/components/switch";
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from "@/components/dropdown";
import { Textarea } from "@/components/textarea";
import remarkGfm from 'remark-gfm';
import clsx from "clsx";
import { Message, Knowledge } from "@/app/agentchain";

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
  const [tokenCount, setTokenCount] = useState<number>(0);
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
      const { result, tokenCount, chatId: newChatId } = await sendUserMessage(
        chatId,
        userId,
        selectedKnowledgeBase,
        text,
        agent,
        shouldExtractKnowledge
      );
      setTokenCount(tokenCount);
      addMessage({
        id: 0,
        chat_id: newChatId,
        content: result as string,
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
            <DropdownItem className="flex items-center justify-between gap-3">
              <span className="flex justify-center">
                <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
              </span>
              <span className="text-sm">Number of tokens: {tokenCount}</span>
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
            <Markdown
              remarkPlugins={[remarkGfm]}
              className={clsx(message.user_id !== userId && "prose dark:prose-invert prose-zinc max-w-none")}
            >
              {message.content}
            </Markdown>
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
              <option value="execSpeak">Exec Speak</option>
              <option value="salesMentor">Sales Mentor</option>
              <option value="migMentor">Migration Mentor</option>
              <option value="jargonMentor">Jargon Mentor</option>
            </Select>
          </div>
          <Textarea
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="resize-none h-10 min-h-10 max-h-12"
          />
          <Button
            className="font-medium w-32"
            outline
            onClick={handleSubmit}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
} 