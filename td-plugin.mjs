// @ts-check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * @param {import('typedoc-plugin-markdown').MarkdownApplication} app
 */
export function load(app) {
  const packagePath = fileURLToPath(
    new URL('./package.json', import.meta.url),
  );
  /** @type {{ name?: string, description?: string, version?: string }} */
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const title = pkg.name ?? '';
  const description = pkg.description ?? '';
  const version = pkg.version ?? '0.0.0';
  app.renderer.markdownHooks.on(
    'index.page.begin',
    () => `# ${title[0]?.toLocaleUpperCase()??''}${title?.slice(1)??''} - v${version}\n\n${description}\n\n`,
  );
  app.renderer.markdownHooks.on(
    'page.begin',
    (x) => `# ${x.partials.breadcrumbs().split('/').map(v => v.trim()).join('/')}\n\n`,
  );
}
