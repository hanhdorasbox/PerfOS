import type { Metadata } from "next";
import "./globals.css";
import NavLinks from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "PerfOS — Performance Operating System",
  description: "Strategic performance command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#050506', minHeight: '100vh' }}>
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(5,5,6,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '0 24px', display: 'flex', alignItems: 'center', gap: '4px', height: '52px', overflow: 'visible'
        }}>
          <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.03em', marginRight: '16px' }}>PerfOS</span>
          <NavLinks />
        </nav>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 80px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
