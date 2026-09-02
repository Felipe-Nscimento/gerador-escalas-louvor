import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";

export const metadata: Metadata = {
  title: "Gerador de Escalas de Louvor",
  description: "Gere e organize escalas do grupo de louvor, 100% offline.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Escalas Louvor",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c5ce6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
