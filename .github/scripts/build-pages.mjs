import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('login');
const output = path.resolve('_site');
fs.mkdirSync(output, { recursive: true });
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && /\.(html|css|js)$/.test(entry.name)) {
    fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  }
}
for (const name of ['admin', 'auth', 'clients', 'dashboard', 'freelancers', 'landing', 'legal', 'support', 'assets']) {
  const source = path.join(root, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, name), { recursive: true });
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');
for (const entry of ['index.html', 'auth/login.html', 'auth/register.html', 'landing/index.html']) {
  if (!fs.existsSync(path.join(output, entry))) throw new Error(`Missing website entry: ${entry}`);
}
console.log('Website files prepared in _site');
