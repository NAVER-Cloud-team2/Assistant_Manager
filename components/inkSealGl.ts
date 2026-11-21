/**
 * 인주 도장 셰이더 — 담당: C. 첫 화면(S1)의 스크롤 장면 끝에서만 쓴다.
 * three.js는 이 함수를 부를 때 처음 내려받는다(다른 화면의 묶음에 들어가지 않는다).
 * 계속 도는 애니메이션 루프는 없다. 진행도가 바뀔 때만 한 장 그린다.
 */

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uProgress;
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // 종이 결을 따라 가장자리가 살짝 번진다
    vec2 warp = vec2(fbm(vUv * 42.0), fbm(vUv * 42.0 + 7.3)) - 0.5;
    float mask = texture2D(uMap, vUv + warp * 0.012).r;

    // 도장은 한쪽이 먼저 닿는다: 세게 눌린 곳부터 인주가 묻는다
    float pressure = 1.0 - distance(vUv, vec2(0.38, 0.6)) * 0.9;
    float reach = uProgress * 1.6 - (1.0 - pressure) * 0.7 - fbm(vUv * 9.0) * 0.35;
    float pressed = smoothstep(0.0, 0.25, reach);

    // 인주 농도: 얼룩과, 덜 눌린 쪽의 마른 자리
    float density = mix(0.62, 1.0, fbm(vUv * 26.0 + 3.1));
    float dry = smoothstep(0.78, 0.9, noise(vUv * 150.0)) * (1.0 - pressure) * 0.9;

    gl_FragColor = vec4(uColor, mask * pressed * density * (1.0 - dry));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** 도장 그림(흰색 = 인주가 묻는 자리). 좌표는 components/Seal.tsx의 120 단위와 같다 */
async function drawMask(version: number, fontFamily: string): Promise<HTMLCanvasElement> {
  const size = 512;
  const k = size / 120;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");

  const font = (px: number) => `700 ${px * k}px ${fontFamily}`;
  try {
    await document.fonts.load(font(23), `대리총무확정${version}판`);
  } catch {
    // 글꼴을 못 불러오면 기기 글꼴로 그린다
  }

  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  g.fillStyle = g.strokeStyle = "#fff";

  for (const [r, w] of [
    [55, 4],
    [48.5, 1.4],
  ]) {
    g.lineWidth = w * k;
    g.beginPath();
    g.arc(60 * k, 60 * k, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = 1.8 * k;
  for (const y of [45, 77]) {
    g.beginPath();
    g.moveTo(13 * k, y * k);
    g.lineTo(107 * k, y * k);
    g.stroke();
  }

  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = font(23);
  g.fillText(`${version}판`, 60 * k, 69.5 * k);

  // 둥근 글자: 위쪽은 바깥을 향해, 아래쪽은 가운데를 향해 선다
  g.font = font(12.5);
  const arc = (text: string, radius: number, spacing: number, top: boolean) => {
    const step = (12.5 + spacing) / radius;
    [...text].forEach((ch, i) => {
      const a = (i - (text.length - 1) / 2) * step;
      g.save();
      g.translate((60 + radius * Math.sin(a)) * k, (60 + (top ? -1 : 1) * radius * Math.cos(a)) * k);
      g.rotate(top ? a : -a);
      g.fillText(ch, 0, 0);
      g.restore();
    });
  };
  arc("대리총무", 33, 2, true);
  arc("확정", 43, 6, false);
  return canvas;
}

export interface InkSealGl {
  /** 0 = 아직 안 찍힘, 1 = 다 찍힘 */
  render(progress: number): void;
  dispose(): void;
}

/** WebGL을 못 쓰면 null (부르는 쪽이 SVG 도장을 그대로 둔다) */
export async function createInkSeal(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  version: number,
  onLost: () => void,
): Promise<InkSealGl | null> {
  const THREE = await import("three");

  let renderer: InstanceType<typeof THREE.WebGLRenderer>;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  const size = host.clientWidth || 104;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);

  const map = new THREE.CanvasTexture(await drawMask(version, getComputedStyle(host).fontFamily));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    uniforms: {
      uMap: { value: map },
      uProgress: { value: 1 },
      uColor: { value: new THREE.Color(0xdd3b26) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();

  let alive = true;
  const lost = (e: Event) => {
    e.preventDefault();
    alive = false;
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);

  return {
    render(progress) {
      if (!alive) return;
      material.uniforms.uProgress.value = progress;
      renderer.render(scene, camera);
    },
    dispose() {
      alive = false;
      canvas.removeEventListener("webglcontextlost", lost);
      map.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
}
