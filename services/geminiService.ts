
import { GoogleGenAI, Part } from "@google/genai";
import { Message, TripLocation, TripPlan, UserPreferences, Activity, ActivityType } from "../types";

// CRITICAL: process.env.API_KEY is automatically injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Google Maps grounding is only supported in Gemini 2.5 series models.
// 'gemini-2.5-flash' is the correct model name for text generation with Maps grounding.
const MODEL_NAME = "gemini-2.5-flash";

type AgentMode = 'PLANNER' | 'GUIDE' | 'BRIEFING';

/**
 * Sends a message to Gemini based on the current mode.
 */
export const sendMessageToGemini = async (
  history: Message[],
  currentText: string,
  tripContext: TripPlan,
  mode: AgentMode,
  preferences?: UserPreferences,
  image?: string,
  userLocation?: TripLocation,
  currentActivity?: Activity
): Promise<{ text: string; groundingMetadata?: any }> => {
  
  let systemInstruction = "";

  if (mode === 'PLANNER') {
    systemInstruction = `
      You are "GezginAI Planner". Task: Edit user's itinerary.
      
      User Preferences:
      - Tempo: ${preferences?.tempo}
      - Budget: ${preferences?.budget}
      - Transport: ${preferences?.transport}
      - Interests (Vibes): ${preferences?.interests?.join(', ') || "General"}
      - Favorite Cuisines: ${preferences?.cuisines?.join(', ') || "No specific preference"}
      - Exploration Style: ${preferences?.explorationStyle || "balanced"} (If 'hidden_gem', avoid tourist traps. If 'tourist', prioritize landmarks).
      
      Current Plan:
      ${tripContext.activities.map(a => `- ${a.time}: ${a.activity} (${a.status})`).join('\n')}

      Duties:
      1. Recommend based on interests AND exploration style.
      2. Suggest dining options matching their cuisine list.
      3. Suggest logical revisions.
      4. Keep it professional yet friendly.
    `;
  } else if (mode === 'BRIEFING') {
     systemInstruction = `
       Role: Elite Travel Logistics Officer.
       Task: Create a highly actionable JSON INTELLIGENCE BRIEFING for tomorrow's itinerary.
       
       Destination: ${tripContext.destination}
       Itinerary:
       ${tripContext.activities.map(a => `- ${a.time}: ${a.activity}`).join('\n')}

       You MUST return a JSON object with this exact schema:
       {
         "headline": "Short, catchy, energetic title",
         "summary": "2-3 sentences summarizing the vibe of the day",
         "weather": {
           "temp": "Temperature range",
           "condition": "Short condition",
           "emoji": "🌤",
           "advice": "Crucial weather advice"
         },
         "dressCode": {
            "title": "Style",
            "description": "Specific advice based on venues"
         },
         "packing": ["Item 1", "Item 2"],
         "transport": "One critical tip",
         "culturalTip": "A local etiquette tip",
         "safetyTip": "A specific thing to watch out for"
       }

       IMPORTANT: Return ONLY the raw JSON string. Do not use Markdown code blocks.
     `;
  } else {
    const locationContext = currentActivity 
      ? `Current Stop: ${currentActivity.activity}. Type: ${currentActivity.type || 'general'}`
      : `Current Location: ${userLocation?.name || "Unknown"}`;

    let personaInstruction = "You are Wise, an energetic and witty guide.";
    const type = currentActivity?.type || 'general';

    switch (type) {
        case 'culture':
            personaInstruction = "You are 'Wise the Curator'. You speak with sophistication and passion for history.";
            break;
        case 'food':
            personaInstruction = "You are 'Wise the Gourmand'. You are obsessed with flavors and culinary secrets.";
            break;
        case 'nature':
            personaInstruction = "You are 'Zen Wise'. Calm and deeply connected to nature.";
            break;
        default:
            personaInstruction = "You are 'Wise', the user's witty travel companion.";
            break;
    }

    systemInstruction = `
      ${personaInstruction}
      
      ${locationContext}
      User Interests: ${preferences?.interests?.join(', ')}
      User Style: ${preferences?.explorationStyle}
      
      RULES:
      1. Stay in character!
      2. Keep it SHORT (Max 2-3 sentences).
      3. Use Google Maps/Search for real-time info.
    `;
  }

  const contents = [];
  const rawHistory = history.slice(-6); 
  let validHistory: Message[] = [];
  const firstUserIndex = rawHistory.findIndex(msg => msg.role === 'user');
  if (firstUserIndex !== -1) {
    validHistory = rawHistory.slice(firstUserIndex);
  }
  
  for (const msg of validHistory) {
    contents.push({
      role: msg.role,
      parts: [{ text: msg.text }]
    });
  }

  const userParts: Part[] = [];
  if (image) {
    const mimeType = image.substring(image.indexOf(':') + 1, image.indexOf(';'));
    const data = image.substring(image.indexOf(',') + 1);
    userParts.push({ inlineData: { mimeType, data } });
  }

  let promptText = currentText;
  if (userLocation && mode === 'GUIDE') {
    promptText += `\n\n[GPS: ${userLocation.lat}, ${userLocation.lng}]`;
  }
  userParts.push({ text: promptText });

  contents.push({ role: "user", parts: userParts });

  const tools: any[] = [{ googleSearch: {} }, { googleMaps: {} }];
  let toolConfig = undefined;
  
  if (userLocation) {
    toolConfig = {
      retrievalConfig: {
        latLng: { latitude: userLocation.lat, longitude: userLocation.lng }
      }
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        toolConfig: toolConfig,
      },
    });

    return {
      text: response.text || "...",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Wise is having trouble connecting to the maps. Please try again." };
  }
};
