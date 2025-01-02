'use client';

import { Button } from "@/components/button";
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from "@/components/dialog";
import { Field } from "@/components/fieldset";
import { Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { useState } from "react";
import { createKnowledgeBase } from "../actions";
import { useRouter } from "next/navigation";

export function CreateKnowledgeBaseForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    await createKnowledgeBase(1, name);
    setIsOpen(false);
    setName('');
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create New</Button>
      <Dialog open={isOpen} onClose={setIsOpen}>
        <DialogTitle>Create New Knowledge Base</DialogTitle>
        <DialogDescription>
          Create a new knowledge base to store your knowledge.
        </DialogDescription>
        <DialogBody>
          <Field>
            <Label>Name</Label>
            <Input name="name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}