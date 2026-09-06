import fs from 'fs';
import path from 'path';

const indexPath = path.resolve('dist/index.html');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf-8');
  content = content.replace(/<link rel="manifest"[^>]*>/gi, '');
  fs.writeFileSync(indexPath, content);
  console.log('Removed manifest link from dist/index.html');
}
