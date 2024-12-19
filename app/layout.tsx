import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from 'next/link';
import Image from 'next/image';
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
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen flex-col">
          <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <div className="container mx-auto px-4">
              <div className="flex gap-4 py-3">
                <Link href="/" className="flex items-center gap-2">
                  <Image src="/logo.png" alt="Logo" className="h-6 w-6" width={24} height={24} />
                </Link>
                <Link href="/chat" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-500 font-medium">
                  Chat
                </Link>
                <Link href="/knowledge" className="text-zinc-600 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-500 font-medium">
                  Knowledge
                </Link>
              </div>
            </div>
          </div>
          <div className="flex-1">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
