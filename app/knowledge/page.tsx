'use server';

import { getKnowledge, getKnowledgeBases, Knowledge, deleteKnowledgeAction, deleteKnowledgeBaseAction } from "../actions";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { CreateKnowledgeBaseForm } from "./create-form";
import { DescriptionDetails, DescriptionTerm } from "@/components/description-list";
import React from "react";
import { TrashIcon } from "@heroicons/react/24/outline";

export default async function KnowledgePage() {
  const userId = 1;
  const knowledgeBases = await getKnowledgeBases(userId);
  const knowledge: { [key: number]: Knowledge[] } = {};

  for (const knowledgeBase of knowledgeBases) {
    const dbKnowledge = await getKnowledge(knowledgeBase.id);
    knowledge[knowledgeBase.id] = dbKnowledge;
  }

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Knowledge Bases</h1>
        <CreateKnowledgeBaseForm />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {knowledgeBases.map((knowledgeBase) => (
          <Disclosure key={knowledgeBase.id} as="div" className="p-4 shadow rounded-lg bg-white/5">
            <DisclosureButton className="group flex w-full items-center justify-between">
              <span className="text-sm/6 font-medium text-white group-data-[hover]:text-white/80">
                {knowledgeBase.name}
              </span>
              <form action={deleteKnowledgeBaseAction}>
                <input type="hidden" name="knowledgeBaseId" value={knowledgeBase.id} />
                <button type="submit" className="p-2 text-red-500 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </form>
            </DisclosureButton>
            <DisclosurePanel className="mt-2 text-sm/5 text-white/50">
              <dl className="grid grid-cols-2 gap-2 text-left">
                {knowledge[knowledgeBase.id].map((knowledge) => (
                  <React.Fragment key={knowledge.id}>
                    <DescriptionTerm className="flex items-center">
                      <form action={deleteKnowledgeAction}>
                        <input type="hidden" name="knowledgeId" value={knowledge.id} />
                        <button type="submit" className="p-2 text-red-500 hover:text-red-400">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </form>
                      {knowledge.knowledge}
                    </DescriptionTerm>
                    <DescriptionDetails>{knowledge.source}</DescriptionDetails>

                  </React.Fragment>
                ))}
              </dl>
            </DisclosurePanel>
          </Disclosure>
        ))}
        {knowledgeBases.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No knowledge bases yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
} 