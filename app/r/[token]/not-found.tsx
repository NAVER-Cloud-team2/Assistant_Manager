import styles from "./page.module.css";

/** 결과 링크가 없거나, 지워졌거나, 30일이 지났을 때 — 담당: D. 어느 경우인지 구분해 알려주지 않는다. */
export default function ResultNotFound() {
  return (
    <main className={`page ${styles.result} ${styles.empty}`} id="main">
      <h1 className="title">결과를 찾을 수 없어요</h1>
      <p>링크가 잘못됐거나, 총무가 지웠거나, 확정 후 30일이 지나 사라졌어요.</p>
      <p className="note">총무에게 새 링크를 받아 주세요.</p>
    </main>
  );
}
