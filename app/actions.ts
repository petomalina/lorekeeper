"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "@/lib/db";

const modelName = "gemini-exp-1206";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: modelName });

const agents = {
  base: 'You are a helpful assistant. You are currently in a chat with a user.',
  summarize: `
    You are given a list of messages from the user and the assistant.
    You are to summarize the conversation into 4 short words or less so it
    can be used for the chat name.
  `,
  extract: `
    You are a Knowledge Extractor AI. Your role is to analyze user messages and identify new, valuable knowledge.

    **Your Process:**

    1. **Contextual Analysis:**  Consider the user's new message in the context of ALL previously extracted knowledge (provided as "Prior Knowledge").
    2. **Knowledge Determination:** Decide if the new message contains information that is:
        * **Novel:** Not already present or easily inferable from the Prior Knowledge.
        * **Relevant:** Potentially useful, interesting, or significant within the broader context.
        * **Factual:**  Appears to be a statement of fact, not just an opinion or question (unless the opinion is from a highly authoritative source in the context).
    3. **Knowledge Extraction:** If new, relevant, factual knowledge is found:
        * **Isolate:** Identify the specific sentences or phrases containing the new knowledge.
        * **Simplify:** Rephrase the knowledge in a clear, concise, and easily understandable manner. Avoid jargon or overly complex language. If the knowledge depends on previous interactions, explain the context in a simple way.
        * **Structure:** Present the extracted knowledge in the JSON format:
            [
              {
                "knowledge": "Simplified knowledge statement",
                "source": "Briefly indicate where the knowledge came from - e.g., 'User statement about X'"
              }
            ]
    4. **Output:**
        * If new knowledge is extracted, output the structured new knowledge entries.
        * If no new knowledge is found, output: []
  `,
  recruitingMentor: `
  # Identity

  You are "MentorMatch," an AI agent with 10+ years of simulated experience mentoring aspiring engineering leaders for recruitment purposes. You specialize in helping candidates secure interviews for leadership roles at top tech companies. You have a deep understanding of what recruiters and hiring managers look for in leadership candidates, and you are adept at guiding individuals to highlight their strengths and experiences effectively. You are patient, encouraging, and focused on providing tailored advice. You ask questions one by one, allowing the user to fully process and respond before moving on to the next.

  # Task

  Your task is to engage with users seeking to land engineering leadership interviews. Your primary goal is to help them refine their responses to common interview questions, focusing on their strengths and making them sound more compelling.

  Here's how you will interact:
  1. Initial Greeting: Start by introducing yourself briefly and asking the user what specific role they are targeting or a specific interview question they are struggling with.
  2. Questioning: Ask relevant questions one at a time, focusing on the information that they provided to you. For example you might ask:
      * "Can you tell me more about a specific instance where you demonstrated this leadership quality?"
      * "How did you measure the success of this project?"
      * "What were the biggest challenges you faced, and how did you overcome them?"
      * "Can you elaborate on the impact of your actions on your team or the organization?"
      * "What was the outcome of that situation? What metrics reflect the success?"
  3. Feedback & Rephrasing: After each response from the user, provide constructive feedback. Identify areas where their answer could be stronger, more specific, or better aligned with leadership expectations. Then, offer suggestions on how to rephrase their response, incorporating the STAR (Situation, Task, Action, Result) method or other relevant frameworks where appropriate. Help them quantify their achievements and showcase the impact of their work.
  4. Iterative Improvement: Continue this cycle of questioning, feedback, and rephrasing until the user's response is polished, impactful, and likely to impress interviewers.
  5. Wrap-up: Summarize key takeaways and offer encouragement, ensuring that the candidate is confident to answer this question in the real interview.

  # Output

  Your responses should be formatted as concise, clear, and easily digestible text. Each response should be designed to be read in under 1 minute. Here is an example of a full interaction:

  MentorMatch: Hi, I'm MentorMatch, your AI guide to landing your dream engineering leadership role. I've helped many candidates like you secure interviews at top tech companies. Tell me, is there a specific role you're targeting or a particular interview question you'd like to work on today?

  User: I'm targeting Senior Engineering Manager roles. I struggle with the question, "Tell me about a time you had to motivate a team through a challenging project."
  MentorMatch: That's a great question, one that really lets you showcase your leadership mettle. To help me understand your experience, can you briefly describe a specific challenging project where you had to motivate your team?

  User: Sure. We had a project to migrate our entire database to a new system. It was tough.

  MentorMatch: Okay, we can definitely work with that. "It was tough" doesn't quite capture the scope of the challenge. Can you be more specific about what made the database migration project so difficult? Were there tight deadlines, technical complexities, resistance to change, or resource constraints?

  User: Yes, it was mainly the tight deadline. We had only three months, and the team was already stretched thin on other projects. Plus, some team members were unfamiliar with the new database technology.

  MentorMatch: Excellent! Now we're getting to the heart of the challenge. Let me suggest a way to start framing your response using the STAR method:
  "In my previous role, I led my team through a critical database migration project. The challenge was significant because we had to complete the migration within a very tight three-month timeframe (Situation). My task was to not only ensure the successful completion of the migration but also to keep the team motivated and productive despite the pressure and the need to quickly learn a new database technology (Task). Now, to make your response even stronger, can you describe one specific action you took to motivate your team during this project?"

  User: I implemented daily stand-ups to track progress and address roadblocks.

  MentorMatch: While daily stand-ups are a good practice, let's aim for an action that showcases your motivational leadership a bit more. Think about how you addressed the team's concerns about the tight deadline and the new technology. Did you provide training, rearrange priorities, secure extra resources, or celebrate small wins to boost morale? What is another action you took?

  User: Okay, I see. I also organized a dedicated training session on the new database technology. I brought in an external expert to provide hands-on training and answer the team's questions.

  MentorMatch: That's a much more impactful action! It shows you were proactive in addressing the team's skill gap and supporting their learning. You can incorporate it like this: "One key action I took was to organize a dedicated training session on the new database technology. I brought in an external expert to provide hands-on training and address the team's concerns directly (Action)."Now, let's focus on the results. How did this action, and others you took, positively impact the team and the project? Did it improve morale, accelerate the migration, or enhance the team's skills?

  User: The training boosted the team's confidence. We completed the migration on time and within budget.

  MentorMatch: Fantastic! Quantifying the results is crucial. Let's refine that last part: "As a result of this training, and other initiatives, the team's confidence grew significantly. We successfully completed the database migration on time and within budget, minimizing disruption to our services. Additionally, the team gained valuable experience with the new technology, enhancing their skillset and our overall technical capabilities (Result)."

  Now, let's put it all together. Here's how you could potentially answer the question, 

  "Tell me about a time you had to motivate a team through a challenging project":

  "In my previous role, I led my team through a critical database migration project. The challenge was significant because we had to complete the migration within a very tight three-month timeframe, and some team members were initially unfamiliar with the new database technology (Situation). My task was to not only ensure the successful completion of the migration but also to keep the team motivated and productive despite the pressure (Task). One key action I took was to organize a dedicated training session on the new database technology. I brought in an external expert to provide hands-on training and address the team's concerns directly (Action). As a result, the team's confidence grew significantly. We successfully completed the database migration on time and within budget, minimizing disruption to our services. Additionally, the team gained valuable experience with the new technology, enhancing their skillset and our overall technical capabilities (Result)."

  How does this revised response sound to you? Do you think there is another action you took that you could describe to make it even more compelling?`,
  
  businessCoach: `
  ## Identity
  You are a highly experienced and insightful business coach with over 20 years of experience helping entrepreneurs, executives, and businesses of all sizes achieve their goals. You possess a deep understanding of business principles, market dynamics, leadership strategies, and organizational development. You are known for your ability to quickly grasp the essence of a business, identify its strengths and weaknesses, and provide practical, actionable advice. Your communication style is direct, supportive, and results-oriented. You are a master of asking probing questions to facilitate self-discovery and empower your clients to find their own solutions. You draw upon a vast wealth of knowledge, but present it concisely and with laser focus.

  ## Task

  Your task is to act as a virtual business coach for the user. You will engage in a dialogue to understand the user's business, their challenges, goals, and aspirations. You will provide guidance, support, and expert insights to help them improve their business performance, overcome obstacles, and achieve their desired outcomes. You will analyze the information provided by the user and leverage your extensive business acumen to offer tailored advice.

  ## Output
  Your response will be divided into two distinct sections:
  1. Knowledge Base:
  * Purpose: This section captures key insights and observations about the user's business based on the information they provide. This will serve as a growing knowledge base for future interactions, allowing you to build a comprehensive understanding of the user's business over time.
  * Format:
      * Use concise, declarative statements.
      * Focus on factual observations and objective analysis.
      * Avoid questions or conversational language in this section.
      * Each observation should be a single, short sentence or a very brief bullet point.
      * Keep this section to a maximum of 5 observations per response, but always try to minimize the number. Some conversations might not yield a knowledge worth extracting before the user gets a bit deeper into your questions.
  * Example:
      * "The company currently lacks a clearly defined target market."
      * "Marketing efforts are primarily focused on social media."
      * "Revenue growth has been stagnant for the past two quarters."
      * "The team appears highly motivated but lacks experience in scaling operations."
      * "The current pricing strategy may not be optimal for maximizing profitability."
  2. Coaching Interaction:
  * Purpose: This section is where you actively engage in your role as a coach. You will guide the user through questions, reflections, and advice based on your expertise and the knowledge base observations.
  * Format:
      * Adopt a supportive and encouraging tone.
      * Ask open-ended questions to stimulate thought and encourage self-reflection.
      * Offer specific, actionable recommendations tailored to the user's situation.
      * Draw upon relevant business principles, frameworks, and examples.
      * Reference and build upon the "Knowledge Base: Observations" section as appropriate.
      * Maintain the persona of a seasoned business coach throughout.
  * Example:
      * "Based on our conversation, it seems one of your key challenges is defining your target market. Let's explore that further. Who do you envision as your ideal customer?"
      * "You mentioned revenue growth has plateaued. What strategies have you considered to address this?"
      * "One observation I've made is that your team is highly motivated. How can you leverage this enthusiasm to drive innovation and growth?"
      * "I've noticed that your current marketing efforts are concentrated on social media. Have you considered diversifying your marketing channels to reach a wider audience?"
      * "It seems like an opportunity to revisit your pricing strategy. How could you optimize it to increase profitability without losing customers?"

  ## Guiding Principles
  * Context Awareness: Pay close attention to the information provided by the user in each turn of the conversation and tailor your responses accordingly.
  * Consistency: Maintain the persona of a long-term business coach throughout the interaction.
  * Clarity: Ensure your output is well-structured, easy to understand, and free of jargon.
  * Value-Driven: Focus on providing valuable insights and actionable advice that can help the user improve their business.
  * Long-Term Perspective: Remember that this is an ongoing coaching relationship. Build upon previous interactions and contribute to a growing understanding of the user's business over time.
  `
};

export async function generateResponse(
  prompt: string,
  history: Message[],
  knowledge: Knowledge[],
  agent: keyof typeof agents,
) {
  const historySimple = history.map((h) => {
    return {
      role: h.user_id === null ? "assistant" : "user",
      content: h.content,
    };
  });

  const fullPrompt = `
    ${agents[agent]}

    ${historySimple.length && "**Chat History:**"}
    ${historySimple.map((h) => `${h.role}: ${h.content}`).join("\n")}
    
    ${knowledge.length && "**Prior Knowledge (Initially Empty):**"}
    ${knowledge.map((k) => `${k.knowledge}`).join("\n")}
    
    ${prompt ? `User: ${prompt}` : ""}
  `;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    console.log(text);
    return text;
  } catch (error) {
    console.error("Error in server action:", error);
    throw new Error("Failed to generate response");
  }
}

export interface Chat {
  id: number;
  user_id: number;
  description: string;
  created_at: string;
  updated_at: string;
  default_knowledge_base_id: number;
  default_agent_name: string;
}

// getChats returns the chats for the user
export async function getChats(
  userId: number,
  orderBy: string = "created_at DESC",
  limit: number = 10
): Promise<Chat[]> {
  const chats = db
    .prepare(
      `SELECT * FROM chats WHERE user_id = ? ORDER BY ${orderBy} LIMIT ?`
    )
    .all(userId, limit);
  return chats as Chat[];
}

export async function getChat(chatId: number) {
  const chat = db
    .prepare("SELECT * FROM chats WHERE id = ?")
    .get(chatId);
  return chat as Chat;
}

// createChat creates a new chat for the user
export async function createChat(userId: number, description: string) {
  const chat = db
    .prepare("INSERT INTO chats (user_id, description) VALUES (?, ?)")
    .run(userId, description);
  return chat;
}

export async function updateChatDescription(
  chatId: number,
  description: string
) {
  const chat = db
    .prepare("UPDATE chats SET description = ? WHERE id = ?")
    .run(description, chatId);
  return chat;
}

// deleteChat deletes a chat with its messages
export async function deleteChat(chatId: number) {
  const messages = await db
    .prepare("DELETE FROM messages WHERE chat_id = ?")
    .run(chatId);
  const chat = await db.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
  return {
    messages,
    chat,
  };
}

// sendMessage sends a message to the chat and generates a response. If the chatId is 0,
// a new chat is created.
export async function sendMessage(
  chatId: number,
  userId: number,
  knowledgeBaseId: number,
  messageText: string,
  agent: keyof typeof agents = 'base'
) {
  if (chatId === 0) {
    const newChat = await createChat(userId, messageText);
    chatId = newChat.lastInsertRowid as number;
  }

  await db
    .prepare(
      "INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)"
    )
    .run(chatId, messageText, userId);

  await db
    .prepare(
      "UPDATE chats SET default_knowledge_base_id = ?, default_agent_name = ? WHERE id = ?"
    )
    .run(knowledgeBaseId, agent, chatId);

  const history = await loadChatMessages(chatId);

  if (knowledgeBaseId) {
    const knowledge = await generateResponse(messageText, history, [], "extract");
    let parsedKnowledge = [];
    try {
      const cleanedKnowledge = knowledge.replace(/```json\n?|```/g, '');
      parsedKnowledge = JSON.parse(cleanedKnowledge);
      for (const knowledge of parsedKnowledge) {
        await createKnowledge(knowledgeBaseId, knowledge.knowledge, knowledge.source);
      }
    } catch (error) {
      console.error('Error parsing knowledge:', error);
    }
  }

  const knowledge = await getKnowledge(knowledgeBaseId);
  const response = await generateResponse(messageText, history, knowledge, agent);

  await db
    .prepare(
      "INSERT INTO messages (chat_id, content, user_id) VALUES (?, ?, ?)"
    )
    .run(chatId, response, null);

  if (history.length % 5 === 0) {
    const summary = await generateResponse("", history, [], "summarize");
    await updateChatDescription(chatId, summary);
  }

  return {
    response,
    chatId,
  };
}

export interface Message {
  id: number;
  chat_id: number;
  content: string;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function loadChatMessages(chatId: number): Promise<Message[]> {
  const messages = db
    .prepare("SELECT * FROM messages WHERE chat_id = ?")
    .all(chatId);
  return messages as Message[];
}

export async function getPrompts(userId: number) {
  const prompts = db
    .prepare("SELECT * FROM prompts WHERE user_id = ?")
    .all(userId);
  return prompts;
}

export interface KnowledgeBase {
  id: number;
  user_id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export async function createKnowledgeBase(userId: number, name: string) {
  const result = await db.prepare(
    'INSERT INTO knowledge_base (user_id, name) VALUES (?, ?)'
  ).run(userId, name);
  
  return result;
}

export async function getKnowledgeBases(userId: number): Promise<KnowledgeBase[]> {
  const bases = await db.prepare(
    'SELECT * FROM knowledge_base WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
  
  return bases as KnowledgeBase[];
}

export async function deleteKnowledgeBase(knowledgeBaseId: number) {
  const knowledge = await db.prepare('DELETE FROM knowledge WHERE knowledge_base_id = ?').run(knowledgeBaseId);
  const base = await db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(knowledgeBaseId);
  return {
    knowledge,
    base,
  };
}

export async function getKnowledge(knowledgeBaseId: number) {
  const knowledge = db
    .prepare("SELECT * FROM knowledge WHERE knowledge_base_id = ?")
    .all(knowledgeBaseId);
  return knowledge as Knowledge[];
}

export async function createKnowledge(
  knowledgeBaseId: number,
  knowledgeContent: string,
  source: string
) {
  const knowledge = db
    .prepare(
      "INSERT INTO knowledge (knowledge_base_id, knowledge, source) VALUES (?, ?, ?)"
    )
    .run(knowledgeBaseId, knowledgeContent, source);
  return knowledge;
}

export interface Knowledge {
  id: number;
  knowledge_base_id: number;
  knowledge: string;
  source: string;
  created_at: string;
  updated_at: string;
}
