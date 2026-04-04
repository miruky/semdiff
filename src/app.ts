import { diffJson, diffStats, type DiffNode, type Json } from './lib/diff';

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

const LOGO_SVG = `
<svg viewBox="0 0 64 64" width="44" height="44" role="img" aria-label="semdiffのロゴ">
  <title>semdiff</title>
  <rect x="8" y="12" width="20" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="4"/>
  <rect x="36" y="12" width="20" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="4"/>
  <path d="M14 24h8M14 32h8" stroke="#8fd18a" stroke-width="3" stroke-linecap="round"/>
  <path d="M42 28h8M42 36h8M42 44h8" stroke="#ff8a76" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const KIND_LABELS = { added: '追加', removed: '削除', changed: '変更', unchanged: '' } as const;

function short(value: Json | undefined): string {
  if (value === undefined) return '';
  const text = JSON.stringify(value);
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
}

export class App {
  private readonly el: Record<string, HTMLElement> = {};
  private hideUnchanged = true;

  constructor(private readonly root: HTMLElement) {
    this.render();
    this.wire();
    this.update();
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="site-header">
        <span class="logo" aria-hidden="true">${LOGO_SVG}</span>
        <div>
          <h1>semdiff</h1>
          <p class="tagline">JSONを構造単位で比較する意味的diff。キー順序の違いに惑わされない</p>
        </div>
      </header>
      <main>
        <section class="inputs">
          <div class="pane">
            <div class="pane-head">
              <h2>変更前</h2>
              <button type="button" class="ghost-btn" data-id="sample">サンプルを読み込む</button>
            </div>
            <textarea data-id="before" rows="12" spellcheck="false" placeholder="変更前のJSON"></textarea>
            <p class="parse-error" data-id="error-before" hidden></p>
          </div>
          <div class="pane">
            <div class="pane-head">
              <h2>変更後</h2>
              <button type="button" class="ghost-btn" data-id="swap">入れ替え</button>
            </div>
            <textarea data-id="after" rows="12" spellcheck="false" placeholder="変更後のJSON"></textarea>
            <p class="parse-error" data-id="error-after" hidden></p>
          </div>
        </section>
        <section class="pane">
          <div class="pane-head">
            <h2>構造diff</h2>
            <span class="head-tools">
              <span class="stats" data-id="stats"></span>
              <label class="opt"><input type="checkbox" data-id="hide-unchanged" checked> 変更のない項目を畳む</label>
            </span>
          </div>
          <div class="tree" data-id="tree">(両側にJSONを貼ると差分が表示される)</div>
        </section>
      </main>
      <footer class="site-footer">
        <p>テキストの行ではなく値の構造を比較する。キーの並び替えと整形の違いは差分にならず、配列はLCSで対応付けるため途中への挿入が後続の変更として誤検出されない。比較はすべてブラウザ内で行う。</p>
      </footer>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      this.el[node.dataset.id ?? ''] = node;
    });
  }

  private wire(): void {
    const before = this.el['before'] as HTMLTextAreaElement;
    const after = this.el['after'] as HTMLTextAreaElement;
    before.addEventListener('input', () => this.update());
    after.addEventListener('input', () => this.update());
    this.el['sample']!.addEventListener('click', () => {
      before.value = SAMPLE_BEFORE;
      after.value = SAMPLE_AFTER;
      this.update();
    });
    this.el['swap']!.addEventListener('click', () => {
      [before.value, after.value] = [after.value, before.value];
      this.update();
    });
    this.el['hide-unchanged']!.addEventListener('change', () => {
      this.hideUnchanged = (this.el['hide-unchanged'] as HTMLInputElement).checked;
      this.update();
    });
  }

  private parseSide(id: 'before' | 'after'): Json | undefined {
    const text = (this.el[id] as HTMLTextAreaElement).value;
    const error = this.el[`error-${id}`]!;
    if (text.trim() === '') {
      error.hidden = true;
      return undefined;
    }
    try {
      const value = JSON.parse(text) as Json;
      error.hidden = true;
      return value;
    } catch (cause) {
      error.textContent = `JSONとして読めない: ${(cause as Error).message}`;
      error.hidden = false;
      return undefined;
    }
  }

  private update(): void {
    const before = this.parseSide('before');
    const after = this.parseSide('after');
    const tree = this.el['tree']!;
    const stats = this.el['stats']!;
    if (before === undefined || after === undefined) {
      tree.textContent = '(両側にJSONを貼ると差分が表示される)';
      stats.textContent = '';
      return;
    }

    const root = diffJson(before, after);
    const counts = diffStats(root);
    stats.innerHTML = `
      <span class="stat stat-added">+${counts.added}</span>
      <span class="stat stat-removed">-${counts.removed}</span>
      <span class="stat stat-changed">~${counts.changed}</span>`;

    tree.innerHTML = '';
    if (root.kind === 'unchanged') {
      tree.textContent = '差分なし。2つのJSONは意味的に同一';
      return;
    }
    tree.appendChild(this.renderNode(root, true));
  }

  private renderNode(node: DiffNode, isRoot = false): HTMLElement {
    if (node.children.length === 0) {
      const row = document.createElement('div');
      row.className = `row row-${node.kind}`;
      const valueHtml =
        node.kind === 'changed'
          ? `<s>${short(node.before)}</s> <span class="to">→</span> ${short(node.after)}`
          : short(node.kind === 'removed' ? node.before : node.after);
      row.innerHTML = `
        <span class="row-kind">${KIND_LABELS[node.kind]}</span>
        <code class="row-path">${node.path === '' ? node.label : node.path}</code>
        <span class="row-value">${valueHtml}</span>`;
      return row;
    }

    const visible = this.hideUnchanged
      ? node.children.filter((c) => c.kind !== 'unchanged')
      : node.children;
    const hidden = node.children.length - visible.length;

    const details = document.createElement('details');
    details.open = true;
    details.className = 'branch';
    const summary = document.createElement('summary');
    summary.innerHTML =
      `<code>${isRoot ? '(ルート)' : node.label}</code>` +
      (hidden > 0 ? `<span class="hidden-note">変更なし${hidden}件を省略</span>` : '');
    details.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'branch-body';
    for (const child of visible) body.appendChild(this.renderNode(child));
    details.appendChild(body);
    return details;
  }
}
