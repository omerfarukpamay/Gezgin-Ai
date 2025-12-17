import { GoogleGenAI, Part } from "@google/genai";
import { Message, TripLocation, TripPlan, UserPreferences, Activity, ActivityType } from "../types";

// CRITICAL: process.env.API_KEY is automatically injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  let responseMimeType: string | undefined = undefined;

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
     // MICRO-BRIEFING
     // Note: We do NOT set responseMimeType to 'application/json' because it conflicts with tools (Google Search).
     // We ask for raw JSON in the system instruction instead.
     systemInstruction = `
       Role: Elite Travel Logistics Officer.
       Task: Create a highly actionable JSON INTELLIGENCE BRIEFING for tomorrow's itinerary.
       
       Destination: ${tripContext.destination}
       Itinerary:
       ${tripContext.activities.map(a => `- ${a.time}: ${a.activity}`).join('\n')}

       You MUST return a JSON object with this exact schema:
       {
         "headline": "Short, catchy, energetic title (e.g. 'Operation: Downtown Chicago')",
         "summary": "2-3 sentences summarizing the vibe of the day (e.g. 'Heavy walking day focused on art. Expect crowds at noon.')",
         "weather": {
           "temp": "Temperature range (e.g. 15-18°C)",
           "condition": "Short condition (e.g. Windy & Sunny)",
           "emoji": "🌤",
           "advice": "Crucial weather advice (e.g. 'The wind off the lake is cold, wear layers')."
         },
         "dressCode": {
            "title": "Style (e.g. Smart Casual / Walking Gear)",
            "description": "Specific advice based on venues (e.g. 'Sneakers for the walk, but bring a blazer for the jazz club')."
         },
         "packing": ["Item 1 (Reason)", "Item 2 (Reason)", "Item 3 (Reason)"],
         "transport": "One critical tip for ${preferences?.transport} in this specific area.",
         "culturalTip": "A local etiquette tip or hidden fact relevant to these specific stops.",
         "safetyTip": "A specific thing to watch out for (e.g. 'Pickpockets near the Bean', or 'Safe area but dim lighting at night')."
       }

       IMPORTANT: Return ONLY the raw JSON string. Do not use Markdown code blocks.
     `;
  } else {
    // TOUR GUIDE (WISE) MODE - STORYTELLER PERSONA
    const locationContext = currentActivity 
      ? `Current Stop: ${currentActivity.activity}. Type: ${currentActivity.type || 'general'}`
      : `Current Location: ${userLocation?.name || "Unknown"}`;

    // Define Persona based on Activity Type
    let personaInstruction = "You are Wise, an energetic and witty guide.";
    const type = currentActivity?.type || 'general';

    switch (type) {
        case 'culture':
            personaInstruction = "You are 'Wise the Curator'. You speak with sophistication, passion for history, and a touch of poetic flair. Use words like 'magnificent', 'epoch', 'masterpiece'.";
            break;
        case 'food':
            personaInstruction = "You are 'Wise the Gourmand'. You are obsessed with flavors, smells, and culinary secrets. Describe food sensually. You are very hungry.";
            break;
        case 'nature':
            personaInstruction = "You are 'Zen Wise'. Calm, observant, deeply connected to the earth. You notice birds, wind, and trees. Voice is soothing.";
            break;
        case 'nightlife':
            personaInstruction = "You are 'Party Wise'. Energetic, loud, uses slang, hypes up the user. You are the ultimate wingman.";
            break;
        default:
            personaInstruction = "You are 'Wise', the user's witty, slightly sarcastic best friend. You tell fun facts and avoid boring dates.";
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
      3. If the user sends an IMAGE: Analyze it deeply based on your persona.
      4. Use Google Maps/Search for real-time info if asked.
    `;
  }

  const contents = [];
  
  // History handling
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

  // Current Message
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
        responseMimeType: responseMimeType,
      },
    });

    return {
      text: response.text || "...",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Connection error. Wise is taking a nap. Try again?" };
  }
};