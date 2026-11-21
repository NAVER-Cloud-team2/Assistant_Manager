import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // infra/Dockerfile에서 standalone 결과물만 복사해 가볍게 띄운다.
  output: "standalone",
  async headers() {
    // 관리 링크(/m/…)와 결과 링크(/r/…)의 토큰이 다른 사이트로 새지 않게 한다.
    const noLeak = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/m/:path*", headers: noLeak },
      { source: "/r/:path*", headers: noLeak },
    ];
  },
};

export default nextConfig;
