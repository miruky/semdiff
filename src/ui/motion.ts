// 控えめなモーション。すべて gsap.matchMedia で prefers-reduced-motion を尊重し、
// 動きを止めても最終状態は同じになるよう、要素は既定で可視・数値は先に確定させる。
import { gsap } from 'gsap';

const NO_MOTION = '(prefers-reduced-motion: no-preference)';
const mm = gsap.matchMedia();

// 読み込み時にマストヘッドと操作列を順に立ち上げる
export function playEntrance(scope: HTMLElement): void {
  mm.add(NO_MOTION, () => {
    const targets = scope.querySelectorAll('[data-enter]');
    if (targets.length === 0) return;
    gsap.from(targets, {
      y: 12,
      autoAlpha: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.07,
    });
  });
}

// 差分の再描画ごとに、葉の行をわずかに送らせて立ち上げる
export function revealRows(rows: Element[]): void {
  if (rows.length === 0) return;
  mm.add(NO_MOTION, () => {
    gsap.from(rows, {
      autoAlpha: 0,
      y: 4,
      duration: 0.32,
      ease: 'power1.out',
      stagger: { each: 0.014, amount: Math.min(0.5, rows.length * 0.014) },
      overwrite: 'auto',
    });
  });
}

// 件数を0から数え上げる。動きを止める設定では即座に最終値を表示する
export function countUp(el: HTMLElement, to: number): void {
  el.textContent = String(to);
  mm.add(NO_MOTION, () => {
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: to,
      duration: 0.5,
      ease: 'power1.out',
      onUpdate: () => {
        el.textContent = String(Math.round(proxy.v));
      },
      onComplete: () => {
        el.textContent = String(to);
      },
    });
  });
}
