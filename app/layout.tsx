import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Real World Perps | RWA Execution Cost Comparison",
  description: "Compare execution costs for real-world assets across perpetual DEXs. Find the best venue for your RWA trades.",
  keywords: ["RWA", "perpetual DEX", "trading", "execution costs", "real world assets", "DeFi"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Real World Perps",
    description: "Compare execution costs for real-world assets across perpetual DEXs",
    url: "https://realworldperps.xyz",
    siteName: "Real World Perps",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Real World Perps",
    description: "Compare execution costs for real-world assets across perpetual DEXs",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
