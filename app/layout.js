import './globals.css';

const title = 'Kepto — your digital second brain';
const description = 'Save anything — a link, a thought, an image, a voice memo. Kepto reads it, remembers it, and hands it back when you describe it in plain words.';

export const metadata = {
  title,
  description,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title,
    description,
    type: 'website',
    siteName: 'Kepto',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export const viewport = {
  themeColor: '#07070a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;450;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
