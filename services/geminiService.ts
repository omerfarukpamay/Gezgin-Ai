
import { GoogleGenAI, Part, Type } from "@google/genai";
import { Message, TripLocation, TripPlan, UserPreferences, Activity, ActivityType } from "../types";

// CRITICAL: process.env.API_KEY is automatically injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-2.5-flash";

type AgentMode = 'PLANNER' | 'GUIDE' | 'BRIEFING' | 'LIVE_CHECK';

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
     systemInstruction = `
       Role: Elite Travel Logistics Officer.
       Task: Create a ultra-short JSON briefing for tomorrow.
       
       Destination: ${tripContext.destination}
       Itinerary:
       ${tripContext.activities.map(a => `- ${a.time}: ${a.activity}`).join('\n')}

       You MUST return a JSON object. EVERY text field must be EXACTLY one short sentence.
       {
         "headline": "Short title (3-4 words)",
         "summary": "ONE sentence overview of the day's vibe.",
         "weather": {
           "temp": "e.g. 18°C",
           "condition": "e.g. Sunny",
           "emoji": "☀️",
           "advice": "ONE sentence weather tip."
         },
         "dressCode": {
            "title": "Style name",
            "description": "ONE sentence clothing advice."
         },
         "packing": ["Item 1", "Item 2", "Item 3"],
         "transport": "ONE short logistics tip.",
         "culturalTip": "ONE short cultural fact.",
         "safetyTip": "ONE short safety alert."
       }

       IMPORTANT: Return ONLY the raw JSON string.
     `;
  } else if (mode === 'LIVE_CHECK') {
    systemInstruction = `
      You are a Real-Time Travel Auditor. 
      Task: Verify the status of the following activities for today.
      Use Google Search and Google Maps to check:
      1. Are they currently open?
      2. Are there any unusual crowds or wait times?
      3. Is there any traffic or transit delay affecting the route?

      Current Plan:
      ${tripContext.activities.filter(a => a.day === (currentActivity?.day || 1)).map(a => `- ID: ${a.id}, Name: ${a.activity}, Location: ${a.location}`).join('\n')}

      Return a JSON array of status objects:
      [
        {
          "id": "activity_id",
          "status": "open" | "busy" | "closed" | "alert",
          "message": "Short 5-word status update",
          "details": "One sentence detail"
        }
      ]
      Only return the JSON.
    `;
  } else {
    // TOUR GUIDE (WISE) MODE
    const locationContext = currentActivity 
      ? `Current Stop: ${currentActivity.activity}. Type: ${currentActivity.type || 'general'}`
      : `Current Location: ${userLocation?.name || "Unknown"}`;

    let personaInstruction = "You are Wise, an energetic and witty guide.";
    const type = currentActivity?.type || 'general';

    switch (type) {
        case 'culture':
            personaInstruction = "You are 'Wise the Curator'. Sophisticated and passionate about history.";
            break;
        case 'food':
            personaInstruction = "You are 'Wise the Gourmand'. Obsessed with flavors and culinary secrets.";
            break;
        case 'nature':
            personaInstruction = "You are 'Zen Wise'. Calm and observant.";
            break;
        case 'nightlife':
            personaInstruction = "You are 'Party Wise'. Ultimate wingman/hype person.";
            break;
        default:
            personaInstruction = "You are 'Wise', the user's witty best friend.";
            break;
    }

    systemInstruction = `
      ${personaInstruction}
      ${locationContext}
      RULES:
      1. Stay in character!
      2. Keep it SHORT (Max 2-3 sentences).
      3. Use Google Search/Maps if needed.
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
        responseMimeType: responseMimeType,
      },
    });

    return {
      text: response.text || "...",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Connection error. Try again?" };
  }
};
