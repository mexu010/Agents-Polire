import "./globals.css";
import "./motion.css";
import "./aura.css";
import "./aura-max.css";
import "./type-refine.css";
import "./transformation.css";
import "./enquiry.css";
export const metadata = {
  title: "POLIRE — We refine digital presence.",
  description: "POLIRE Digital Studio. Strategie, Design und Entwicklung für Schweizer Unternehmen."
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#f3f0e9" };
export default function RootLayout({ children }) {
  return <html lang="de"><body>{children}</body></html>;
}
