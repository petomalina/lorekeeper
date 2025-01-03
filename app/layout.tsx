import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from 'next/image';
import { SidebarLayout } from "@/components/sidebar-layout";
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "@/components/navbar";
import { Sidebar, SidebarSection, SidebarItem, SidebarBody, SidebarLabel, SidebarHeading, SidebarHeader } from "@/components/sidebar";
import { ChatBubbleLeftRightIcon, ChevronDownIcon, DocumentTextIcon, TrashIcon } from "@heroicons/react/24/outline";
import { deleteChat, getChats, getKnowledgeBases } from "./actions";
import { Button } from "@/components/button";
import { revalidatePath } from "next/cache";
import { Dropdown, DropdownButton } from "@/components/dropdown";
import { Avatar } from "@/components/avatar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Chat",
  description: "Chat with AI",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = 1;
  const chats = await getChats(userId);
  const knowledgeBases = await getKnowledgeBases(userId);

  const deleteChatAction = async (formData: FormData) => {
    'use server';
    const chatId = formData.get('chatId');
    if (chatId) {
      await deleteChat(Number(chatId));
      revalidatePath('/chat');
    }
  };

  const navbar = (
    <Navbar>
      <NavbarSpacer />
      <NavbarSection>
        <NavbarItem href="/">
          <Image src="/logo.png" alt="Logo" className="h-6 w-6" width={24} height={24} />
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  );

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <Dropdown>
          <DropdownButton as={SidebarItem} className="lg:mb-2.5">
            <Avatar src="/logo4.png" />
            <SidebarLabel>Lorekeeper</SidebarLabel>
            <ChevronDownIcon />
          </DropdownButton>
        </Dropdown>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarItem href="/chat">
            <ChatBubbleLeftRightIcon data-slot="icon" />
            <SidebarLabel>Chat</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/knowledge">
            <DocumentTextIcon data-slot="icon" />
            <SidebarLabel>Knowledge</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
        <SidebarSection className="max-h-48 overflow-y-auto">
          <SidebarHeading className="sticky top-0 z-10">Chats</SidebarHeading>
          {chats.map((chat) => (
            <SidebarItem key={chat.id} href={`/chat/${chat.id}`} className="group">
              <span className="flex-1 text-xs">{chat.description}</span>
              <form action={deleteChatAction}>
                <input type="hidden" name="chatId" value={chat.id} />
                <Button
                  type="submit"
                  className="invisible group-hover:visible"
                  plain
                >
                  <TrashIcon className="h-4 w-4" data-slot="icon" />
                </Button>
              </form>
            </SidebarItem>
          ))}
        </SidebarSection>
        <SidebarSection className="max-h-48 overflow-y-auto">
          <SidebarHeading className="sticky top-0 z-10">Knowledge</SidebarHeading>
          {knowledgeBases.map((kb) => (
            <SidebarItem key={kb.id} href={`/knowledge`}>{kb.name}</SidebarItem>
          ))}
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );

  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        <SidebarLayout navbar={navbar} sidebar={sidebar}>
          {children}
        </SidebarLayout>
      </body>
    </html>
  );
}
