import '../styles/globals.css';

export const metadata = {
  title: 'Computer Vision Components',
  description: 'Components',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="relative">{children}</body>
    </html>
  );
}