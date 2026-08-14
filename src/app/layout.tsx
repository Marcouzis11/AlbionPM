import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { themeAttribute } from "@/lib/theme";
import { readTheme } from "@/lib/theme-server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITULO = "AlbionPM, gestor de partys para Albion Online";
const DESCRIPCION =
  "Armá composiciones, guardalas como plantillas y compartilas. Tu gremio abre un link y ve qué build le toca, en qué grupo va y quién es su líder.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  // Lo que se ve cuando alguien pega el link en Discord, que es exactamente
  // por donde circula esta herramienta.
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    type: "website",
    locale: "es_AR",
    siteName: "AlbionPM",
  },
  twitter: { card: "summary", title: TITULO, description: DESCRIPCION },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El tema se resuelve ANTES de pintar. Si esto se hiciera en el cliente,
  // cada carga mostraría un destello blanco antes de aplicar el modo oscuro.
  const theme = await readTheme();

  return (
    <html
      lang="es"
      data-theme={themeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
