import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebaseClient";
import { useAuth } from "./auth/AuthContext";

export default function App() {
  console.log("APP MOUNT");
  const onGoogle = async () => {
    console.log("CLICKED");
    alert("clicked");
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      console.log("POPUP OK", cred);

      const idToken = await cred.user.getIdToken();
      console.log("IDTOKEN LEN", idToken.length);

      const r = await fetch("/api/auth/social/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`backend ${r.status}: ${t}`);
      }
      await refreshMe();
      const text = await r.text();
      console.log("BACKEND", r.status, text);
    } catch (e) {
      console.error("GOOGLE LOGIN ERROR", e);
      alert(String(e?.message ?? e));
    }
  };
  const { user, loading, logout, refreshMe } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>loading...</div>;
  console.log("APP RENDER", { loading, user });
  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={onGoogle}>Google Login</button>
      {user ? (
        <>
          <div>Logged in as: {user.email} ({user.role})</div>
          <button onClick={logout} style={{ marginTop: 12 }}>Logout</button>
        </>
      ) : (
        <div>Not logged in</div>
      )}
    </div>
  );
}
