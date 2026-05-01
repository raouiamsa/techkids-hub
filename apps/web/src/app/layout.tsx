import type { Metadata } from 'next';
import './global.css';
import { AuthProvider } from './contexts/auth.context';
import Navbar from './components/Navbar';

export const metadata: Metadata = {
  title: 'TechKids Hub',
  description: 'Plateforme éducative multi-services pour enfants',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

