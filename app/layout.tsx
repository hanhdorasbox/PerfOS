import type { Metadata } from "next";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import Link from "next/link";
import QuickCapture from "@/components/QuickCapture";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Project Hanh — Performance Operating System",
  description: "Strategic performance command center",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await prisma.user.findFirst()

  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', overflowX: 'hidden' }}>
        <nav style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 28px',
          overflow: 'visible',
          background: 'rgba(11, 11, 15, 0.85)',
          backdropFilter: 'blur(28px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.3)',
        }}>
          <Link href="/" style={{
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '-0.025em',
            marginRight: 20,
            color: '#F5F5F7',
            textDecoration: 'none',
          }}>
            Project Hanh
          </Link>
          <NavLinks />
        </nav>
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 28px 100px', boxSizing: 'border-box', width: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
        {user && <QuickCapture userId={user.id} />}
      </body>
    </html>
  );
}
