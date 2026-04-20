import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sonora — AI Music Studio",
  description: "Describe the music you want. Our AI composes it for you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {/* Background glows */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-48 left-1/3 w-[600px] h-[600px] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-72 -right-24 w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
