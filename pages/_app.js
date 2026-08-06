import "../styles/globals.css";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { AppLayout } from "../components/layout/AppLayout";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export default function App({ Component, pageProps }) {
  return (
    <main className={plexArabic.className}>
      <AppLayout>
        <Component {...pageProps} />
      </AppLayout>
    </main>
  );
}
