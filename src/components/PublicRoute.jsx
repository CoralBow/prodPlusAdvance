import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase/config";
import Spinner from "../components/Spinner";

export default function PublicRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) return <Spinner />;

  // ユーザーが「ログイン済み」かつ「メール認証済み」の場合のみ、認証系ページからリダイレクトする
  if (user && user.emailVerified) {
    return <Navigate to="/" />;
  }

  // それ以外の場合は、ログイン／登録／認証UIを表示させる
  return children;
}
