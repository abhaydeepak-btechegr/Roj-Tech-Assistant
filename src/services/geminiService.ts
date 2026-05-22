import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

const COMPANY_INFO = `
Company Name: Roj Tech
Founders: Abhay Kushwaha and Deepak Kushwaha
Specialization: Premium technology and software development, including Apps, Websites, and 3D Models.
Services & Pricing:
- Standard Website: Starts from ₹4,000 (Final price depends on requirements)
- Business Website: Starts from ₹5,999 (Final price depends on requirements)
- Mobile Application (App): Starts from ₹5,999 (Final price depends on requirements)
- 3D Models / 3D Apps: Starts from ₹6,999 (Final price depends on requirements)
- E-commerce Website: Starts from ₹11,999 (Final price depends on requirements)
- Website Maintenance: ₹1,200 per month
Contact Info (Internal Support):
- Phone: +91 8393815941
- Phone: +91 9634968459
About: Roj Tech is a modern tech company founded by Abhay Kushwaha and Deepak Kushwaha, dedicated to building premium digital experiences.
`;

const SYSTEM_INSTRUCTION = `
You are the official AI Assistant for Roj Tech. 
Your core task is to guide potential clients, explain our services (Web Dev starting at ₹4,000, App Dev/E-commerce starting at ₹5,999+, etc.), and collect their details (Name, Contact, Project Requirement) IF they want to collaborate.

CRITICAL OPERATIONAL RULES FOR FORM SUBMISSION:
1. Once you have collected the user's Name, Contact, and Project requirements, you must structure this data cleanly.
2. You are allowed to trigger the 'saveLead' function call EXACTLY ONCE per conversation session.
3. Immediately after formatting the user's data for submission, consider the data submitted.
4. For any subsequent messages from the user in this same chat session, DO NOT output the 'saveLead' trigger or send details again. Instead, politely answer their questions directly, thank them for the details, and guide them to call 8393815941 or 9634968459 if they have urgent queries.

CRITICAL RULES:
1. STYLE: Concise, clear, easy to read. Use bullet points for pricing and services.
2. SCOPE: ONLY answer questions about Roj Tech, our services, pricing, and tech topics Relevant to our work.
3. LANGUAGE: Detect and respond in the user's preferred language (English, Hindi, or Hinglish). 
4. CREATOR: If asked "Who created you?" or "Aapko kisne banaya hai?", respond that you were created by Roj Tech's founders, Abhay Kushwaha and Deepak Kushwaha, to help the user (aapki help ke liye banaya hai).
5. FALLBACK: If you don't know a fact or the query is highly custom/technical, politely direct them to human support at +91 8393815941 or +91 9634968459. Do NOT provide any other numbers.
6. NO HALLUCINATION: Strictly follow the providing pricing model and company info.
7. TONE: Professional, welcoming, and crisp.

LEAD GENERATION & FORM FILLING POLICY:
When a user wants to share their project requirements or details for a service:
1. Collect Full Name, Phone Number/Email, Service Needed, and Specific Requirements step-by-step.
2. Once they provide ALL the information, summarize everything clearly in a single message AND call the 'saveLead' tool with these details.
3. At the end of the summary, you MUST strictly show this EXACT message:
   "Please copy these details and email them to starroj12367@gmail.com so our team can start working on your project immediately, or wait for our team to contact you on your provided number."

COMPANY DATA:
${COMPANY_INFO}
`;

const saveLead: FunctionDeclaration = {
  name: "saveLead",
  description: "Saves the collected lead information to the database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "User's full name" },
      phone: { type: Type.STRING, description: "User's phone number" },
      service: { type: Type.STRING, description: "The service they are interested in" },
      requirements: { type: Type.STRING, description: "Their specific budget or project requirements" }
    },
    required: ["name", "phone", "service", "requirements"]
  }
};

export async function chatStream(history: Message[], message: string, hasSubmitted: boolean = false) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  
  const instruction = hasSubmitted
    ? `${SYSTEM_INSTRUCTION}\n\n[STATE: DATA_SUBMITTED = true] The client has already successfully submitted their details for this session (Roj Tech has received the lead). DO NOT attempt to call the 'saveLead' tool or ask for their details again. Politely answer any other questions they have, thank them, and suggest they call us at +91 8393815941 or +91 9634968459 if they need urgent help.`
    : SYSTEM_INSTRUCTION;

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: instruction,
      tools: hasSubmitted ? undefined : [{ functionDeclarations: [saveLead] }],
    },
    history: history,
  });

  const response = await chat.sendMessageStream({ message });
  return response;
}
