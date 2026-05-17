"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface PushContextValue {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  subscribing: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

const PushContext = createContext<PushContextValue>({
  supported: false,
  permission: "unsupported",
  subscribed: false,
  subscribing: false,
  subscribe: async () => {},
  unsubscribe: async () => {},
});

export function usePush() {
  return useContext(PushContext);
}

export function PushProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      setReg(registration);
      registration.pushManager.getSubscription().then((sub) => setSubscribed(!!sub));
    }).catch(console.error);
  }, []);

  const subscribe = useCallback(async () => {
    if (!reg || !supported) return;
    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    } finally {
      setSubscribing(false);
    }
  }, [reg, supported]);

  const unsubscribe = useCallback(async () => {
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    setSubscribed(false);
  }, [reg]);

  return (
    <PushContext.Provider value={{ supported, permission, subscribed, subscribing, subscribe, unsubscribe }}>
      {children}
    </PushContext.Provider>
  );
}
