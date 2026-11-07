import { cp, mkdir, rm, readdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of await readdir('dist')) await rm(`dist/${name}`, { recursive: true, force: true });
for (const path of ['index.html', 'styles.css', 'src', 'fonts', 'vendor', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
console.log('Built dependency-free static site in dist/');
