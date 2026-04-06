import { diffJson, diffStats, type DiffNode, type Json } from './lib/diff';
import { parseInput, type Format } from './lib/parse';
import { toJsonPatch } from './lib/patch';
import { toMarkdown } from './lib/report';
import { decodeState, encodeState, type ShareState } from './lib/share';
import { caret, chevronDown, chevronUp, logoMark, monitor, moon, sun } from './ui/icons';
import { countUp, playEntrance, revealRows } from './ui/motion';

const SAMPLE_BEFORE = `{
  "name": "api-server",
  "version": "1.4.0",
  "dependencies": { "fastify": "^4.0.0", "pino": "^8.0.0" },
  "scripts": { "start": "node server.js", "test": "vitest run" },
  "tags": ["http", "backend", "production"]
}`;

const SAMPLE_AFTER = `{
  "version": "2.0.0",
  "name": "api-server",
  "dependencies": { "fastify": "^5.1.0", "zod": "^3.23.0" },
  "scripts": { "start": "node server.js", "test": "vitest run", "lint": "eslint ." },
  "tags": ["http", "graphql", "backend", "production"]
}`;

const STORAGE_KEY = 'semdiff-state';

type ThemeMode = 'light' | 'dark' | 'auto';
type ParseSide = { state: 'empty' | 'error' } | { state: 'ok'; value: Json };

function short(value: Json | undefined): string {
  if (value === undefined) return '';
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export class App {
  private readonly el: Record<string, HTMLElement> = {};
  private hideUnchanged = true;
  private filterText = '';
  private lastRoot: DiffNode | null = null;
  private toastTimer = 0;
  private changeRows: HTMLElement[] = [];
  private currentChange = -1;

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.cacheEls();
    this.restoreState();
    this.wire();
    this.updateThemeButtons();
    this.update();
    playEntrance(this.root);
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="app-shell">
        <header class="masthead">
          <div>
            <p class="masthead__kicker"><span class="masthead__mark">${logoMark}</span>意味的差分 / structural diff</p>
            <h1 class="masthead__title" data-enter>semdiff</h1>
            <p class="masthead__lede" data-enter>2つのJSON・YAML・TOMLを値の構造として突き合わせ、追加・削除・変更をパスつきで示す。キーの並び替えや整形の違いは差分にしない。</p>
          </div>
          <div class="controls" data-enter>
            <div class="seg" role="group" aria-label="配色テーマ">
              <button type="button" data-theme-opt="light" aria-label="明るい配色" title="明るい配色">${sun}</button>
              <button type="button" data-theme-opt="auto" aria-label="OSの設定に従う" title="OSの設定に従う">${monitor}</button>
              <button type="button" data-theme-opt="dark" aria-label="暗い配色" title="暗い配色">${moon}</button>
            </div>
          </div>
        </header>

        <main>
          <section class="spread" aria-label="比較する入力">
            <div class="editor">
              <div class="editor__head">
                <label class="editor__label" for="before"><b>変更前</b>before</label>
                <select class="fmt" data-id="fmt-before" aria-label="変更前の形式">
                  <option value="auto">自動判別</option>
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="toml">TOML</option>
                </select>
              </div>
              <textarea id="before" data-id="before" spellcheck="false" placeholder="変更前のJSON・YAML・TOML"></textarea>
              <p class="parse-error" data-id="error-before" role="alert" hidden></p>
            </div>
            <div class="editor">
              <div class="editor__head">
                <label class="editor__label" for="after"><b>変更後</b>after</label>
                <select class="fmt" data-id="fmt-after" aria-label="変更後の形式">
                  <option value="auto">自動判別</option>
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="toml">TOML</option>
                </select>
              </div>
              <textarea id="after" data-id="after" spellcheck="false" placeholder="変更後のJSON・YAML・TOML"></textarea>
              <p class="parse-error" data-id="error-after" role="alert" hidden></p>
            </div>
          </section>

          <div class="actions" data-enter>
            <button type="button" class="txt-btn" data-act="sample">サンプル</button>
            <button type="button" class="txt-btn" data-act="swap">入れ替え</button>
            <button type="button" class="txt-btn" data-act="share">共有リンク</button>
            <button type="button" class="txt-btn" data-act="copy-patch">JSON Patch</button>
            <button type="button" class="txt-btn" data-act="copy-md">Markdown</button>
            <button type="button" class="txt-btn" data-act="clear">消去</button>
          </div>

          <section class="results" aria-label="差分">
            <div class="results__head">
              <h2 class="results__title"><span class="kicker">差分</span>構造diff</h2>
              <div class="results__tools">
                <span class="stats" data-id="stats"></span>
                <span class="diffnav" data-id="diffnav" hidden>
                  <button type="button" class="navbtn" data-act="prev-change" aria-label="前の差分へ" title="前の差分 (p)">${chevronUp}</button>
                  <span class="diffnav__pos" data-id="navpos" aria-live="polite"></span>
                  <button type="button" class="navbtn" data-act="next-change" aria-label="次の差分へ" title="次の差分 (n)">${chevronDown}</button>
                </span>
                <input type="search" class="filter" data-id="filter" placeholder="パスで絞り込み" aria-label="パスで絞り込み">
                <label class="opt"><input type="checkbox" data-id="hide-unchanged" checked>変更なしを畳む</label>
                <button type="button" class="txt-btn" data-act="expand">すべて開く</button>
                <button type="button" class="txt-btn" data-act="collapse">すべて畳む</button>
              </div>
            </div>
            <div class="tree" data-id="tree"></div>
          </section>
        </main>

        <footer class="footer">
          <p>比較はすべてブラウザ内で完結し、貼られたデータは送信しない。共有リンクは入力をURLに符号化したもので、サーバーには保存されない。</p>
          <p class="shortcuts">
            <kbd>Alt</kbd>+<kbd>S</kbd> 入れ替え&ensp;<kbd>Alt</kbd>+<kbd>E</kbd> 例&ensp;<kbd>Alt</kbd>+<kbd>U</kbd> 畳む&ensp;<kbd>n</kbd>/<kbd>p</kbd> 差分送り&ensp;<kbd>/</kbd> 絞り込み
          </p>
        </footer>
      </div>
      <p class="sr-only" data-id="live" aria-live="polite"></p>
      <div class="toast" data-id="toast" role="status"></div>
    `;
  }

  private cacheEls(): void {
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
  }

  private ta(id: 'before' | 'after'): HTMLTextAreaElement {
    return this.el[id] as HTMLTextAreaElement;
  }

  private fmt(id: 'before' | 'after'): Format {
    return (this.el[`fmt-${id}`] as HTMLSelectElement).value as Format;
  }

  // ---- 状態の復元と保存 ----

  private restoreState(): void {
    const state = this.loadShareState() ?? this.loadStoredState();
    if (state) {
      this.ta('before').value = state.before;
      this.ta('after').value = state.after;
      (this.el['fmt-before'] as HTMLSelectElement).value = state.beforeFormat;
      (this.el['fmt-after'] as HTMLSelectElement).value = state.afterFormat;
      this.hideUnchanged = state.hideUnchanged;
      (this.el['hide-unchanged'] as HTMLInputElement).checked = state.hideUnchanged;
    }
  }

  private loadShareState(): ShareState | null {
    if (!location.hash) return null;
    return decodeState(location.hash);
  }

  private loadStoredState(): ShareState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ShareState>;
      if (typeof parsed.before !== 'string') return null;
      return {
        before: parsed.before,
        after: typeof parsed.after === 'string' ? parsed.after : '',
        beforeFormat: parsed.beforeFormat ?? 'auto',
        afterFormat: parsed.afterFormat ?? 'auto',
        hideUnchanged: parsed.hideUnchanged ?? true,
      };
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentState()));
    } catch {
      /* localStorageが使えなくても致命的でない */
    }
  }

  private currentState(): ShareState {
    return {
      before: this.ta('before').value,
      after: this.ta('after').value,
      beforeFormat: this.fmt('before'),
      afterFormat: this.fmt('after'),
      hideUnchanged: this.hideUnchanged,
    };
  }

  // ---- イベント結線 ----

  private wire(): void {
    this.ta('before').addEventListener('input', () => this.onInput());
    this.ta('after').addEventListener('input', () => this.onInput());
    this.el['fmt-before']!.addEventListener('change', () => this.onInput());
    this.el['fmt-after']!.addEventListener('change', () => this.onInput());

    this.el['hide-unchanged']!.addEventListener('change', () => {
      this.hideUnchanged = (this.el['hide-unchanged'] as HTMLInputElement).checked;
      this.persist();
      this.update();
    });

    this.el['filter']!.addEventListener('input', () => {
      this.filterText = (this.el['filter'] as HTMLInputElement).value.trim().toLowerCase();
      this.update();
    });

    this.root.querySelectorAll<HTMLElement>('[data-theme-opt]').forEach((btn) => {
      btn.addEventListener('click', () => this.setTheme(btn.dataset.themeOpt as ThemeMode));
    });

    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleAction(btn.dataset.act ?? ''));
    });

    document.addEventListener('keydown', (e) => this.onKeydown(e));
  }

  private onInput(): void {
    this.persist();
    this.update();
  }

  private onKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const editing =
      target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT' || target?.tagName === 'SELECT';

    if (e.key === '/' && !editing) {
      e.preventDefault();
      (this.el['filter'] as HTMLInputElement).focus();
      return;
    }
    if (e.key === 'Escape' && target === this.el['filter']) {
      (this.el['filter'] as HTMLInputElement).value = '';
      this.filterText = '';
      this.update();
      return;
    }
    if (!editing && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === 'n') {
        e.preventDefault();
        this.gotoChange(1);
        return;
      }
      if (e.key === 'p') {
        e.preventDefault();
        this.gotoChange(-1);
        return;
      }
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const map: Record<string, string> = {
      s: 'swap',
      e: 'sample',
      u: 'toggle-unchanged',
      l: 'share',
      p: 'copy-patch',
      m: 'copy-md',
    };
    const act = map[e.key.toLowerCase()];
    if (act) {
      e.preventDefault();
      this.handleAction(act);
    }
  }

  // ---- 操作 ----

  private handleAction(act: string): void {
    switch (act) {
      case 'sample':
        this.ta('before').value = SAMPLE_BEFORE;
        this.ta('after').value = SAMPLE_AFTER;
        (this.el['fmt-before'] as HTMLSelectElement).value = 'auto';
        (this.el['fmt-after'] as HTMLSelectElement).value = 'auto';
        this.onInput();
        break;
      case 'swap': {
        const b = this.ta('before');
        const a = this.ta('after');
        [b.value, a.value] = [a.value, b.value];
        const fb = this.el['fmt-before'] as HTMLSelectElement;
        const fa = this.el['fmt-after'] as HTMLSelectElement;
        [fb.value, fa.value] = [fa.value, fb.value];
        this.onInput();
        break;
      }
      case 'clear':
        this.ta('before').value = '';
        this.ta('after').value = '';
        this.onInput();
        break;
      case 'share':
        this.shareLink();
        break;
      case 'copy-patch':
        this.copyPatch();
        break;
      case 'copy-md':
        this.copyMarkdown();
        break;
      case 'toggle-unchanged': {
        const box = this.el['hide-unchanged'] as HTMLInputElement;
        box.checked = !box.checked;
        this.hideUnchanged = box.checked;
        this.persist();
        this.update();
        break;
      }
      case 'expand':
      case 'collapse':
        this.el['tree']!.querySelectorAll('details').forEach((d) => {
          (d as HTMLDetailsElement).open = act === 'expand';
        });
        break;
      case 'next-change':
        this.gotoChange(1);
        break;
      case 'prev-change':
        this.gotoChange(-1);
        break;
    }
  }

  // ---- 差分の移動 ----

  // 描画後に変更行を集め直す。絞り込みや畳みで表示が変わるたびに呼ぶ。
  private indexChanges(): void {
    const tree = this.el['tree']!;
    this.changeRows = [
      ...tree.querySelectorAll<HTMLElement>('.row--added, .row--removed, .row--changed'),
    ];
    this.currentChange = -1;
    const nav = this.el['diffnav']!;
    if (this.changeRows.length === 0) {
      this.clearChanges();
      return;
    }
    nav.hidden = false;
    this.el['navpos']!.textContent = `— / ${this.changeRows.length}`;
  }

  private clearChanges(): void {
    this.changeRows = [];
    this.currentChange = -1;
    this.el['diffnav']!.hidden = true;
    this.el['navpos']!.textContent = '';
  }

  // 前後の変更へ移る。端では巻き戻し、畳まれた親を開いて中央に送る。
  private gotoChange(delta: number): void {
    const n = this.changeRows.length;
    if (n === 0) return;
    this.currentChange =
      this.currentChange === -1 ? (delta > 0 ? 0 : n - 1) : (this.currentChange + delta + n) % n;
    this.changeRows.forEach((row, i) =>
      row.classList.toggle('is-current', i === this.currentChange),
    );
    const target = this.changeRows[this.currentChange]!;
    this.openAncestors(target);
    target.scrollIntoView({ block: 'center', behavior: this.motionOk() ? 'smooth' : 'auto' });
    this.el['navpos']!.textContent = `${this.currentChange + 1} / ${n}`;
  }

  private openAncestors(el: HTMLElement): void {
    let node = el.parentElement;
    while (node && node !== this.el['tree']) {
      if (node.tagName === 'DETAILS') (node as HTMLDetailsElement).open = true;
      node = node.parentElement;
    }
  }

  private motionOk(): boolean {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private shareLink(): void {
    const encoded = encodeState(this.currentState());
    const url = `${location.origin}${location.pathname}#${encoded}`;
    history.replaceState(null, '', url);
    void this.copy(url, '共有リンクをコピーした');
  }

  private bothValues(): { before: Json; after: Json } | null {
    const b = parseInput(this.ta('before').value, this.fmt('before'));
    const a = parseInput(this.ta('after').value, this.fmt('after'));
    if (!b.ok || !a.ok) return null;
    return { before: b.value, after: a.value };
  }

  private copyPatch(): void {
    const values = this.bothValues();
    if (!values) {
      this.toast('入力を直すとコピーできる');
      return;
    }
    const ops = toJsonPatch(values.before, values.after);
    if (ops.length === 0) {
      this.toast('差分が無い');
      return;
    }
    void this.copy(JSON.stringify(ops, null, 2), 'JSON Patchをコピーした');
  }

  private copyMarkdown(): void {
    if (!this.lastRoot) {
      this.toast('入力を直すとコピーできる');
      return;
    }
    void this.copy(toMarkdown(this.lastRoot), 'Markdownをコピーした');
  }

  private async copy(text: string, done: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        tmp.remove();
      }
      this.toast(done);
    } catch {
      this.toast('コピーできなかった');
    }
  }

  private toast(message: string): void {
    const el = this.el['toast']!;
    el.textContent = message;
    el.classList.add('is-shown');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('is-shown'), 1800);
  }

  // ---- テーマ ----

  private currentTheme(): ThemeMode {
    const set = document.documentElement.dataset.theme;
    return set === 'light' || set === 'dark' ? set : 'auto';
  }

  private setTheme(mode: ThemeMode): void {
    if (mode === 'auto') {
      delete document.documentElement.dataset.theme;
      try {
        localStorage.removeItem('semdiff-theme');
      } catch {
        /* 保存できなくてもテーマ自体は切り替わる */
      }
    } else {
      document.documentElement.dataset.theme = mode;
      try {
        localStorage.setItem('semdiff-theme', mode);
      } catch {
        /* 同上 */
      }
    }
    this.updateThemeButtons();
  }

  private updateThemeButtons(): void {
    const active = this.currentTheme();
    this.root.querySelectorAll<HTMLElement>('[data-theme-opt]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeOpt === active));
    });
  }

  // ---- 解析と描画 ----

  private parseSide(id: 'before' | 'after'): ParseSide {
    const text = this.ta(id).value;
    const error = this.el[`error-${id}`]!;
    if (text.trim() === '') {
      error.hidden = true;
      return { state: 'empty' };
    }
    const result = parseInput(text, this.fmt(id));
    if (result.ok) {
      error.hidden = true;
      return { state: 'ok', value: result.value };
    }
    error.textContent = result.error;
    error.hidden = false;
    return { state: 'error' };
  }

  private update(): void {
    const before = this.parseSide('before');
    const after = this.parseSide('after');
    const tree = this.el['tree']!;
    const stats = this.el['stats']!;

    if (before.state !== 'ok' || after.state !== 'ok') {
      this.lastRoot = null;
      stats.textContent = '';
      this.el['live']!.textContent = '';
      const empty = before.state === 'empty' || after.state === 'empty';
      this.showNote(
        empty ? '変更前・変更後の両方に貼ると差分が表示される。' : '入力を直すと差分が表示される。',
      );
      return;
    }

    const root = diffJson(before.value, after.value);
    this.lastRoot = root;
    const counts = diffStats(root);
    this.renderStats(counts);
    this.el['live']!.textContent =
      counts.added + counts.removed + counts.changed === 0
        ? '差分なし'
        : `追加${counts.added} 削除${counts.removed} 変更${counts.changed}`;

    tree.replaceChildren();
    const rendered = this.renderNode(root, true);
    if (!rendered) {
      this.showNote(
        this.filterText
          ? `「${this.filterText}」に一致するパスは無い。`
          : '差分なし。2つの入力は意味的に同一。',
      );
      return;
    }
    tree.appendChild(rendered);
    revealRows([...tree.querySelectorAll('.row')]);
    this.indexChanges();
  }

  private showNote(message: string): void {
    const note = document.createElement('p');
    note.className = 'note note--center';
    note.textContent = message;
    this.el['tree']!.replaceChildren(note);
    this.clearChanges();
  }

  private renderStats(counts: { added: number; removed: number; changed: number }): void {
    const stats = this.el['stats']!;
    stats.replaceChildren();
    const make = (cls: string, sign: string, label: string, n: number): void => {
      const span = document.createElement('span');
      span.className = `stat ${cls}`;
      span.title = label;
      span.append(sign);
      const num = document.createElement('span');
      num.className = 'stat__n';
      span.appendChild(num);
      stats.appendChild(span);
      countUp(num, n);
    };
    make('stat--added', '+', '追加', counts.added);
    make('stat--removed', '−', '削除', counts.removed);
    make('stat--changed', '~', '変更', counts.changed);
  }

  private isLeafVisible(node: DiffNode): boolean {
    if (this.filterText) return node.path.toLowerCase().includes(this.filterText);
    return !(this.hideUnchanged && node.kind === 'unchanged');
  }

  private renderNode(node: DiffNode, isRoot = false): HTMLElement | null {
    if (node.children.length === 0) {
      return this.isLeafVisible(node) ? this.buildRow(node) : null;
    }

    const childEls: HTMLElement[] = [];
    for (const child of node.children) {
      const el = this.renderNode(child);
      if (el) childEls.push(el);
    }
    if (childEls.length === 0) return null;

    const hiddenUnchanged =
      !this.filterText && this.hideUnchanged
        ? node.children.filter((c) => c.children.length === 0 && c.kind === 'unchanged').length
        : 0;

    const details = document.createElement('details');
    details.open = true;
    details.className = 'branch';

    const summary = document.createElement('summary');
    summary.className = 'branch__summary';
    summary.insertAdjacentHTML('afterbegin', caret);
    const key = document.createElement('span');
    key.className = 'branch__key';
    key.textContent = isRoot ? '(ルート)' : node.label;
    summary.appendChild(key);
    if (hiddenUnchanged > 0) {
      const note = document.createElement('span');
      note.className = 'branch__note';
      note.textContent = `変更なし${hiddenUnchanged}件`;
      summary.appendChild(note);
    }
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'branch__body';
    body.append(...childEls);
    details.appendChild(body);
    return details;
  }

  private buildRow(node: DiffNode): HTMLElement {
    const row = document.createElement('div');
    row.className = `row row--${node.kind}`;

    const sign = document.createElement('span');
    sign.className = 'row__sign';
    sign.setAttribute('aria-hidden', 'true');
    sign.textContent = node.kind === 'added' ? '+' : node.kind === 'removed' ? '−' : '~';
    row.appendChild(sign);

    const path = document.createElement('code');
    path.className = 'row__path';
    this.fillPath(path, node);
    row.appendChild(path);

    const value = document.createElement('span');
    value.className = 'row__value';
    if (node.kind === 'changed') {
      const del = document.createElement('del');
      del.textContent = short(node.before);
      const arrow = document.createElement('span');
      arrow.className = 'row__arrow';
      arrow.textContent = '→';
      value.append(del, arrow, document.createTextNode(short(node.after)));
    } else {
      value.textContent = short(node.kind === 'removed' ? node.before : node.after);
    }
    row.appendChild(value);
    return row;
  }

  // パスを描く。絞り込み中は一致部分を強調し、通常は末端のキーを太字にする。
  private fillPath(target: HTMLElement, node: DiffNode): void {
    const full = node.path === '' ? node.label : node.path;
    if (this.filterText) {
      this.appendHighlighted(target, full, this.filterText);
      return;
    }
    const label = node.label;
    if (full.endsWith(label) && full.length > label.length) {
      target.append(document.createTextNode(full.slice(0, full.length - label.length)));
      const leaf = document.createElement('b');
      leaf.textContent = label;
      target.appendChild(leaf);
    } else {
      const leaf = document.createElement('b');
      leaf.textContent = full;
      target.appendChild(leaf);
    }
  }

  private appendHighlighted(target: HTMLElement, text: string, query: string): void {
    const lower = text.toLowerCase();
    let from = 0;
    let at = lower.indexOf(query, from);
    while (at !== -1) {
      if (at > from) target.append(document.createTextNode(text.slice(from, at)));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + query.length);
      target.appendChild(mark);
      from = at + query.length;
      at = lower.indexOf(query, from);
    }
    if (from < text.length) target.append(document.createTextNode(text.slice(from)));
  }
}
