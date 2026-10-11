// Checks that private (NDA) text is NOT anywhere public: the repository, its git history, or the live website.
// Usage:  node tests/scan-leaks.mjs path/to/markers.txt [https://www.olgakalinina.me]
// markers.txt = one distinctive phrase per line, taken from the private project (keep this file in private-content/, which git ignores).
// A line starting with "i:" is matched ignoring upper/lower case (use it for names, e.g. "i:acme"). Phrases need at least 4 characters.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [, , markersFile, site] = process.argv;
if (!markersFile) { console.error('usage: node tests/scan-leaks.mjs markers.txt [site-url]'); process.exit(2); }
const raw = readFileSync(markersFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const markers = raw.map((l) => (l.startsWith('i:') ? l.slice(2) : l)).filter((m) => m.length >= 4);
const nocase = raw.map((l) => l.startsWith('i:')).filter((_, i) => (raw[i].startsWith('i:') ? raw[i].slice(2) : raw[i]).length >= 4);
const skipped = raw.length - markers.length;
if (skipped) console.log(`(skipped ${skipped} line(s) shorter than 4 characters)`);
if (!markers.length) { console.error('markers file has no usable lines (each marker needs 4+ characters)'); process.exit(2); }
const hay = (text, i) => (nocase[i] ? text.toLowerCase().includes(markers[i].toLowerCase()) : text.includes(markers[i]));
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
let found = 0;
const hit = (where, what, marker) => { found++; console.log(`FOUND  ${where}: ${what}   (phrase #${markers.indexOf(marker) + 1})`); };

console.log(`Scanning for ${markers.length} private phrase(s)\n`);

console.log('1. Files tracked in the repository (everything that would be published)');
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const textLike = /\.(html|css|js|mjs|json|md|txt|toml|sql|sh|svg|xml|yml|yaml)$|^\.gitignore$|^_headers$|^_redirects$/;
for (const f of tracked.filter((f) => textLike.test(f))) {
  let t; try { t = readFileSync(f, 'utf8'); } catch { continue; }
  markers.forEach((m, i) => { if (hay(t, i)) hit('repo file', f, m); });
}
console.log(found ? '' : '   none found');

console.log('2. Git history (a deleted file is still public in the history of a public repo)');
const before = found;
for (const [i, m] of markers.entries()) {
  const out = (nocase[i] ? git('log', '--all', '--oneline', '-i', '-G', m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : git('log', '--all', '--oneline', '-S', m)).trim();
  if (out) for (const line of out.split('\n')) hit('git history', line, m);
}
if (found === before) console.log('   none found');

if (site) {
  console.log(`3. The live website (${site})`);
  const b = found, base = site.replace(/\/$/, '');
  const pages = tracked.filter((f) => textLike.test(f) && !f.startsWith('functions/'));
  for (const f of pages) {
    for (const url of [f, f.replace(/\.html$/, '')]) {
      let res; try { res = await fetch(`${base}/${url}`, { redirect: 'follow' }); } catch { continue; }
      if (!res.ok) continue; const t = await res.text();
      markers.forEach((m, i) => { if (hay(t, i)) hit('live site', `/${url}`, m); });
    }
  }
  for (const p of ['/p/un-escap-risk-portal', '/p/b2c-fitnesstech', '/p/digital-assets-management', '/api/access?slug=un-escap-risk-portal', '/robots.txt']) {
    const res = await fetch(base + p, { redirect: 'follow' }); const t = await res.text();
    markers.forEach((m, i) => { if (hay(t, i)) hit('live site (no login)', p, m); });
  }
  if (found === b) console.log(`   none found (checked ${pages.length} files, the locked project pages and the API without a login)`);
}
console.log(found ? `\n${found} PROBLEM(S) FOUND: do not send codes until these are removed.` : '\nCLEAN: none of the private phrases appear in public places.');
process.exit(found ? 1 : 0);
