
'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { UserProfile } from '@/lib/data';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  user: User | null; // Current authenticated user
  isUserLoading: boolean; // True while waiting for the initial auth state
  userProfile: UserProfile | null;
  isProfileLoading: boolean;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true); // Start as loading
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Effect to handle authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsUserLoading(false); // Set loading to false once we have a user or know there isn't one
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);

  // Effect to fetch user profile from Firestore
  useEffect(() => {
    if (user && firestore) {
      if (user.isAnonymous) {
          setUserProfile(null);
          setIsProfileLoading(false);
          return;
      }

      setIsProfileLoading(true);
      const profileRef = doc(firestore, 'users', user.uid);
      
      const unsubscribe = onSnapshot(profileRef, (snapshot) => {
        if (snapshot.exists()) {
          const profileData = snapshot.data();
          setUserProfile({
            ...profileData,
            id: snapshot.id,
          } as UserProfile);
        } else {
          // Document might not exist yet for a new user, this is not an error
          setUserProfile(null);
        }
        setIsProfileLoading(false);
      }, (error) => {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        setIsProfileLoading(false);
      });

      return () => unsubscribe();
    } else {
        // Handle case where there is no user
        setUserProfile(null);
        setIsProfileLoading(false);
    }
  }, [user, firestore]);


  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user,
      isUserLoading,
      userProfile,
      isProfileLoading,
    };
  }, [firebaseApp, firestore, auth, user, isUserLoading, userProfile, isProfileLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


/**
 * Hook to access core Firebase services.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return context;
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  if (!auth) throw new Error("Auth service is not available");
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  if (!firestore) throw new Error("Firestore service is not available");
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  if (!firebaseApp) throw new Error("Firebase App is not available");
  return firebaseApp;
};

/** Hook to access the current authenticated user and their profile. */
export const useUser = (): {user: User | null; userProfile: UserProfile | null; isLoading: boolean} => {
    const { user, isUserLoading, userProfile, isProfileLoading } = useFirebase();
    return { user, userProfile, isLoading: isUserLoading || isProfileLoading };
}

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

// Re-export onSnapshot for convenience, though it doesn't need to be in this file.
export { onSnapshot } from 'firebase/firestore';
