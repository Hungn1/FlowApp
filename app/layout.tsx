import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "ApplyFlow",
  description: "Save jobs, tailor materials, and track every application.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </div>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
