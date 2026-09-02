"use client";

import { useEffect } from "react";

export function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // instalação como app continua funcionando mesmo se o SW falhar
      });
    }
  }, []);

  return null;
}
