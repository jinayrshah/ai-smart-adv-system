import { GoogleGenAI } from "@google/genai";
import agricultureKnowledge from '../data/agriculture_knowledge.json';
import { geminiKeyPool } from './geminiKeyPool';

const getGeminiApiKey = () => {
  const viteKey = import.meta.env?.VITE_GEMINI_API_KEY;
  const serverKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  return viteKey || serverKey || '';
};

let aiClient: GoogleGenAI | null = null;

const getGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
};

interface KnowledgeChunk {
  id: string;
  topic: string;
  content: string;
  keywords: string[];
  embedding?: number[];
}

let knowledgeBase: KnowledgeChunk[] = agricultureKnowledge;

const CACHE_KEY = 'agri_knowledge_embeddings';

// Load cached embeddings from localStorage
const loadCachedEmbeddings = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const cacheMap = JSON.parse(cached);
      knowledgeBase.forEach(chunk => {
        if (cacheMap[chunk.id] && cacheMap[chunk.id].content === chunk.content) {
          chunk.embedding = cacheMap[chunk.id].embedding;
        }
      });
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Failed to load cached embeddings:", error);
    }
  }
};

// Save embeddings to localStorage
const saveEmbeddingsToCache = () => {
  try {
    const cacheMap: Record<string, { content: string, embedding: number[] }> = {};
    knowledgeBase.forEach(chunk => {
      if (chunk.embedding) {
        cacheMap[chunk.id] = {
          content: chunk.content,
          embedding: chunk.embedding
        };
      }
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheMap));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Failed to save embeddings to cache:", error);
    }
  }
};

// Initialize embeddings for the knowledge base
export const initKnowledgeBase = async () => {
  console.log("Initializing knowledge base embeddings...");
  const ai = getGeminiClient();
  if (!ai) {
    console.warn("Gemini API key is not configured. Skipping knowledge base embeddings.");
    return;
  }
  
  // 1. Load from cache first
  loadCachedEmbeddings();
  
  const chunksToEmbed = knowledgeBase.filter(chunk => !chunk.embedding);
  if (chunksToEmbed.length === 0) {
    console.log("All chunks already have embeddings (cached or pre-defined).");
    return;
  }

  console.log(`Need to embed ${chunksToEmbed.length} new chunks.`);

  try {
    // Batch embedding request
    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: chunksToEmbed.map(chunk => chunk.content)
    });

    if (result?.embeddings) {
      result.embeddings.forEach((embedding, index) => {
        if (chunksToEmbed[index]) {
          chunksToEmbed[index].embedding = embedding.values;
        }
      });
      saveEmbeddingsToCache();
      console.log(`Successfully embedded ${chunksToEmbed.length} chunks.`);
    }
  } catch (error: any) {
    console.warn("Knowledge base batch embedding skipped (will use keyword matching fallback):", error?.message || error);
  }
};

// Cosine similarity
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Retrieve top-k chunks
const retrieveChunks = async (query: string, k: number = 2) => {
  const keys = geminiKeyPool.getOrderedKeys();
  const ai = keys.length > 0 ? geminiKeyPool.getClient(keys[0]) : null;
  if (!ai) {
    const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);
    return knowledgeBase
      .map(chunk => ({
        ...chunk,
        score: chunk.keywords.filter(keyword => queryTokens.includes(keyword.toLowerCase())).length
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  try {
    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: [query]
    });
    const queryEmbedding = result.embeddings?.[0]?.values;
    if (queryEmbedding) {
      const scoredChunks = knowledgeBase.map(chunk => ({
        ...chunk,
        score: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
      }));

      return scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    }
  } catch (error: any) {
    if (import.meta.env.DEV) {
      console.warn("Embedding retrieval fallback to keyword scoring:", error?.message || error);
    }
  }

  // Fast keyword matching fallback
  const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);
  return knowledgeBase
    .map(chunk => ({
      ...chunk,
      score: chunk.keywords.filter(keyword => queryTokens.includes(keyword.toLowerCase())).length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
};

export const generateChatResponse = async (query: string, history: any[] = []) => {
  // 1. Retrieve relevant context
  const relevantChunks = await retrieveChunks(query);
  const context = relevantChunks.map(c => c.content).join("\n\n");
  const keys = geminiKeyPool.getOrderedKeys();

  if (keys.length === 0) {
    if (context) {
      return `Based on our verified agricultural knowledge base:\n\n${context}`;
    }
    return "Our agricultural advisory service is currently unavailable. Please consult your local Krishi Vigyan Kendra (KVK).";
  }

  // 2. Detect intent and generate response
  const systemInstruction = `You are an expert, compassionate AI Agricultural Advisor for Indian farmers. 
Your goal is to provide comprehensive, practical, scientifically sound, and complete guidance.

Use the following verified context if relevant to the user's query:
${context}

When answering inquiries on crops, diseases, pests, fertilizers, irrigation, weather, markets, or government schemes:
- Provide detailed, actionable, step-by-step guidance.
- Include cultural prevention, organic/bio-control options, and chemical measures (with reminders to confirm exact commercial formulations with local KVK).
- If asked about government schemes, explain eligibility, benefits, application steps, and portals clearly.
- COMPLETENESS: Never cut answers short. Finish every sentence, bullet point, and section thoroughly with a helpful closing summary.`;

  const candidateModels = ["gemini-flash-lite-latest", "gemini-3-flash-preview"];
  const contents = [
    ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: query }] }
  ];

  try {
    return await geminiKeyPool.executeWithRotation(async (ai) => {
      for (const model of candidateModels) {
        try {
          const config: any = { systemInstruction, maxOutputTokens: 3000 };
          if (model.startsWith("gemini-2.5") && !model.includes("lite")) {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          const response = await ai.models.generateContent({
            model,
            contents,
            config
          });

          if (response.text) {
            return response.text;
          }
        } catch (error: any) {
          console.warn(`Chat generation error with model ${model}:`, error?.message || error);
          if (String(error?.message || error).includes("429")) {
            throw error;
          }
        }
      }

      if (context) {
        return `Based on our local agricultural knowledge base:\n\n${context}`;
      }

      return "I'm having trouble connecting to the AI advisory service right now. Please try again in a moment or consult your local Krishi Vigyan Kendra (KVK).";
    });
  } catch (poolErr) {
    console.warn("Key pool chat generation failed:", poolErr);
    if (context) {
      return `Based on our local agricultural knowledge base:\n\n${context}`;
    }
    return "I'm having trouble connecting to the AI advisory service right now. Please try again in a moment or consult your local Krishi Vigyan Kendra (KVK).";
  }
};
