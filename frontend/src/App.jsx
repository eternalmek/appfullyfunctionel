import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  BarChart2, 
  Layers, 
  Search, 
  Bell, 
  MoreHorizontal, 
  Heart, 
  MessageSquare, 
  Share2, 
  Image as ImageIcon, 
  Play, 
  Facebook, 
  Instagram, 
  Shield, 
  Lock, 
  UploadCloud, 
  Grid, 
  List, 
  Sparkles, 
  Mic, 
  Send, 
  User, 
  LogOut, 
  Loader2, 
  Mail, 
  ArrowRight
} from 'lucide-react';
import { authAPI, memoriesAPI, connectionsAPI, mirrorAPI } from './lib/api';

// Default avatar as data URI (simple user icon)
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236b7280'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

// --- MOCK DATA (used when API is unavailable) ---
const DEFAULT_USER = {
  name: "Alex",
  handle: "@alex_eternal",
  avatar: DEFAULT_AVATAR,
};

const INITIAL_MEMORIES = [
  {
    id: 1, type: 'video', user: DEFAULT_USER, date: '2 hours ago', location: 'Kyoto, Japan',
    media: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop',
    caption: 'The lights here never sleep. 🎌 #TravelDiaries', likes: 234, comments: 12
  },
  {
    id: 2, type: 'audio', user: DEFAULT_USER, date: 'Yesterday', location: 'Voice Note', duration: '0:45',
    caption: 'Midnight thoughts on the new project...', likes: 45, comments: 2
  },
  {
    id: 3, type: 'photo', user: DEFAULT_USER, date: 'Nov 14, 2023', location: 'Brooklyn, NY',
    media: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=800&fit=crop',
    caption: 'Sunday brunch crew. ☕️', likes: 892, comments: 45
  }
];

// --- CUSTOM ICONS ---
// Simple SVG for TikTok since it's not in Lucide
const TikTokIcon = ({ size = 20, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z"/>
  </svg>
);

// --- AUTH COMPONENT ---
const AuthPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });

  const handleLogin = async (provider) => {
    setIsLoading(true);
    setError('');
    
    if (provider === 'email') {
      try {
        let result;
        if (isLogin) {
          result = await authAPI.login(formData.email, formData.password);
        } else {
          result = await authAPI.register(formData.email, formData.password, formData.name);
        }
        
        if (result.error) {
          setError(result.error === 'invalid_credentials' ? 'Invalid email or password' : result.error);
          setIsLoading(false);
          return;
        }
        
        if (result.accessToken) {
          localStorage.setItem('accessToken', result.accessToken);
          localStorage.setItem('refreshToken', result.refreshToken);
          localStorage.setItem('user', JSON.stringify(result.user));
          onLogin(result.user);
        }
      } catch {
        // Fallback for demo mode when backend is unavailable
        console.warn('API unavailable, using demo mode');
        localStorage.setItem('eternal_session', formData.email);
        onLogin({ ...DEFAULT_USER, email: formData.email });
      }
    } else {
      // Social login simulation for demo
      setTimeout(() => {
        localStorage.setItem('eternal_session', `User via ${provider}`);
        onLogin({ ...DEFAULT_USER, name: `User via ${provider}` });
      }, 1500);
    }
    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!formData.email || !formData.password) return;
    handleLogin('email');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/10 blur-[100px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <Sparkles className="w-12 h-12 mx-auto text-cyan-400 mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            EternalMe
          </h1>
          <p className="text-gray-400 mt-2">
            {isLogin ? "Welcome back to your digital soul." : "Begin your legacy today."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Social Login Buttons - INSTAGRAM, FACEBOOK, TIKTOK ONLY */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <button 
            onClick={() => handleLogin('Instagram')}
            className="flex items-center justify-center py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all hover:scale-105 group"
            title="Continue with Instagram"
          >
            <Instagram size={22} className="text-pink-500 group-hover:text-pink-400 transition-colors" />
          </button>
          
          <button 
            onClick={() => handleLogin('Facebook')}
            className="flex items-center justify-center py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all hover:scale-105 group"
            title="Continue with Facebook"
          >
            <Facebook size={22} className="text-blue-600 group-hover:text-blue-500 transition-colors" />
          </button>

          <button 
            onClick={() => handleLogin('TikTok')}
            className="flex items-center justify-center py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all hover:scale-105 group"
            title="Continue with TikTok"
          >
            <TikTokIcon size={22} className="text-white group-hover:text-cyan-400 transition-colors" />
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-black px-2 text-gray-500">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-gray-500" size={18} />
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-600"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}
          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-gray-500" size={18} />
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-600"
                placeholder="Email address"
              />
            </div>
          </div>
          
          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-500" size={18} />
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-600"
                placeholder="Password"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : (
              <>
                {isLogin ? 'Enter The Core' : 'Create Account'}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-white hover:text-cyan-400 font-medium transition-colors"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const Navbar = ({ activeTab, setActiveTab, onLogout, currentUser }) => {
  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed' },
    { id: 'mirror', icon: Sparkles, label: 'Mirror' },
    { id: 'insights', icon: BarChart2, label: 'Insights' },
    { id: 'core', icon: Layers, label: 'Core' },
  ];

  return (
    <>
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`p-2 rounded-xl transition-all ${activeTab === item.id ? 'text-cyan-400' : 'text-gray-500'}`}
          >
            <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          </button>
        ))}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 h-screen bg-black border-r border-white/10 fixed left-0 top-0 p-6 z-50">
        <h1 
          className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-10 tracking-tighter cursor-pointer" 
          onClick={() => setActiveTab('feed')}
        >
          EternalMe
        </h1>
        <div className="space-y-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-4 px-4 py-3 rounded-2xl w-full transition-all ${
                activeTab === item.id 
                  ? 'bg-white/10 text-white font-medium shadow-lg shadow-purple-500/10' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={22} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex items-center space-x-3 mb-4">
            <img src={currentUser.avatar || DEFAULT_USER.avatar} alt="Profile" className="w-10 h-10 rounded-full border border-white/20" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{currentUser.name || DEFAULT_USER.name}</p>
              <p className="text-xs text-gray-500 truncate">{currentUser.handle || `@${currentUser.name?.toLowerCase().replace(/\s/g, '_') || 'user'}`}</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center space-x-3 px-2 text-gray-500 hover:text-red-400 text-sm transition-colors w-full">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

const Feed = ({ currentUser }) => {
  const [viewMode, setViewMode] = useState('list');
  const [memories, setMemories] = useState(INITIAL_MEMORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const result = await memoriesAPI.list();
        if (result.memories && result.memories.length > 0) {
          const formattedMemories = result.memories.map(m => ({
            id: m.id,
            type: m.type,
            user: m.user ? {
              name: m.user.name,
              handle: m.user.handle || `@${m.user.name?.toLowerCase().replace(/\s/g, '_')}`,
              avatar: m.user.avatar || DEFAULT_USER.avatar
            } : currentUser,
            date: m.dateText || new Date(m.createdAt).toLocaleDateString(),
            location: m.location || '',
            media: m.mediaUrl,
            caption: m.caption,
            likes: m.likesCount || 0,
            comments: m.commentsCount || 0,
            duration: m.duration
          }));
          setMemories(formattedMemories);
        }
      } catch {
        console.warn('Using mock data - API unavailable');
      }
      setLoading(false);
    };
    fetchMemories();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto pb-24 md:pb-0 pt-20 md:pt-10 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-cyan-400" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-0 pt-20 md:pt-10 px-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Your Timeline</h2>
          <p className="text-gray-500 text-sm">Synchronized from connected sources</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-lg">
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500'}`}><List size={18} /></button>
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500'}`}><Grid size={18} /></button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-1' : 'space-y-8'}>
        {memories.map((post) => (
          viewMode === 'grid' ? (
            <div key={post.id} className="aspect-square bg-gray-900 relative group cursor-pointer overflow-hidden">
              {post.type === 'audio' ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900 to-black"><Mic className="text-white/50" /></div>
              ) : (
                <img src={post.media} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              )}
              {post.type === 'video' && <Play className="absolute top-2 right-2 text-white drop-shadow-lg" size={16} fill="white" />}
            </div>
          ) : (
            <div key={post.id} className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[2px]">
                    <img src={post.user.avatar} alt="" className="w-full h-full rounded-full border border-black" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{post.user.name}</p>
                    <p className="text-gray-500 text-xs">{post.location} • {post.date}</p>
                  </div>
                </div>
                <button className="text-gray-500 hover:text-white"><MoreHorizontal size={20} /></button>
              </div>

              <div className="w-full bg-black/50">
                {post.type === 'photo' && <img src={post.media} alt="" className="w-full max-h-[500px] object-cover" />}
                {post.type === 'video' && (
                  <div className="relative w-full h-[400px]">
                    <img src={post.media} alt="" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"><Play size={32} fill="white" className="text-white ml-1" /></div></div>
                  </div>
                )}
                {post.type === 'audio' && (
                  <div className="h-48 flex flex-col items-center justify-center bg-gradient-to-r from-gray-900 to-black relative overflow-hidden">
                    <Play size={40} className="text-white z-10" />
                    <span className="text-gray-400 text-xs mt-4 z-10">{post.duration}</span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center space-x-4 mb-3">
                  <button className="text-white hover:text-red-500 transition-colors"><Heart size={24} /></button>
                  <button className="text-white hover:text-cyan-500 transition-colors"><MessageSquare size={24} /></button>
                  <button className="text-white hover:text-green-500 transition-colors"><Share2 size={24} /></button>
                </div>
                <p className="text-white text-sm"><span className="font-bold">{post.user.name}</span> {post.caption}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

const Mirror = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ id: 1, text: "Hi! I was looking through your memories. How can I help you today?", sender: 'ai' }]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if(!input.trim() || isLoading) return;
    const userMsg = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    const messageText = input;
    setInput('');
    setIsLoading(true);

    try {
      const result = await mirrorAPI.sendMessage(messageText);
      if (result.reply) {
        setMessages(prev => [...prev, { id: Date.now() + 1, text: result.reply, sender: 'ai' }]);
      } else {
        throw new Error('No reply');
      }
    } catch {
      // Fallback response for demo mode
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: Date.now() + 1, 
          text: "I found some related memories. Would you like me to create a montage or list them for you?", 
          sender: 'ai' 
        }]);
      }, 500);
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto h-screen pt-20 pb-24 md:py-10 flex flex-col px-4 animate-in fade-in duration-500">
      <div className="text-center mb-6">
        <Sparkles className="w-10 h-10 mx-auto text-cyan-400 mb-2" />
        <h2 className="text-xl font-bold text-white">The Mirror</h2>
        <p className="text-xs text-gray-500">Context-Aware Memory Assistant</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-hide">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none' : 'bg-white/10 text-gray-200 border border-white/5 rounded-tl-none'}`}>{msg.text}</div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-gray-200 border border-white/5 rounded-2xl rounded-tl-none p-4">
              <Loader2 className="animate-spin" size={20} />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
      <div className="relative">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
          placeholder="Ask about your past..." 
          className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-14 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50" 
          disabled={isLoading}
        />
        <button 
          onClick={handleSend} 
          disabled={isLoading}
          className="absolute right-2 top-2 p-2 bg-white/10 rounded-full hover:bg-purple-600 hover:text-white text-gray-400 transition-all disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

const Insights = () => {
  return (
    <div className="max-w-2xl mx-auto pt-20 pb-24 md:py-10 px-4 space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-white mb-6">Analytics</h2>
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-6 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-purple-300 text-sm font-medium mb-1">Your Golden Era</p>
          <h3 className="text-4xl font-bold text-white">2022</h3>
          <p className="text-gray-300 text-xs mt-2 max-w-xs">You recorded 45% more positive memories this year compared to your average.</p>
        </div>
        <BarChart2 className="absolute -right-6 -bottom-6 text-white/5 w-48 h-48 transform rotate-12" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4"><User className="text-cyan-400" size={20} /><span className="text-xs text-gray-500">Top Interaction</span></div>
          <p className="text-xl font-bold text-white">Sarah Jenkins</p>
          <p className="text-xs text-gray-400 mt-1">Tagged in 142 photos</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
           <div className="flex items-center justify-between mb-4"><ImageIcon className="text-pink-400" size={20} /><span className="text-xs text-gray-500">Media Type</span></div>
          <p className="text-xl font-bold text-white">Photography</p>
          <p className="text-xs text-gray-400 mt-1">68% of your storage</p>
        </div>
      </div>
    </div>
  );
};

const Core = ({ connectedApps, setConnectedApps }) => {
  const [processing, setProcessing] = useState(null);

  const handleConnect = async (appId) => {
    if (connectedApps[appId]) {
      // Disconnect Logic
      try {
        await connectionsAPI.toggle(appId);
      } catch {
        // Continue even if API fails for demo
      }
      const newConnections = { ...connectedApps, [appId]: false };
      setConnectedApps(newConnections);
      localStorage.setItem('eternal_connections', JSON.stringify(newConnections));
    } else {
      // Connect Logic (Simulated OAuth)
      setProcessing(appId);
      try {
        await connectionsAPI.toggle(appId);
      } catch {
        // Continue even if API fails for demo
      }
      setTimeout(() => {
        const newConnections = { ...connectedApps, [appId]: true };
        setConnectedApps(newConnections);
        localStorage.setItem('eternal_connections', JSON.stringify(newConnections));
        setProcessing(null);
      }, 2000);
    }
  };

  const apps = [
    { id: 'instagram', icon: Instagram, label: 'Instagram', color: 'text-pink-500' },
    { id: 'facebook', icon: Facebook, label: 'Facebook', color: 'text-blue-500' },
    { id: 'tiktok', icon: TikTokIcon, label: 'TikTok', color: 'text-white' }, 
    { id: 'photos', icon: ImageIcon, label: 'Google Photos', color: 'text-yellow-500' },
  ];

  return (
    <div className="max-w-2xl mx-auto pt-20 pb-24 md:py-10 px-4 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-white mb-2">The Core</h2>
      <p className="text-gray-500 text-sm mb-8">Manage encrypted data pipes and legacy uploads.</p>

      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-xl mb-8">
        <Shield className="text-green-500" size={24} />
        <div>
          <p className="text-white text-sm font-medium">End-to-End Encryption Active</p>
          <p className="text-green-400/70 text-xs">Your data is visible only to you.</p>
        </div>
      </div>

      <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer mb-8 group">
        <div className="p-4 bg-black rounded-full mb-3 group-hover:scale-110 transition-transform">
          <UploadCloud className="text-cyan-400" size={32} />
        </div>
        <p className="text-white font-medium">Drop legacy files here</p>
        <p className="text-gray-500 text-xs mt-1">Supports JPG, MP4, MP3, WAV</p>
      </div>

      <h3 className="text-white font-medium mb-4 pl-1">Data Sources</h3>
      <div className="space-y-3">
        {apps.map((app) => (
          <div key={app.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl transition-all hover:bg-white/10">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${connectedApps[app.id] ? 'bg-white/10' : 'bg-transparent'}`}>
                <app.icon className={app.color} size={24} />
              </div>
              <div>
                <span className="text-white text-sm block font-medium">{app.label}</span>
                <span className="text-xs text-gray-500 block">
                  {processing === app.id ? 'Authorizing...' : connectedApps[app.id] ? 'Synced & Active' : 'Not Connected'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => handleConnect(app.id)}
              disabled={processing === app.id}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                connectedApps[app.id] 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              {processing === app.id ? <Loader2 size={14} className="animate-spin" /> : connectedApps[app.id] ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MAIN APP WRAPPER ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(DEFAULT_USER);
  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(true);
  const [connectedApps, setConnectedApps] = useState({
    instagram: false, facebook: false, tiktok: false, photos: false
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing session
        const userSession = localStorage.getItem('eternal_session');
        const savedUser = localStorage.getItem('user');
        const savedConnections = localStorage.getItem('eternal_connections');
        const accessToken = localStorage.getItem('accessToken');
        
        if (accessToken) {
          // Verify token with backend
          const result = await authAPI.getMe();
          if (result.user) {
            setCurrentUser(result.user);
            setIsLoggedIn(true);
          } else {
            // Try to refresh token
            const refreshResult = await authAPI.refresh();
            if (refreshResult?.accessToken) {
              localStorage.setItem('accessToken', refreshResult.accessToken);
              localStorage.setItem('refreshToken', refreshResult.refreshToken);
              const meResult = await authAPI.getMe();
              if (meResult.user) {
                setCurrentUser(meResult.user);
                setIsLoggedIn(true);
              }
            }
          }
        } else if (userSession) {
          // Fallback demo mode
          if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
          }
          setIsLoggedIn(true);
        }
        
        if (savedConnections) {
          setConnectedApps(JSON.parse(savedConnections));
        }

        // Try to fetch connections from API
        if (accessToken) {
          try {
            const connResult = await connectionsAPI.list();
            if (connResult.connections) {
              setConnectedApps(connResult.connections);
            }
          } catch {
            // Use local storage fallback
          }
        }
      } catch (e) {
        console.error("Auth initialization error:", e);
        localStorage.clear();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Continue even if API fails
    }
    localStorage.removeItem('eternal_session');
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setIsLoggedIn(false);
    setActiveTab('feed');
    setCurrentUser(DEFAULT_USER);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={48} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/20 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-900/20 blur-3xl rounded-full opacity-30"></div>
      </div>

      <div className="relative z-10 md:pl-64 h-full">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} currentUser={currentUser} />
        
        {/* Mobile Top Bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-md border-b border-white/5 z-40 flex items-center justify-between px-4">
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 text-lg">
            EternalMe
          </span>
          <div className="flex gap-4 text-white">
            <Search size={20} />
            <Bell size={20} />
          </div>
        </div>

        <main className="min-h-screen">
          {activeTab === 'feed' && <Feed currentUser={currentUser} />}
          {activeTab === 'mirror' && <Mirror />}
          {activeTab === 'insights' && <Insights />}
          {activeTab === 'core' && <Core connectedApps={connectedApps} setConnectedApps={setConnectedApps} />}
        </main>
      </div>
    </div>
  );
}
