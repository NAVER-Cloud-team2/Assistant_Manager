import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 애플 기기는 기본 글꼴(SF·애플 산돌고딕 Neo)로 보이고, 다른 기기는 결이 비슷한 Inter(숫자·영문)와 Noto Sans KR(한글)로 보인다.
// 빌드할 때 내려받아 우리 서버에서 제공한다 (사용자 휴대폰이 구글 글꼴 서버에 접속하지 않는다)
const inter = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-inter",
});
const noto = Noto_Sans_KR({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "대리총무",
  description: "흩어진 단톡 발언을, 근거가 붙은 정산표로",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f2f7",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${noto.variable}`}>
      <body>
        <a className="skip" href="#main">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
