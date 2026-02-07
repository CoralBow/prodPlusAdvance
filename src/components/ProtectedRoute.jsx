import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase/config";
import Spinner from "../components/Spinner";

export default function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size={40} />
      </div>
    );

  if (!user) return <Navigate to="/auth" />;

  if (!user.emailVerified) return <Navigate to="/auth" />;

  return children;
}
