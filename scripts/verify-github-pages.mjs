import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const output = fileURLToPath(new URL('../out/', import.meta.url));
const source = fileURLToPath(new URL('../public/', import.meta.url));
const prefix = '/kumovya-clicker';
const html = readFileSync(path.join(output, 'index.html'), 'utf8');

assert.match(html, /Кумовья/);
assert.match(html, /Гопон Миша/);
assert.match(html, /Авторитет на корточках/);
assert.ok(html.includes(`${prefix}/game/gopon-misha.png`), 'Misha must be present in the exported roster.');
assert.ok(!/Кум Гоша|Гаражный экономист|kum-gosha\.png/.test(html), 'The retired accountant must not remain in the game.');
assert.match(html, /telegram\.org\/js\/telegram-web-app\.js/);
assert.match(html, /https:\/\/assaboud-commits\.github\.io\/kumovya-clicker\/og\.png/);
assert.ok(!html.includes('chatgpt.site'), 'Old hosting URL must not remain in the export.');
assert.ok(!/(?:src|href)=["']\/(?:game|_next)\//.test(html), 'A static asset is missing the repository prefix.');
assert.ok(statSync(path.join(output, '.nojekyll')).isFile());

const artwork = readdirSync(path.join(source, 'game')).map((name) => `game/${name}`);
artwork.push('og.png');
for (const relative of artwork) {
  assert.deepEqual(readFileSync(path.join(output, relative)), readFileSync(path.join(source, relative)), `${relative}: exported bytes must match the original asset.`);
  assert.ok(html.includes(`${prefix}/${relative}`), `${relative}: prefixed URL must appear in the HTML.`);
}

assert.deepEqual(readFileSync(path.join(output, 'bot-avatar.png')), readFileSync(path.join(source, 'bot-avatar.png')), 'The downloadable bot avatar must be included unchanged.');

const referencedAssets = [...html.matchAll(/(?:src|href)=["'](\/kumovya-clicker\/[^"']+)["']/g)];
for (const [, url] of referencedAssets) {
  const relative = decodeURIComponent(url.slice(prefix.length + 1).split('?')[0]);
  assert.ok(statSync(path.join(output, relative)).isFile(), `Missing static asset: ${relative}`);
}
console.log(`GitHub Pages export verified: ${artwork.length} images, ${referencedAssets.length} local asset references, Telegram SDK and social preview.`);
