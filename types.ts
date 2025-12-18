
export type AppPhase = 'AUTH' | 'ONBOARDING' | 'PLANNING' | 'TOUR_GUIDE' | 'PROFILE' | 'SETTINGS';

export interface UserPreferences {
  city: string;
  dates: string;
  duration: number; // New: Total number of days
  tempo: 'relaxed' | 'moderate' | 'fast';
  budget: 'budget' | 'standard' | 'luxury';
  transport: 'public' | 'rideshare' | 'private';
  interests: string[];
  // New detailed preferences
  cuisines: string[];
  explorationStyle: 'tourist' | 'hidden_gem' | 'balanced';
}

export interface PastTrip {
  id: string;
  destination: string;
  date: string;
  duration: string;
  image: string;
  rating: number; // 1-5
}

export interface FavoritePlace {
  id: string;
  name: string;
  location: string;
  tags?: string[];
  addedAt: Date;
}

export interface DigitalStamp {
  id: string;
  placeName: string;
  city: string;
  date: Date;
  icon: string; // Emoji icon
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  memberSince: string;
  stats: {
    tripsPlanned: number;
    placesVisited: number;
    photosTaken: number;
  };
  stamps: DigitalStamp[]; // New: Gamification
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  groundingMetadata?: GroundingMetadata;
  timestamp: Date;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        content: string;
      }[];
    }[];
  };
}

export interface TripLocation {
  lat: number;
  lng: number;
  name: string;
}

export type ActivityType = 'culture' | 'food' | 'nature' | 'nightlife' | 'shopping' | 'sport' | 'general';

export interface Activity {
  id: string;
  day?: number; // Added to support multi-day plans
  time: string;
  activity: string;
  location?: string;
  description?: string;
  status: 'pending' | 'booked' | 'completed';
  locked?: boolean;
  bookingUrl?: string;
  imageUrl?: string; // New: Visual Richness
  lat?: number;
  lng?: number;
  type?: ActivityType;
  // NEW: Cost & Price Level
  priceLevel?: string; // e.g. '$', '$$', 'Free'
  estimatedCost?: number; // e.g. 25
}

export interface TripPlan {
  id: string;        // Unique ID for drafts
  createdAt: number; // Timestamp for sorting
  destination: string;
  dates: string;
  duration: number;  // New: Total number of days in the plan
  status: 'draft' | 'confirmed';
  currentStopId?: string;
  activities: Activity[];
}

export interface PlanInsight {
  id: string;
  type: 'weather' | 'transport' | 'tip';
  message: string;
  actionText?: string;
}

export interface BriefingData {
  headline: string;
  summary: string; // Narrative overview of the day
  weather: {
    temp: string;
    condition: string;
    emoji: string;
    advice: string;
  };
  dressCode: {
    title: string;
    description: string;
  };
  packing: string[]; // List of items
  transport: string;
  culturalTip: string; // Etiquette or fun fact
  safetyTip: string; // What to watch out for
}