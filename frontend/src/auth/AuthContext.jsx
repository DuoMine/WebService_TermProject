import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const err = new Error(typeof data === "string" ? data : data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 앱 시작 시 로그인 상태 확인
  useEffect(() => {
    (async () => {
      try {
        const me = await api("/api/users/me");
        setUser(me?.user ?? me); // 백엔드 응답 구조에 따라 둘 중 하나가 맞음
      } catch (e) {
        if (e.status !== 401) console.error(e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    refreshMe: async () => {
      const me = await api("/api/users/me");
      setUser(me?.user ?? me);
      return me;
    },
    logout: async () => {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
