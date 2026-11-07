import "./globals.css";
import Backdrop from "@/lib/Backdrop";
export const metadata = { title: "ChatFlow" };
const themeInit = `try{var t=localStorage.getItem("theme");if(t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body><Backdrop />{children}</body>
    </html>
  );
}
