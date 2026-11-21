/** 아직 만들지 않은 화면 자리 표시 — 담당: C (화면을 만들면 이 컴포넌트를 지운다) */
export function Placeholder({ code, title, owner, todo }: { code: string; title: string; owner: string; todo: string[] }) {
  return (
    <main className="placeholder">
      <p className="code">
        {code} · 담당 {owner}
      </p>
      <h1>{title}</h1>
      <ul>
        {todo.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="hint">구현계획서 3장 참고 · 가짜 모드(MOCK_AI=1, STORE=memory)에서는 기준 예시 데이터가 나온다.</p>
    </main>
  );
}
