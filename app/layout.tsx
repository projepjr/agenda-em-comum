import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Portal de Agendas Projep Jr.',
  description: 'Disponibilidades compartilhadas e reuniões sem conflito.',
  openGraph: {
    title: 'Portal de Agendas Projep Jr.',
    description: 'Cruze agendas e marque reuniões sem troca de mensagens.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f7f2',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={geist.variable}>{children}</body></html>;
}
