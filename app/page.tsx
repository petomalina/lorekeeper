import { Button } from "@/components/button";

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {/* Chat messages will go here */}
      </div>
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
          />
          <Button color="blue" className="font-medium">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
