import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://statify-app.pages.dev"),
  title: {
    default: "Statify | Privacy-first web analytics",
    template: "%s | Statify",
  },
  description: "Privacy-first, self-hosted web analytics for understanding visitors, pages, referrers, and AI agent traffic.",
  keywords: ["privacy-first analytics", "web analytics", "self-hosted analytics", "Cloudflare analytics", "AI agent analytics"],
  authors: [{ name: "Statify contributors" }],
  creator: "Statify",
  publisher: "Statify",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Statify | Privacy-first web analytics",
    description: "Understand your website traffic without ads, dark patterns, or a warehouse full of personal data.",
    siteName: "Statify",
  },
  twitter: {
    card: "summary",
    title: "Statify | Privacy-first web analytics",
    description: "Self-hosted web analytics for the open web.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
