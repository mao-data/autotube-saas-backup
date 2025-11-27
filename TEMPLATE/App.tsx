import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Youtube, 
  Layout, 
  LogOut, 
  FileText, 
  Video as VideoIcon, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Coins, 
  Wand2,
  Copy,
  ChevronRight,
  Clock,
  X,
  User as UserIcon,
  Calendar as CalendarIcon,
  CheckSquare,
  Sparkles,
  MoreHorizontal
} from 'lucide-react';

// --- CONFIGURATION ---

// ⚠️ REPLACE WITH YOUR FIREBASE CONFIGURATION
// If you do not have a Firebase project, the app will start in "Demo Mode" with mock auth.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

// ⚠️ GOOGLE GEMINI API KEY
const GEMINI_API_KEY = process.env.API_KEY || "";

// --- TYPES ---

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  credits: number;
  isDemo?: boolean;
}

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
}

interface ScriptSection {
  timestamp: string;
  voiceover: string;
  visual_prompt: string;
}

interface VideoBlueprint {
  video_title: string;
  script_sections: ScriptSection[];
}

interface GeneratedContent {
  id: string;
  type: 'text' | 'video_blueprint';
  sourceVideoId: string;
  sourceTitle: string;
  content: string | VideoBlueprint;
  createdAt: any; // Date or Timestamp
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: any; // Date or Timestamp for scheduler
}

type ViewState = 'login' | 'dashboard' | 'studio' | 'assets' | 'schedule';

// --- MOCK DATA ---
const MOCK_VIDEOS: YouTubeVideo[] = [
  {
    id: 'MOCK_1',
    title: 'The Future of Artificial Intelligence in 2025',
    thumbnail: 'https://picsum.photos/seed/tech1/640/360',
    channelTitle: 'Tech Insights',
    publishedAt: '2024-10-15',
    description: 'An in-depth look at how AI models are evolving.'
  },
  {
    id: 'MOCK_2',
    title: '10 Minute Morning Yoga for Beginners',
    thumbnail: 'https://picsum.photos/seed/yoga/640/360',
    channelTitle: 'Wellness Daily',
    publishedAt: '2024-09-20',
    description: 'Start your day right with this simple routine.'
  },
  {
    id: 'MOCK_3',
    title: 'How to Cook the Perfect Steak',
    thumbnail: 'https://picsum.photos/seed/food/640/360',
    channelTitle: 'Chef Masters',
    publishedAt: '2024-11-02',
    description: 'Gordon Ramsay style tips for home cooks.'
  },
  {
    id: 'MOCK_4',
    title: 'Financial Freedom: 5 Steps to Wealth',
    thumbnail: 'https://picsum.photos/seed/money/640/360',
    channelTitle: 'Finance Pro',
    publishedAt: '2024-08-10',
    description: 'Invest smart and retire early.'
  },
  {
    id: 'MOCK_5',
    title: 'Minimalist Desk Setup Tour 2025',
    thumbnail: 'https://picsum.photos/seed/desk/640/360',
    channelTitle: 'Setup Wars',
    publishedAt: '2024-12-01',
    description: 'Productivity hacking with a clean workspace.'
  },
  {
    id: 'MOCK_6',
    title: 'Learn React 19 in 20 Minutes',
    thumbnail: 'https://picsum.photos/seed/code/640/360',
    channelTitle: 'Code Daily',
    publishedAt: '2025-01-15',
    description: 'Everything you need to know about the new compiler.'
  },
];

// --- APP COMPONENT ---

const App: React.FC = () => {
  // State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewState>('login');
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>(MOCK_VIDEOS);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedContent[]>([]);
  
  // Batch & Scheduler State
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);

  // Studio State
  const [studioMode, setStudioMode] = useState<'text' | 'video'>('text');
  const [studioOutput, setStudioOutput] = useState<any>(null);

  // Firebase Refs
  const appRef = useRef<any>(null);
  const authRef = useRef<any>(null);
  const dbRef = useRef<any>(null);

  // --- INITIALIZATION ---

  useEffect(() => {
    // Initialize Firebase
    try {
      if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        throw new Error("Missing Config");
      }

      if (!getApps().length) {
        appRef.current = initializeApp(firebaseConfig);
      } else {
        appRef.current = getApp();
      }
      authRef.current = getAuth(appRef.current);
      dbRef.current = getFirestore(appRef.current);

      const unsubscribe = onAuthStateChanged(authRef.current, async (firebaseUser) => {
        if (firebaseUser) {
          await handleUserSync(firebaseUser);
          setView('dashboard');
        } else {
          setUser(prev => prev?.isDemo ? prev : null);
          if (!user?.isDemo) setView('login');
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.warn("Firebase init failed or config missing.", error);
    }
  }, []);

  // --- FIREBASE LOGIC ---

  const handleUserSync = async (firebaseUser: FirebaseUser) => {
    if (!dbRef.current) return;
    const userDocRef = doc(dbRef.current, "users", firebaseUser.uid);
    
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          credits: data.credits || 0,
          isDemo: false
        });
        fetchAssets(firebaseUser.uid);
      } else {
        const newUser = {
          email: firebaseUser.email,
          credits: 100,
          createdAt: Timestamp.now()
        };
        await setDoc(userDocRef, newUser);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          credits: 100,
          isDemo: false
        });
      }
    } catch (e) {
      console.error("Error syncing user:", e);
      showToast("Error syncing user data", "error");
    }
  };

  const fetchAssets = async (uid: string) => {
    if (user?.isDemo || uid === 'demo-user') return;

    if (!dbRef.current) return;
    const q = query(collection(dbRef.current, "assets"), where("userId", "==", uid));
    const querySnapshot = await getDocs(q);
    const loadedAssets: GeneratedContent[] = [];
    querySnapshot.forEach((doc) => {
      loadedAssets.push({ id: doc.id, ...doc.data() } as GeneratedContent);
    });
    setGeneratedAssets(loadedAssets.sort((a,b) => b.createdAt > a.createdAt ? 1 : -1));
  };

  const login = async () => {
    if (!authRef.current) {
      showToast("Firebase not configured. Please use Demo Login.", "error");
      return;
    }
    try {
      await setPersistence(authRef.current, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
      await signInWithPopup(authRef.current, provider);
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setUser({
        uid: 'demo-user',
        email: 'guest@demo.com',
        displayName: 'Guest User',
        photoURL: null,
        credits: 500,
        isDemo: true
      });
      setView('dashboard');
      setIsLoading(false);
      showToast("Welcome to Demo Mode!", "success");
    }, 800);
  };

  const logout = async () => {
    if (user?.isDemo) {
      setUser(null);
      setView('login');
      setGeneratedAssets([]);
      setSelectedVideoIds(new Set());
      return;
    }

    if (!authRef.current) return;
    await signOut(authRef.current);
    setView('login');
    setUser(null);
  };

  // --- CREDIT SYSTEM ---

  const deductCredits = async (amount: number): Promise<boolean> => {
    if (!user) return false;

    if (user.isDemo) {
      if (user.credits < amount) {
        showToast(`Not enough credits! Need ${amount} credits.`, "error");
        setShowCreditModal(true);
        return false;
      }
      setUser({ ...user, credits: user.credits - amount });
      return true;
    }

    if (!dbRef.current) return false;
    const userDocRef = doc(dbRef.current, "users", user.uid);

    try {
      await runTransaction(dbRef.current, async (transaction) => {
        const sfDoc = await transaction.get(userDocRef);
        if (!sfDoc.exists()) throw "User does not exist!";
        
        const newCredits = (sfDoc.data().credits || 0) - amount;
        if (newCredits < 0) {
          throw new Error("INSUFFICIENT_FUNDS");
        }
        transaction.update(userDocRef, { credits: newCredits });
      });
      
      setUser(prev => prev ? { ...prev, credits: prev.credits - amount } : null);
      return true;
    } catch (e: any) {
      if (e.message === "INSUFFICIENT_FUNDS" || e === "INSUFFICIENT_FUNDS") {
        showToast(`Not enough credits! Need ${amount} credits.`, "error");
        setShowCreditModal(true);
      } else {
        console.error("Transaction failed: ", e);
        showToast("Transaction failed. Please try again.", "error");
      }
      return false;
    }
  };

  const handlePurchase = async (amount: number) => {
    if (!user) return;
    setIsLoading(true);
    
    setTimeout(async () => {
      try {
        if (!user.isDemo && dbRef.current) {
          const userDocRef = doc(dbRef.current, "users", user.uid);
          await updateDoc(userDocRef, {
            credits: increment(amount)
          });
        }
        setUser(prev => prev ? { ...prev, credits: prev.credits + amount } : null);
        showToast(`Successfully purchased ${amount} credits!`, "success");
        setShowCreditModal(false);
      } catch (e) {
        showToast("Purchase failed.", "error");
      } finally {
        setIsLoading(false);
      }
    }, 1500);
  };

  // --- CORE GEMINI LOGIC ---

  const generateContentCore = async (video: YouTubeVideo, mode: 'text' | 'video', scheduledDate?: Date) => {
    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let prompt = "";
    let systemInstruction = "";
    let isVideoMode = mode === 'video';

    if (isVideoMode) {
      systemInstruction = `You are a professional video producer. Create a structured viral short video script. Return ONLY valid JSON.`;
      prompt = `Source Title: "${video.title}"\nDescription: "${video.description}"\nChannel: "${video.channelTitle}"\nTask: Create a 30-60s Short video blueprint. JSON Format: { "video_title": "", "script_sections": [{ "timestamp": "", "voiceover": "", "visual_prompt": "" }] }`;
    } else {
      systemInstruction = "You are a social media expert.";
      prompt = `Based on: "${video.title}" by ${video.channelTitle}.\nDescription: ${video.description}\nGenerate:\n1. LinkedIn post\n2. Twitter thread\n3. Blog summary\nFormat with Markdown headers.`;
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: isVideoMode ? "application/json" : "text/plain",
        ...(isVideoMode && {
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                video_title: { type: Type.STRING },
                script_sections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      timestamp: { type: Type.STRING },
                      voiceover: { type: Type.STRING },
                      visual_prompt: { type: Type.STRING }
                    }
                  }
                }
              }
            }
        })
      }
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction }
    });

    const responseText = result.response.text;
    let finalContent: any = responseText;
    if (isVideoMode) {
      try {
        finalContent = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Failed to parse video blueprint.");
      }
    }

    // Determine Status
    const status = scheduledDate ? 'scheduled' : 'draft';

    const newAsset: GeneratedContent = {
        id: 'asset_' + Date.now() + Math.random().toString(36).substr(2, 9),
        type: isVideoMode ? 'video_blueprint' : 'text',
        sourceVideoId: video.id,
        sourceTitle: video.title,
        content: finalContent,
        createdAt: user?.isDemo ? { seconds: Date.now() / 1000 } : Timestamp.now(),
        status: status,
        scheduledDate: scheduledDate ? (user?.isDemo ? { seconds: scheduledDate.getTime() / 1000 } : Timestamp.fromDate(scheduledDate)) : undefined
    };

    // Save
    if (user && !user.isDemo && dbRef.current) {
      await addDoc(collection(dbRef.current, "assets"), {
        userId: user.uid,
        ...newAsset
      });
    }

    return newAsset;
  };

  // --- HANDLERS ---

  const handleSingleGenerate = async () => {
    if (!selectedVideo || !user) return;
    const cost = studioMode === 'text' ? 10 : 20;
    
    const hasCredits = await deductCredits(cost);
    if (!hasCredits) return;

    setIsLoading(true);
    setStudioOutput(null);

    try {
      const asset = await generateContentCore(selectedVideo, studioMode);
      setStudioOutput(asset.content);
      setGeneratedAssets(prev => [asset, ...prev]);
      showToast("Content generated successfully!", "success");
    } catch (error: any) {
      console.error(error);
      showToast("Generation failed: " + error.message, "error");
      if (user.isDemo) setUser(prev => prev ? { ...prev, credits: prev.credits + cost } : null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (selectedVideoIds.size === 0 || !user) return;
    
    // Default to Text mode for batch for this prototype
    const MODE = 'text'; 
    const COST_PER_ITEM = 10;
    const totalCost = selectedVideoIds.size * COST_PER_ITEM;

    const hasCredits = await deductCredits(totalCost);
    if (!hasCredits) return;

    setBatchProgress({ current: 0, total: selectedVideoIds.size });
    setIsLoading(true);

    const selectedVideosList = videos.filter(v => selectedVideoIds.has(v.id));
    let successCount = 0;

    for (let i = 0; i < selectedVideosList.length; i++) {
      try {
        const video = selectedVideosList[i];
        const asset = await generateContentCore(video, MODE);
        setGeneratedAssets(prev => [asset, ...prev]);
        successCount++;
        setBatchProgress({ current: i + 1, total: selectedVideoIds.size });
      } catch (e) {
        console.error(`Failed to generate for ${selectedVideosList[i].id}`);
      }
    }

    setIsLoading(false);
    setBatchProgress(null);
    setSelectedVideoIds(new Set());
    setIsBatchMode(false);
    showToast(`Batch Complete: ${successCount}/${selectedVideoIds.size} generated.`, "success");
    setView('assets');
  };

  const handleAutoSchedule = async () => {
    if (!user) return;
    // Auto-pilot: Pick 5 random videos, generate text posts, schedule for next 5 days
    const ITEMS_TO_GENERATE = 5;
    const COST = ITEMS_TO_GENERATE * 10;

    const hasCredits = await deductCredits(COST);
    if (!hasCredits) return;

    setIsLoading(true);
    showToast("Auto-Pilot Started: Analyzing trends & scheduling...", "success");

    const shuffled = [...videos].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, ITEMS_TO_GENERATE);
    
    let generatedCount = 0;
    const today = new Date();

    for (let i = 0; i < selected.length; i++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + i + 1); // Schedule for tomorrow onwards

      try {
        const asset = await generateContentCore(selected[i], 'text', scheduleDate);
        setGeneratedAssets(prev => [asset, ...prev]);
        generatedCount++;
      } catch (e) {
        console.error(e);
      }
    }

    setIsLoading(false);
    showToast(`Auto-Pilot: Scheduled ${generatedCount} posts for the upcoming week!`, "success");
  };

  // --- HELPERS ---

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  const toggleVideoSelection = (id: string) => {
    const newSet = new Set(selectedVideoIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedVideoIds(newSet);
  };

  // --- SUB-COMPONENTS ---

  const Navbar = () => (
    <nav className="sticky top-0 z-50 bg-dark-surface/90 backdrop-blur-md border-b border-dark-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
          <Wand2 size={18} />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-brand-200">
          AutoTube
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        {user && (
          <>
            {user.isDemo && (
               <div className="hidden md:flex items-center gap-1 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/20">
                  <AlertCircle size={12} /> Demo Mode
               </div>
            )}
            <button 
              onClick={() => setView('schedule')}
              className={`text-sm font-medium hover:text-brand-400 transition-colors ${view === 'schedule' ? 'text-brand-400' : 'text-slate-400'}`}
            >
              Calendar
            </button>
            <button 
              onClick={() => setView('assets')}
              className={`text-sm font-medium hover:text-brand-400 transition-colors ${view === 'assets' ? 'text-brand-400' : 'text-slate-400'}`}
            >
              My Assets
            </button>
            <div className="h-6 w-px bg-dark-border mx-2"></div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-dark-border">
              <Coins size={14} className="text-yellow-400" />
              <span className="text-sm font-semibold text-slate-200">{user.credits}</span>
            </div>
            <button 
              onClick={() => setShowCreditModal(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all shadow-lg shadow-brand-900/20"
            >
              Buy Credits
            </button>
            <div className="relative group ml-2">
               <div className="w-9 h-9 rounded-full border-2 border-dark-border bg-slate-700 flex items-center justify-center overflow-hidden cursor-pointer">
                 {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                    <UserIcon size={16} className="text-slate-400" />
                 )}
               </div>
               <div className="absolute right-0 top-full mt-2 w-48 bg-dark-surface border border-dark-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity invisible group-hover:visible p-2">
                 <button 
                   onClick={logout}
                   className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md"
                 >
                   <LogOut size={14} /> Sign Out
                 </button>
               </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );

  const CreditModal = () => {
    if (!showCreditModal) return null;
    const plans = [
      { credits: 500, price: "$5", name: "Creator Pack", popular: false },
      { credits: 1500, price: "$12", name: "Pro Studio", popular: true },
      { credits: 5000, price: "$35", name: "Agency", popular: false },
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-dark-border flex justify-between items-center bg-slate-900/50">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Coins className="text-brand-400" /> Top Up Credits
              </h2>
              <p className="text-slate-400 text-sm mt-1">Generate more content without limits.</p>
            </div>
            <button onClick={() => setShowCreditModal(false)} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="p-8 grid md:grid-cols-3 gap-4">
            {plans.map((plan, idx) => (
              <div key={idx} className={`relative bg-slate-800/50 border ${plan.popular ? 'border-brand-500 ring-1 ring-brand-500' : 'border-dark-border'} rounded-xl p-6 flex flex-col items-center hover:bg-slate-800 transition-all group`}>
                {plan.popular && (
                  <span className="absolute -top-3 bg-brand-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full">Most Popular</span>
                )}
                <h3 className="text-slate-300 font-medium mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-white mb-1">{plan.credits}</div>
                <div className="text-brand-400 text-xs font-medium uppercase tracking-wider mb-6">Credits</div>
                <div className="text-2xl text-white font-semibold mb-6">{plan.price}</div>
                <button 
                  onClick={() => handlePurchase(plan.credits)}
                  disabled={isLoading}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${plan.popular ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Buy Now"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // --- VIEWS ---

  const LoginView = () => (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/40 via-dark-bg to-dark-bg"></div>
      <div className="relative z-10 text-center max-w-lg px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-brand-500/20 mb-8 rotate-3">
          <Wand2 size={40} className="text-white" />
        </div>
        <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">AutoTube <span className="text-brand-400">Hub</span></h1>
        <p className="text-lg text-slate-400 mb-8 leading-relaxed">
          The AI-powered workspace for creators. Batch generate content, schedule posts, and scale your channel.
        </p>
        <div className="space-y-4">
          <button 
            onClick={login}
            className="w-full group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-white/10 border border-white/10 rounded-full hover:bg-white/20"
          >
            <Youtube className="mr-2 text-red-500 fill-current" />
            <span>Continue with Google</span>
          </button>
          <button 
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-slate-400 transition-all duration-200 border border-slate-700 rounded-full hover:bg-slate-800 hover:text-white"
          >
            {isLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Enter as Guest (Demo Mode)
          </button>
        </div>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-24">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-bold text-white mb-3">Content Discovery</h2>
          <p className="text-slate-400">Select videos to repurpose into social content.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              setSelectedVideoIds(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${isBatchMode ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
          >
            <CheckSquare size={16} />
            {isBatchMode ? 'Exit Selection' : 'Batch Select'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {videos.map((video) => {
          const isSelected = selectedVideoIds.has(video.id);
          return (
            <div 
              key={video.id} 
              className={`group relative bg-dark-surface border rounded-xl overflow-hidden transition-all cursor-pointer hover:-translate-y-1 ${isSelected ? 'border-brand-500 ring-1 ring-brand-500' : 'border-dark-border hover:border-brand-500/50'}`}
              onClick={() => {
                if (isBatchMode) {
                  toggleVideoSelection(video.id);
                } else {
                  setSelectedVideo(video);
                  setStudioMode('text');
                  setStudioOutput(null);
                  setView('studio');
                }
              }}
            >
              <div className="relative aspect-video">
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                {isBatchMode && (
                   <div className={`absolute top-2 right-2 w-6 h-6 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-brand-500 border-brand-500 text-white' : 'bg-black/40 border-white/50'}`}>
                      {isSelected && <CheckSquare size={14} />}
                   </div>
                )}
                {!isBatchMode && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                      <Wand2 size={16} /> Remix
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-white line-clamp-2 mb-2 group-hover:text-brand-300 transition-colors">{video.title}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Youtube size={12} /> {video.channelTitle}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* BATCH ACTION BAR */}
      {selectedVideoIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-dark-border rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in z-40">
           <div className="flex items-center gap-2">
              <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{selectedVideoIds.size}</span>
              <span className="text-sm text-slate-300 font-medium">Selected</span>
           </div>
           <div className="h-4 w-px bg-slate-700"></div>
           <div className="text-sm text-slate-400">
              Est. Cost: <span className="text-yellow-400 font-bold">{selectedVideoIds.size * 10}</span> credits
           </div>
           <button 
             onClick={handleBatchGenerate}
             disabled={isLoading}
             className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
           >
             {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
             Batch Generate
           </button>
        </div>
      )}
      
      {/* BATCH PROGRESS MODAL */}
      {batchProgress && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-dark-surface border border-dark-border p-8 rounded-2xl w-full max-w-md text-center">
               <Loader2 size={48} className="animate-spin text-brand-500 mx-auto mb-4" />
               <h3 className="text-xl font-bold text-white mb-2">Batch Processing...</h3>
               <p className="text-slate-400 mb-6">Using AI to analyze and generate content.</p>
               <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden mb-2">
                  <div 
                    className="bg-brand-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  ></div>
               </div>
               <p className="text-xs text-slate-500 font-mono">
                  Processing {batchProgress.current} of {batchProgress.total}
               </p>
            </div>
         </div>
      )}
    </div>
  );

  const ScheduleView = () => {
    // Mock days logic for demo
    const days = Array.from({length: 7}, (_, i) => {
       const d = new Date();
       d.setDate(d.getDate() + i);
       return d;
    });

    const getAssetsForDate = (date: Date) => {
       return generatedAssets.filter(asset => {
          if (!asset.scheduledDate) return false;
          const aDate = new Date(asset.scheduledDate.seconds * 1000);
          return aDate.getDate() === date.getDate() && aDate.getMonth() === date.getMonth();
       });
    };

    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
           <div>
             <h2 className="text-3xl font-bold text-white mb-2">Content Calendar</h2>
             <p className="text-slate-400">Automate your posting schedule with AI Agents.</p>
           </div>
           <button 
             onClick={handleAutoSchedule}
             disabled={isLoading}
             className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
           >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Auto-Pilot: Fill My Week
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
           {days.map((day, idx) => {
              const dayAssets = getAssetsForDate(day);
              const isToday = idx === 0;
              
              return (
                <div key={idx} className={`min-h-[300px] rounded-xl border p-3 flex flex-col ${isToday ? 'bg-brand-900/10 border-brand-500/50' : 'bg-dark-surface border-dark-border'}`}>
                   <div className="text-center mb-4 pb-2 border-b border-white/5">
                      <div className={`text-xs uppercase font-bold mb-1 ${isToday ? 'text-brand-400' : 'text-slate-500'}`}>
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`text-xl font-bold ${isToday ? 'text-white' : 'text-slate-300'}`}>
                        {day.getDate()}
                      </div>
                   </div>
                   
                   <div className="flex-1 space-y-2">
                      {dayAssets.map(asset => (
                         <div key={asset.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:border-brand-500/30 transition-colors group cursor-pointer" onClick={() => {
                            setStudioMode(asset.type === 'video_blueprint' ? 'video' : 'text');
                            setSelectedVideo(MOCK_VIDEOS.find(v => v.id === asset.sourceVideoId) || MOCK_VIDEOS[0]);
                            setStudioOutput(asset.content);
                            setView('studio');
                         }}>
                            <div className="flex justify-between items-start mb-1">
                               <span className={`w-1.5 h-1.5 rounded-full mt-1 ${asset.type === 'text' ? 'bg-blue-400' : 'bg-purple-400'}`}></span>
                               {asset.status === 'scheduled' && <Clock size={10} className="text-slate-500" />}
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 leading-snug">
                               {asset.sourceTitle}
                            </p>
                         </div>
                      ))}
                      {dayAssets.length === 0 && (
                         <div className="h-full flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-700">
                               <PlusIcon size={14} />
                            </div>
                         </div>
                      )}
                   </div>
                </div>
              );
           })}
        </div>
      </div>
    );
  };

  const PlusIcon = ({size}: {size: number}) => (
     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
  );

  const StudioView = () => {
    if (!selectedVideo) return null;

    return (
      <div className="h-[calc(100vh-73px)] flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-1/4 bg-dark-surface border-r border-dark-border p-6 overflow-y-auto hidden md:block">
          <button onClick={() => setView('dashboard')} className="text-xs font-semibold text-slate-500 hover:text-white mb-6 flex items-center gap-1">
            <ChevronRight className="rotate-180" size={14} /> Back to Dashboard
          </button>
          <div className="rounded-xl overflow-hidden mb-4 border border-dark-border">
            <img src={selectedVideo.thumbnail} className="w-full" alt="thumb" />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">{selectedVideo.title}</h3>
          <p className="text-sm text-slate-400 mb-6">{selectedVideo.channelTitle}</p>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-dark-border">
            <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">Description Context</h4>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-6">{selectedVideo.description}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-dark-bg">
          <div className="flex border-b border-dark-border bg-dark-surface/50">
            <button 
              onClick={() => setStudioMode('text')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${studioMode === 'text' ? 'border-brand-500 text-brand-400 bg-brand-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <FileText size={18} /> Social Posts (10 <Coins size={10} className="inline" />)
            </button>
            <button 
              onClick={() => setStudioMode('video')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${studioMode === 'video' ? 'border-brand-500 text-brand-400 bg-brand-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <VideoIcon size={18} /> Video Blueprint (20 <Coins size={10} className="inline" />)
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {!studioOutput ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-dark-border">
                  {studioMode === 'text' ? <FileText size={32} className="text-slate-500" /> : <VideoIcon size={32} className="text-slate-500" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Ready to generate {studioMode === 'text' ? 'text content' : 'a video blueprint'}?
                </h3>
                <button 
                  onClick={handleSingleGenerate}
                  disabled={isLoading}
                  className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-brand-900/20 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />} Generate Content
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {studioMode === 'text' ? (
                  <div className="bg-dark-surface border border-dark-border rounded-xl p-8 max-w-3xl mx-auto shadow-2xl">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-dark-border">
                      <h2 className="text-xl font-bold text-white">Generated Drafts</h2>
                      <button onClick={() => copyToClipboard(studioOutput)} className="text-slate-400 hover:text-white transition-colors">
                        <Copy size={20} />
                      </button>
                    </div>
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap text-slate-300">
                      {studioOutput}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-6">
                     <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-white">{(studioOutput as VideoBlueprint).video_title}</h2>
                     </div>
                     <div className="grid gap-4">
                        {(studioOutput as VideoBlueprint).script_sections?.map((section, idx) => (
                          <div key={idx} className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden flex flex-col md:flex-row shadow-lg">
                            <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-dark-border">
                              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono border border-dark-border">{section.timestamp}</span>
                              <p className="text-lg text-white font-medium mt-2">"{section.voiceover}"</p>
                            </div>
                            <div className="p-6 md:w-1/2 bg-slate-900/30">
                              <div className="flex justify-between mb-2">
                                <span className="text-xs font-bold text-purple-400 uppercase">Visual Prompt</span>
                                <button onClick={() => copyToClipboard(section.visual_prompt)} className="text-slate-500 hover:text-white"><Copy size={14} /></button>
                              </div>
                              <p className="text-sm text-slate-400 italic">{section.visual_prompt}</p>
                            </div>
                          </div>
                        ))}
                     </div>
                  </div>
                )}
                <div className="mt-8 text-center pb-8">
                  <button onClick={() => setStudioOutput(null)} className="text-slate-400 hover:text-white underline text-sm">Discard and Generate New</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const AssetsView = () => (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('dashboard')} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white">
           <ChevronRight className="rotate-180" size={20} />
        </button>
        <h2 className="text-3xl font-bold text-white">My Creative Assets</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {generatedAssets.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-500">
             <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layout size={24} />
             </div>
             No assets generated yet.
          </div>
        )}
        
        {generatedAssets.map((asset) => (
          <div key={asset.id} className="bg-dark-surface border border-dark-border rounded-xl p-5 hover:border-brand-500/30 transition-all flex flex-col h-full relative overflow-hidden">
            {asset.status === 'scheduled' && (
               <div className="absolute top-0 right-0 bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-bl-lg border-b border-l border-blue-500/20">
                  SCHEDULED
               </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                asset.type === 'video_blueprint' 
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {asset.type === 'video_blueprint' ? 'Video Script' : 'Text Content'}
              </span>
            </div>
            
            <h3 className="font-bold text-white mb-1 line-clamp-1">
              {asset.type === 'video_blueprint' ? (asset.content as VideoBlueprint).video_title : asset.sourceTitle}
            </h3>
            <p className="text-xs text-slate-500 mb-4 line-clamp-1">Based on: {asset.sourceTitle}</p>
            
            <div className="mt-auto pt-4 border-t border-dark-border flex gap-2">
              <button 
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                onClick={() => {
                  setStudioMode(asset.type === 'video_blueprint' ? 'video' : 'text');
                  setSelectedVideo(MOCK_VIDEOS.find(v => v.id === asset.sourceVideoId) || MOCK_VIDEOS[0]); 
                  setStudioOutput(asset.content);
                  setView('studio');
                }}
              >
                Open Studio
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-bg text-slate-200 font-sans selection:bg-brand-500/30">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{toast.msg}</span>
        </div>
      )}

      {view !== 'login' && <Navbar />}
      <CreditModal />

      <main className="animate-in fade-in duration-500">
        {view === 'login' && <LoginView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'studio' && <StudioView />}
        {view === 'assets' && <AssetsView />}
        {view === 'schedule' && <ScheduleView />}
      </main>
    </div>
  );
};

export default App;