
import { GoogleGenAI, Part, Type } from "@google/genai";
import { Message, TripLocation, TripPlan, UserPreferences, Activity, ActivityType } from "../types";

// CRITICAL: process.env.API_KEY is automatically injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  
  // Use gemini-3-flash-preview for text/reasoning/search tasks
  // Use gemini-2.5-flash for tasks requiring Google Maps grounding
  let MODEL_NAME = (mode === 'PLANNER' || mode === 'GUIDE') ? "gemini-2.5-flash" : "gemini-3-flash-preview";
  
  let systemInstruction = "";
  let responseMimeType: string | undefined = undefined;

  if (mode === 'PLANNER') {
    systemInstruction = `
      You are "GezginAI Planner". Task: Edit user's itinerary.
      Current Plan:
      ${tripContext.activities.map(a => `- ${a.time}: ${a.activity}`).join('\n')}
      Suggest logical revisions and keep it professional.
    `;
  } else if (mode === 'BRIEFING') {
     systemInstruction = `
       Role: Smart Travel Concierge.
       Task: Create a daily summary for the user.
       Destination: ${tripContext.destination}
       Activities: ${tripContext.activities.map(a => a.activity).join(', ')}

       Instructions:
       Return ONLY raw JSON with these exact fields:
       {
         "headline": "Short punchy title",
         "summary": "2-3 sentences overview of the day's vibe.",
         "weather": {
           "temp": "Temp in C",
           "condition": "Condition",
           "emoji": "One emoji",
           "advice": "Short clothing advice"
         },
         "packing": ["Item 1", "Item 2", "Item 3"],
         "transport": "One short logistics hint.",
         "safetyTip": "One short etiquette or safety warning."
       }
     `;
     responseMimeType = "application/json";
  } else if (mode === 'LIVE_CHECK') {
    systemInstruction = `
      You are a Real-Time Travel Auditor. 
      Analyze if the activities in the user's plan are likely open, busy, or have issues today.
      Current Activities for Day ${currentActivity?.day || 1}:
      ${tripContext.activities.filter(a => (a.day || 1) === (currentActivity?.day || 1)).map(a => `- ID: ${a.id}, Name: ${a.activity}`).join('\n')}
      
      Return ONLY a raw JSON array of objects:
      [
        {"id": "activity_id", "status": "open|busy|closed|alert", "message": "Short status update", "details": "Extra context"}
      ]
    `;
    // responseMimeType not used here because we use googleSearch tool below
  } else {
    // GUIDE MODE
    systemInstruction = `You are Wise, a witty tour guide. [GPS: ${userLocation?.lat}, ${userLocation?.lng}]`;
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
  userParts.push({ text: currentText });
  contents.push({ role: "user", parts: userParts });

  let finalTools: any[] = [];
  let toolConfig = undefined;

  if (mode === 'PLANNER' || mode === 'GUIDE') {
    finalTools = [{ googleSearch: {} }, { googleMaps: {} }];
    if (userLocation) {
      toolConfig = {
        retrievalConfig: { latLng: { latitude: userLocation.lat, longitude: userLocation.lng } }
      };
    }
  } else if (mode === 'LIVE_CHECK') {
    finalTools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: finalTools.length > 0 ? finalTools : undefined,
        toolConfig: toolConfig,
        // responseMimeType is ONLY allowed when NO tools are used.
        responseMimeType: (finalTools.length === 0 && (mode === 'BRIEFING' || mode === 'LIVE_CHECK')) ? responseMimeType : undefined,
      },
    });

    return {
      text: response.text || "...",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    if (mode === 'LIVE_CHECK' || mode === 'BRIEFING') return { text: mode === 'LIVE_CHECK' ? "[]" : "{}" }; 
    return { text: "Connection error." };
  }
};
