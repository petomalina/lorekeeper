'use client';

import { Button } from "@/components/button";
import { useState } from "react";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  created: Date;
}

export default function KnowledgePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseDescription, setNewBaseDescription] = useState('');

  const handleCreateNew = () => {
    if (!newBaseName.trim()) return;

    const newKnowledgeBase: KnowledgeBase = {
      id: crypto.randomUUID(),
      name: newBaseName,
      description: newBaseDescription,
      created: new Date(),
    };

    setKnowledgeBases(prev => [...prev, newKnowledgeBase]);
    setNewBaseName('');
    setNewBaseDescription('');
    setIsCreating(false);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Knowledge Bases</h1>
        <Button
          color="blue"
          onClick={() => setIsCreating(true)}
          className="font-medium"
        >
          Create New
        </Button>
      </div>

      {isCreating && (
        <div className="mb-8 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Create New Knowledge Base</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={newBaseName}
                onChange={(e) => setNewBaseName(e.target.value)}
                className="w-full p-2 rounded-md border border-zinc-300 dark:border-zinc-700 
                          bg-white dark:bg-zinc-900"
                placeholder="Enter name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newBaseDescription}
                onChange={(e) => setNewBaseDescription(e.target.value)}
                className="w-full p-2 rounded-md border border-zinc-300 dark:border-zinc-700 
                          bg-white dark:bg-zinc-900"
                placeholder="Enter description..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button color="blue" onClick={handleCreateNew}>
                Create
              </Button>
              <Button
                color="zinc"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {knowledgeBases.map((kb) => (
          <div
            key={kb.id}
            className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg"
          >
            <h3 className="text-lg font-semibold mb-2">{kb.name}</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
              {kb.description}
            </p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">
                Created: {kb.created.toLocaleDateString()}
              </span>
              <Button color="blue" className="text-sm">
                View
              </Button>
            </div>
          </div>
        ))}
      </div>

      {knowledgeBases.length === 0 && !isCreating && (
        <div className="text-center py-12 text-zinc-500">
          No knowledge bases yet. Create one to get started!
        </div>
      )}
    </div>
  );
} 