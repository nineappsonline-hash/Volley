// Read-only checks against a running preview or production deployment.
// Usage: node scripts/check-discovery.mjs https://playza.life
// Add --all-sports to check every sport URL in the sitemap.
import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'http://localhost:3000').origin;
const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://playza.life';
async function get(path, agent = 'PlayzaDiscoveryCheck/1.0') {
  const response = await fetch(`${origin}${path}`, { headers: { 'User-Agent': agent }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${path}: expected 200, got ${response.status}`);
  assert.ok(!/noindex/i.test(response.headers.get('x-robots-tag') || ''), `${path}: X-Robots-Tag blocks indexing`);
  return response.text();
}
const robots = await get('/robots.txt');
assert.ok(robots.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`), 'Sitemap uses the wrong origin');
for (const agent of ['OAI-SearchBot', 'Google-Extended', 'Claude-SearchBot', 'PerplexityBot']) {
  const block = robots.split(/\n\s*\n/).find(block => block.includes(`User-Agent: ${agent}`));
  assert.ok(block && /Allow: \/(?:\r?\n|$)/.test(block), `${agent}: missing public access`);
}
const sitemap = await get('/sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1].replaceAll('&amp;', '&')));
const sports = urls.filter(url => /^\/(ar\/)?sports(?:\/|$)/.test(url.pathname));
assert.equal(sports.length, 56, 'Expected 27 sports plus an index, in two languages');
assert.ok(sports.every(url => url.origin === expectedOrigin), 'Sport URLs use the wrong origin');
assert.ok(!urls.some(url => /[?&]join=|\/(login|signup|dashboard)(\/|$)/.test(url.href)), 'Private/account URL in sitemap');
const paths = process.argv.includes('--all-sports') ? sports.map(url => url.pathname) : ['/sports', '/ar/sports', '/sports/padel', '/ar/sports/padel', '/sports/swimming', '/ar/sports/karate'];
for (const path of paths) {
  const html = await get(path, 'OAI-SearchBot');
  assert.ok(!/<meta\b[^>]*content="[^"]*noindex/i.test(html), `${path}: noindex`);
  assert.ok(html.includes(`rel="canonical" href="${expectedOrigin}${path}"`), `${path}: canonical missing`);
  assert.ok(html.includes('hrefLang="ar-EG"') || html.includes('hreflang="ar-EG"'), `${path}: Arabic alternate missing`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: expected a single H1`);
  assert.ok(html.includes(`lang="${path.startsWith('/ar/') ? 'ar' : 'en'}"`), `${path}: language missing`);
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)];
  assert.ok(scripts.length, `${path}: structured data missing`);
  scripts.forEach(match => JSON.parse(match[1]));
  console.log(`PASS ${path}: crawlable HTML, canonical, language links and JSON-LD`);
}
const llms = await get('/llms.txt');
assert.ok(llms.includes('/sports/parkour') && llms.includes('/ar/sports/football'), 'Incomplete machine-readable directory');
console.log(`PASS sitemap: ${sports.length} bilingual discovery pages; search/AI crawler rules; llms.txt`);
