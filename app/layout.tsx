import type { Metadata } from 'next';
import { AppProvider } from '@/lib/context';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';

export const metadata: Metadata = {
  title: 'HRIS Widy — Human Resource Information System',
  description: 'Sistem Informasi Sumber Daya Manusia — Absensi, Karyawan, Lembur, dan Laporan',
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
