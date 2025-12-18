
import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { PlanDashboard } from './components/PlanDashboard';
import { TourGuideInterface } from './components/TourGuideInterface';
import { UserProfileScreen } from './components/UserProfileScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AppPhase, TripPlan, UserPreferences, UserProfile, PastTrip, FavoritePlace, Activity, DigitalStamp, Message } from './types';

function App() {
  const [phase, setPhase] = useState<AppPhase>('AUTH');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // App Data State
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [collectedStamps, setCollectedStamps] = useState<DigitalStamp[]>([]);
  
  // Lifted Chat Messages for persistent context in the Planning Dashboard
  const [messages, setMessages] = useState<Message[]>([]);

  const [pastTrips, setPastTrips] = useState<PastTrip[]>([
    {
      id: 'trip_1',
      destination: 'Berlin, Germany',
      date: 'Jun 2024',
      duration: '4 Days',
      image: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?q=80&w=200&auto=format&fit=crop',
      rating: 5
    }
  ]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  // User Profile State (Now dynamic)
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "Demo User",
    email: "demo@gezginai.com",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
    memberSince: "March 2024",
    stats: {
      tripsPlanned: pastTrips.length + 1,
      placesVisited: 12,
      photosTaken: 48
    },
    stamps: [] 
  });

  // Sync collected stamps to profile
  useEffect(() => {
    setUserProfile(prev => ({ ...prev, stamps: collectedStamps }));
  }, [collectedStamps]);

  // Initial Mock Data (Chicago Pilot) - Enhanced with IMAGES and ID
  const initialMockPlan: TripPlan = {
    id: 'draft_12345',
    createdAt: Date.now(),
    destination: "Chicago, IL",
    dates: "",
    status: 'draft', 
    activities: [
      { 
        id: '1', 
        day: 1,
        time: "09:00", 
        activity: "Millennium Park & Cloud Gate", 
        location: "201 E Randolph St", 
        status: 'pending', 
        type: 'nature',
        lat: 41.8826,
        lng: -87.6226,
        imageUrl: "https://images.unsplash.com/photo-1596726857999-52d334584285?q=80&w=300&auto=format&fit=crop",
        priceLevel: 'Free',
        estimatedCost: 0
      },
      { 
        id: '2', 
        day: 1,
        time: "11:30", 
        activity: "Art Institute of Chicago", 
        location: "111 S Michigan Ave", 
        status: 'booked',
        bookingUrl: "https://sales.artic.edu/",
        type: 'culture',
        lat: 41.8796,
        lng: -87.6237,
        imageUrl: "https://images.unsplash.com/photo-1563297241-113331b2628a?q=80&w=300&auto=format&fit=crop",
        priceLevel: '$$',
        estimatedCost: 35
      },
      { 
        id: '3', 
        day: 1,
        time: "13:30", 
        activity: "Giordano's Pizza (Deep Dish)", 
        location: "223 W Jackson Blvd", 
        status: 'pending',
        bookingUrl: "https://giordanos.com/locations/jackson-blvd-downtown-central-loop/",
        type: 'food',
        lat: 41.8781,
        lng: -87.6330,
        imageUrl: "https://images.unsplash.com/photo-1595295333158-4742f28fbd85?q=80&w=300&auto=format&fit=crop",
        priceLevel: '$$',
        estimatedCost: 30
      },
      { 
        id: '4', 
        day: 1,
        time: "16:00", 
        activity: "Chicago Riverwalk Walk", 
        location: "Riverwalk", 
        status: 'pending', 
        type: 'nature',
        lat: 41.8885,
        lng: -87.6288,
        imageUrl: "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?q=80&w=300&auto=format&fit=crop",
        priceLevel: 'Free',
        estimatedCost: 0
      },
      { 
        id: '5', 
        day: 1,
        time: "19:00", 
        activity: "Live Music at Jazz Showcase", 
        location: "806 S Plymouth Ct", 
        status: 'booked',
        bookingUrl: "https://www.jazzshowcase.com/",
        type: 'nightlife',
        lat: 41.8710,
        lng: -87.6295,
        imageUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=300&auto=format&fit=crop",
        priceLevel: '$$',
        estimatedCost: 40
      },
      // Day 2 Example
      { 
        id: '6', 
        day: 2,
        time: "10:00", 
        activity: "Navy Pier & Centennial Wheel", 
        location: "600 E Grand Ave", 
        status: 'pending', 
        type: 'nature',
        lat: 41.8917, 
        lng: -87.6043,
        imageUrl: "https://images.unsplash.com/photo-1619468160877-e29f37f37803?q=80&w=300&auto=format&fit=crop",
        priceLevel: '$$',
        estimatedCost: 20
      },
      {
        id: '7',
        day: 2,
        time: "13:00",
        activity: "Lunch at Portillo's Hot Dogs",
        location: "100 W Ontario St",
        status: 'pending',
        type: 'food',
        lat: 41.8935,
        lng: -87.6301,
        imageUrl: "https://images.unsplash.com/photo-1621855293488-81d77b8f9e20?q=80&w=300&auto=format&fit=crop",
        priceLevel: '$',
        estimatedCost: 15
      },
      {
        id: '8',
        day: 2,
        time: "15:00",
        activity: "Magnificent Mile Shopping",
        location: "Michigan Ave",
        status: 'pending',
        type: 'shopping',
        lat: 41.8948,
        lng: -87.6242,
        imageUrl: "https://images.unsplash.com/photo-1669920677579-2d4e7498c366?q=80&w=300&auto=format&fit=crop",
        priceLevel: '$$$',
        estimatedCost: 150
      }
    ]
  };

  const [tripPlan, setTripPlan] = useState<TripPlan>(initialMockPlan);
  const [drafts, setDrafts] = useState<TripPlan[]>([initialMockPlan]);

  const handleToggleFavorite = (activity: Activity) => {
    setFavoritePlaces(prev => {
      const exists = prev.find(p => p.id === activity.id);
      if (exists) {
        return prev.filter(p => p.id !== activity.id);
      } else {
        return [...prev, {
          id: activity.id,
          name: activity.activity,
          location: activity.location || 'Unknown',
          addedAt: new Date(),
          tags: ['Plan']
        }];
      }
    });
  };

  const handleStampCollected = (activity: Activity) => {
     // Prevent duplicate stamps for same session
     const exists = collectedStamps.find(s => s.placeName === activity.activity);
     if(!exists) {
         setCollectedStamps(prev => [...prev, {
             id: Date.now().toString(),
             placeName: activity.activity,
             city: tripPlan.destination,
             date: new Date(),
             icon: activity.type === 'food' ? '🍔' : activity.type === 'culture' ? '🎭' : '📍'
         }]);
     }
  };

  const handleLogin = (userData?: { name: string; email: string }) => {
    if (userData) {
      setUserProfile(prev => ({
        ...prev,
        name: userData.name,
        email: userData.email,
        // Reset or keep stats? Keeping stats for mock continuity
      }));
    }
    setPhase('ONBOARDING');
  };

  const handleUpdateAvatar = (newUrl: string) => {
    setUserProfile(prev => ({ ...prev, avatarUrl: newUrl }));
    
    // Optional: Attempt to persist to localStorage if using mock user
    try {
        const STORAGE_KEY = 'gezgin_mock_user';
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            const userData = JSON.parse(storedData);
            userData.avatarUrl = newUrl; 
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        }
    } catch (e) {
        console.warn("Could not persist avatar to local storage (likely too large).");
    }
  };

  const handleOnboardingComplete = (prefs: UserPreferences) => {
    setPreferences(prefs);
    
    let generatedActivities: Activity[] = [];

    // Simple mock logic to differentiate plans based on input
    // In a real app, this would be an API call to Gemini
    if (prefs.city.toLowerCase().includes('chicago')) {
       generatedActivities = initialMockPlan.activities.map(a => ({...a}));
    } else {
       // Generic template for other cities
       generatedActivities = [
         { 
            id: '1', day: 1, time: "14:00", 
            activity: `Arrive in ${prefs.city}`, 
            location: "Airport / Central Station", 
            status: 'pending', type: 'general',
            imageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=300",
            priceLevel: 'Free', estimatedCost: 0
         },
         { 
            id: '2', day: 1, time: "16:00", 
            activity: "Hotel Check-in & Refresh", 
            location: "City Center", 
            status: 'pending', type: 'general',
            imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=300",
            priceLevel: '$$$', estimatedCost: 200
         },
         { 
            id: '3', day: 1, time: "19:00", 
            activity: "Welcome Dinner", 
            location: "Local Favorite", 
            status: 'pending', type: 'food',
            imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=300",
            priceLevel: '$$', estimatedCost: 60
         }
       ];
    }
    
    // DYNAMIC BUDGET ADJUSTMENT
    const budgetMultiplier = prefs.budget === 'luxury' ? 3 : prefs.budget === 'budget' ? 0.5 : 1;

    generatedActivities = generatedActivities.map(activity => {
      // Don't change free items
      if (!activity.estimatedCost || activity.estimatedCost === 0) return activity;

      const newCost = Math.round(activity.estimatedCost * budgetMultiplier);
      
      let newPriceLevel = activity.priceLevel;
      if (prefs.budget === 'luxury') {
         // Shift price levels up
         if (newPriceLevel === '$') newPriceLevel = '$$';
         else if (newPriceLevel === '$$') newPriceLevel = '$$$';
         else if (newPriceLevel === '$$$') newPriceLevel = '$$$$';
      } else if (prefs.budget === 'budget') {
         // Shift price levels down
         if (newPriceLevel === '$$$$') newPriceLevel = '$$$';
         else if (newPriceLevel === '$$$') newPriceLevel = '$$';
         else if (newPriceLevel === '$$') newPriceLevel = '$';
      }

      return {
        ...activity,
        estimatedCost: newCost,
        priceLevel: newPriceLevel
      };
    });

    const newPlan: TripPlan = {
      id: Date.now().toString(),
      createdAt: Date.now(),
      destination: prefs.city,
      dates: prefs.dates,
      status: 'draft',
      activities: generatedActivities
    };
    
    setTripPlan(newPlan);
    setDrafts(prev => [newPlan, ...prev]);

    // Initialize the chat messages with a personalized welcome for the new plan
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: `Hello! Your plan for ${prefs.city} is ready. Based on your preferences (${prefs.tempo} tempo), I've created a draft. You can ask to rearrange activities or request new suggestions.`,
        timestamp: new Date(),
      }
    ]);

    setTimeout(() => {
      setPhase('PLANNING');
    }, 1500);
  };

  const handleStartTour = (updatedPlan: TripPlan) => {
    // Ensure we save the final state before starting tour
    handleUpdatePlan(updatedPlan);
    setPhase('TOUR_GUIDE');
  };
  
  const handleNewPlan = () => {
    setPhase('ONBOARDING');
  };

  const handleUpdatePlan = (updatedPlan: TripPlan) => {
    setTripPlan(updatedPlan);
    setDrafts(prev => prev.map(d => d.id === updatedPlan.id ? updatedPlan : d));
  };

  const handleLoadDraft = (plan: TripPlan) => {
    setTripPlan(plan);
    setPhase('PLANNING');
  };

  const handleDeleteDraft = (planId: string) => {
    const updatedDrafts = drafts.filter(d => d.id !== planId);
    setDrafts(updatedDrafts);

    if (tripPlan.id === planId) {
      if (updatedDrafts.length > 0) {
        setTripPlan(updatedDrafts[0]);
      } else {
        setPhase('ONBOARDING');
      }
    }
  };

  return (
    <div className="font-sans min-h-screen transition-colors duration-300">
      {phase === 'AUTH' && <AuthScreen onLogin={handleLogin} />}
      
      {phase === 'ONBOARDING' && <OnboardingScreen onComplete={handleOnboardingComplete} />}
      
      {phase === 'PLANNING' && preferences && (
        <PlanDashboard 
          plan={tripPlan} 
          preferences={preferences} 
          userProfile={userProfile}
          onStartTour={handleStartTour} 
          onOpenProfile={() => setPhase('PROFILE')}
          onToggleFavorite={handleToggleFavorite}
          favoriteIds={favoritePlaces.map(f => f.id)}
          onNewPlan={handleNewPlan}
          drafts={drafts}
          onLoadDraft={handleLoadDraft}
          onUpdatePlan={handleUpdatePlan}
          onDeleteDraft={handleDeleteDraft}
          messages={messages}
          setMessages={setMessages}
        />
      )}
      
      {phase === 'PROFILE' && (
        <UserProfileScreen 
          user={userProfile}
          pastTrips={pastTrips}
          favoritePlaces={favoritePlaces}
          onBack={() => setPhase('PLANNING')}
          onOpenSettings={() => setPhase('SETTINGS')}
          onLogout={() => setPhase('AUTH')}
          onUpdateAvatar={handleUpdateAvatar}
        />
      )}

      {phase === 'SETTINGS' && (
        <SettingsScreen 
          onBack={() => setPhase('PROFILE')} 
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      )}
      
      {phase === 'TOUR_GUIDE' && (
        <TourGuideInterface 
          plan={tripPlan} 
          onExit={() => setPhase('PLANNING')}
          onStampCollected={handleStampCollected}
        />
      )}
    </div>
  );
}

export default App;
