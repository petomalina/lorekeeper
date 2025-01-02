import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from 'next/image';
import { SidebarLayout } from "@/components/sidebar-layout";
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "@/components/navbar";
import { Sidebar, SidebarSection, SidebarItem, SidebarBody, SidebarLabel } from "@/components/sidebar";
import { ChatBubbleLeftRightIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Chat",
  description: "Chat with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
