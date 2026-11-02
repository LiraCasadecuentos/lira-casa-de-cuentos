// Publica la app en GitHub Pages.
// Arma la versión final (carpeta dist) y la sube a la rama "gh-pages" del repositorio.
// GitHub Pages muestra lo que hay en esa rama.
// Uso: npm run publicar

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
const out = (cmd) => execSync(cmd).toString().trim();

const remote = out('git remote get-url origin');

console.log('1/3 Corriendo las pruebas…');
run('npx vitest run');

console.log('2/3 Armando la app…');
run('npx vite build');
writeFileSync('dist/.nojekyll', ''); // le dice a GitHub que publique los archivos tal cual

console.log('3/3 Subiendo a GitHub Pages…');
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run('git -c user.name="LiraCasadecuentos" -c user.email="LiraCasadecuentos@users.noreply.github.com" commit -q -m "Publicar app"', 'dist');
run(`git push -q --force "${remote}" gh-pages`, 'dist');

console.log('Listo. En uno o dos minutos la app nueva está publicada.');
