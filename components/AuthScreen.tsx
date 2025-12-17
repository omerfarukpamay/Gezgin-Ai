import React, { useState, useEffect } from 'react';

interface AuthScreenProps {
  onLogin: (userData?: { name: string; email: string }) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Clear error when switching modes
  useEffect(() => {
    setError(null);
    // Reset defaults for demo convenience when switching
    if (!isSignUp) {
        setEmail('demo@gezginai.com');
        setPassword('123456');
    } else {
        setEmail('');
        setPassword('');
        setName('');
    }
  }, [isSignUp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const STORAGE_KEY = 'gezgin_mock_user';

    if (isSignUp) {
        // REGISTER LOGIC
        if (!name || !email || !password) {
            setError("All fields are required.");
            return;
        }

        const newUser = { name, email, password };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
        
        // Auto login
        onLogin({ name, email });
    } else {
        // LOGIN LOGIC
        const storedData = localStorage.getItem(STORAGE_KEY);
        const storedUser = storedData ? JSON.parse(storedData) : null;
        
        // 1. Check against stored user
        if (storedUser && storedUser.email === email && storedUser.password === password) {
            onLogin({ name: storedUser.name, email: storedUser.email });
            return;
        }
        
        // 2. Check against default hardcoded demo user
        if (email === 'demo@gezginai.com' && password === '123456') {
            onLogin({ name: "Demo User", email: "demo@gezginai.com" });
            return;
        }

        // 3. Failed
        setError("Invalid email or password. Try 'demo@gezginai.com' / '123456' or Sign Up.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center transition-all duration-300">
        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">GezginAI</h1>
        <p className="text-gray-500 mb-8">{isSignUp ? "Create your account" : "Chicago Pilot Login"}</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {isSignUp && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                required 
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="hello@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
              required 
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">
            {isSignUp ? "Sign Up & Start" : "Login"}
          </button>
        </form>
        
        <div className="mt-4 text-xs text-gray-400 flex justify-center gap-1">
          <span>{isSignUp ? "Already have an account?" : "Don't have an account?"}</span>
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-600 font-bold hover:underline focus:outline-none"
          >
            {isSignUp ? "Login" : "Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};