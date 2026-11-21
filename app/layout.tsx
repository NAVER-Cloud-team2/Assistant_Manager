import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

// 빌드할 때 내려받아 우리 서버에서 제공한다 (사용자 휴대폰이 구글 글꼴 서버에 접속하지 않는다)
const sans = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "대리총무",
  description: "흩어진 단톡 발언을, 근거가 붙은 정산표로",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={sans.variable}>
      <body>
        <a className="skip" href="#main">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
