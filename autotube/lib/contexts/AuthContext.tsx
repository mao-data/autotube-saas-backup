'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: () => Promise<void>;
  loginDemo: () => void;
  logout: () => Promise<void>;
  deductCredits: (amount: number) => Promise<boolean>;
  addCredits: (amount: number) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // 同步用戶資料
  const syncUser = async (firebaseUser: FirebaseUser) => {
    const db = getFirebaseDb();
    const userDocRef = doc(db, "users", firebaseUser.uid);

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
    }
  };

  // 監聽認證狀態
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUser(firebaseUser);
      } else {
        setUser(prev => prev?.isDemo ? prev : null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 登入
  const login = async () => {
    if (!isFirebaseConfigured()) {
      throw new Error("Firebase not configured");
    }

    const auth = getFirebaseAuth();
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
    provider.addScope('https://www.googleapis.com/auth/youtube.upload');
    provider.addScope('https://www.googleapis.com/auth/youtube');
    await signInWithPopup(auth, provider);
    router.push('/dashboard');
  };

  // Demo 登入
  const loginDemo = () => {
    setUser({
      uid: 'demo-user',
      email: 'guest@demo.com',
      displayName: 'Guest User',
      photoURL: null,
      credits: 500,
      isDemo: true
    });
    router.push('/dashboard');
  };

  // 登出
  const logout = async () => {
    if (user?.isDemo) {
      setUser(null);
      router.push('/');
      return;
    }

    if (isFirebaseConfigured()) {
      const auth = getFirebaseAuth();
      await signOut(auth);
    }
    setUser(null);
    router.push('/');
  };

  // 扣除積分
  const deductCredits = async (amount: number): Promise<boolean> => {
    if (!user) return false;

    if (user.isDemo) {
      if (user.credits < amount) {
        return false;
      }
      setUser({ ...user, credits: user.credits - amount });
      return true;
    }

    const db = getFirebaseDb();
    const userDocRef = doc(db, "users", user.uid);

    try {
      await runTransaction(db, async (transaction) => {
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
        return false;
      }
      console.error("Transaction failed: ", e);
      return false;
    }
  };

  // 增加積分
  const addCredits = async (amount: number) => {
    if (!user) return;

    if (user.isDemo) {
      setUser({ ...user, credits: user.credits + amount });
      return;
    }

    const db = getFirebaseDb();
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, {
      credits: increment(amount)
    });
    setUser(prev => prev ? { ...prev, credits: prev.credits + amount } : null);
  };

  // 刷新用戶資料
  const refreshUser = async () => {
    if (!user || user.isDemo) return;

    const db = getFirebaseDb();
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      setUser(prev => prev ? { ...prev, credits: data.credits || 0 } : null);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    loginDemo,
    logout,
    deductCredits,
    addCredits,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
