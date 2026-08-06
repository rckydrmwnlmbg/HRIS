import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { AppProvider } from '@/lib/context';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HRIS TMNB — Human Resource Management System',
  description: 'Sistem Manajemen Sumber Daya Manusia Terintegrasi — Kehadiran, Kepegawaian, Lembur, dan Rekapitulasi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${outfit.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className={outfit.className}>
        <AppProvider>
          <NextTopLoader color="#0ea5e9" showSpinner={false} height={2.5} />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
