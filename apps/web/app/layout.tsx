import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://statify-app.pages.dev"),
  title: {
    default: "Statify | Privacy-first analytics for human and AI agent traffic",
    template: "%s | Statify",
  },
  description: "Privacy-first, self-hosted analytics for understanding human visitors, AI agents, crawlers, pages, and referrers on your website.",
  keywords: ["privacy-first analytics", "web analytics", "self-hosted analytics", "AI agent tracking", "AI crawler analytics", "Cloudflare analytics"],
  authors: [{ name: "Statify contributors" }],
  creator: "Statify",
  publisher: "Statify",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Statify | Privacy-first analytics for human and AI agent traffic",
    description: "Understand human visitors and AI agent activity on your website without ads, dark patterns, or a warehouse full of personal data.",
    siteName: "Statify",
  },
  twitter: {
    card: "summary",
    title: "Statify | Privacy-first analytics for human and AI agent traffic",
    description: "Self-hosted analytics for human visitors, AI agents, and crawlers on the open web.",
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
