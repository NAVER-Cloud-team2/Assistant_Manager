import { AppIcon, IconLink } from "@/components/icons";
import styles from "./page.module.css";

/** 결과 링크가 없거나, 지워졌거나, 30일이 지났을 때 — 담당: D. 어느 경우인지 구분해 알려주지 않는다. */
export default function ResultNotFound() {
  return (
    <main className={`screen ${styles.empty}`} id="main">
      <div className="column">
        <p className={styles.mark} translate="no">
          <AppIcon />
          대리총무
        </p>
        <IconLink className={styles.emptyIcon} />
        <h1 className={styles.emptyTitle}>결과를 찾을 수 없어요</h1>
        <p>링크가 잘못됐거나, 총무가 지웠거나, 확정 후 30일이 지나 사라졌어요.</p>
        <p className="muted">총무에게 새 링크를 받아 주세요.</p>
      </div>
    </main>
  );
}
