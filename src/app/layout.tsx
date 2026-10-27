import type { Metadata } from "next";
import { Arvo, Mulish } from "next/font/google";
import "./globals.css";

const arvo = Arvo({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-arvo",
  display: "swap",
});

const mulish = Mulish({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-mulish",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Páramo Snacks · CRM",
  description: "CRM comercial interno de Páramo Snacks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <body className={`${arvo.variable} ${mulish.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("paramo-crm-tema")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
