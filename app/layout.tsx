import type { Metadata } from 'next';
import { AppProvider } from '@/lib/context';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';

export const metadata: Metadata = {
  title: 'HRIS TMNB — Human Resource Management System',
  description: 'Sistem Manajemen Sumber Daya Manusia Terintegrasi — Kehadiran, Kepegawaian, Lembur, dan Rekapitulasi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AppProvider>
          <NextTopLoader color="#0ea5e9" showSpinner={false} height={3} />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
