import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import Link from "next/link";
import QuickCapture from "@/components/QuickCapture";
import CommandPalette from "@/components/CommandPalette";
import MobileTabBar from "@/components/MobileTabBar";
import IdleLock from "@/components/IdleLock";
import { prisma } from "@/lib/db";

const lockEnabled = Boolean(
  process.env.APP_PIN && (process.env.APP_SESSION_SECRET || process.env.CRON_SECRET),
);

// App-wide font, self-hosted by Next (no CDN import). Exposed as a CSS variable
// the body font-family stack consumes in globals.css.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Project Hanh — Performance Operating System",
  description: "Strategic performance command center",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Project Hanh",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0C16",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The root layout wraps every route, so a DB call here runs during static
  // prerender (build) and on every request. Degrade to null when the database
  // is unreachable — the shell still renders; only QuickCapture is hidden —
  // instead of failing the build or 500ing the whole app on a Neon blip.
  const user = await prisma.user.findFirst().catch(() => null)

  return (
    <html lang="en" className={jakarta.variable}>
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
          <span className="hide-mobile" style={{
            marginLeft: 'auto', fontSize: 10, color: '#52525A',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5,
            padding: '2px 7px', flexShrink: 0, userSelect: 'none',
          }}>
            ⌘K
          </span>
        </nav>
        <CommandPalette />
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 28px 100px', boxSizing: 'border-box', width: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
        {user && <QuickCapture userId={user.id} />}
        <MobileTabBar />
        <IdleLock enabled={lockEnabled} />
      </body>
    </html>
  );
}
