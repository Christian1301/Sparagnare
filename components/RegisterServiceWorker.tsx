"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // installazione della PWA/offline non critica: se fallisce
      // l'app continua a funzionare normalmente online
    });
  }, []);

  return null;
}
