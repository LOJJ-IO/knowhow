import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Knohow",
  description:
    "Knohow helps organizations take control of Google Workspace files — team folders, sharing rules, ownership, and offboarding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
