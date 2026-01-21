import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase/config";
import { doc, onSnapshot } from "firebase/firestore";
import Spinner from "../components/Spinner";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
  let unsubscribeProfile = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);

    if (unsubscribeProfile) {
      unsubscribeProfile();
      unsubscribeProfile = null;
    }

    if (currentUser) {
      const docRef = doc(db, "users", currentUser.uid);

      unsubscribeProfile = onSnapshot(
        docRef,
        (docSnap) => {
          setProfile(docSnap.exists() ? docSnap.data() : null);
          setLoading(false);
        },
        (error) => {
          console.error("エラー発生：", error);
          setLoading(false);
        }
      );
    } else {
      setProfile(null);
      setLoading(false);
    }
  });

  return () => {
    if (unsubscribeProfile) unsubscribeProfile();
    unsubscribeAuth();
  };
}, []);


  if (loading) return <Spinner />;

  const value = { user, profile };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
