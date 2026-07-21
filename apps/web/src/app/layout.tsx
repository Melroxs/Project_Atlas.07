import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/providers/SupabaseProvider";
import SplashScreen from "@/components/SplashScreen";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project Atlas - AI Operating System for Insurance Restoration",
  description: "Project Atlas is an AI-powered operating system designed specifically for insurance restoration companies, streamlining claims management, interviews, supplements, and workflow automation.",
  keywords: ["insurance restoration", "claims management", "AI operating system", "supplements", "adjusters", "property restoration"],
  authors: [{ name: "Project Atlas" }],
  creator: "Project Atlas",
  publisher: "Project Atlas",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://projectatlas.com'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://projectatlas.com',
    title: "Project Atlas - AI Operating System for Insurance Restoration",
    description: "AI-powered operating system for insurance restoration companies",
    siteName: "Project Atlas",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Atlas - AI Operating System for Insurance Restoration",
    description: "AI-powered operating system for insurance restoration companies",
  },
  icons: {
    icon: "/brand/logo-icon.svg",
    apple: "/brand/logo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SplashScreen />
        <SupabaseProvider>
          <Providers>{children}</Providers>
        </SupabaseProvider>
      </body>
    </html>
  );
}
