
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, firebase } from '../firebase'; // Import compat instances
import type { User } from '../types'; // Your app's User type

// Types are available on the firebase namespace in the compat library
type FirebaseUser = firebase.User;
type UserCredential = firebase.auth.UserCredential;

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser | null): User | null => { 
    if (!firebaseUser) return null;
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
    };
  };

  useEffect(() => {
    // Use the onAuthStateChanged method from the compat auth service
    const unsubscribe = auth.onAuthStateChanged((user: FirebaseUser | null) => { 
      setCurrentUser(mapFirebaseUserToAppUser(user));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signup = (email: string, password: string): Promise<UserCredential> => { 
    return auth.createUserWithEmailAndPassword(email, password); 
  };

  const login = (email: string, password: string): Promise<UserCredential> => { 
    return auth.signInWithEmailAndPassword(email, password); 
  };

  const logout = (): Promise<void> => {
    return auth.signOut(); 
  };

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
