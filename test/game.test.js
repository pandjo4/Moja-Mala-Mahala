const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('projekat sadrži osnovne fajlove za Render', () => {
  for (const file of ['server.js','package.json','README.md','public/index.html','public/style.css','public/script.js'])
    assert.ok(fs.existsSync(path.join(root,file)), `Nedostaje ${file}`);
});
test('server koristi Express, Socket.IO i Render PORT', () => {
  const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(source,/require\('express'\)/);
  assert.match(source,/require\('socket\.io'\)/);
  assert.match(source,/process\.env\.PORT/);
  assert.match(source,/0\.0\.0\.0/);
});
test('klijent sadrži pet materijala i deset originalnih zgrada', () => {
  const source=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
  for(const material of ['wood','brick','stone','grain','crystal']) assert.ok(source.includes(`${material}:`));
  for(const id of ['cottage','farm','kiln','workshop','market','watchtower','library','sanctuary','fortress','obelisk']) assert.ok(source.includes(`id:'${id}'`));
});

test('završavanje kruga postoji u multiplayer serveru i klijentu', () => {
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const client=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
  assert.match(server,/socket\.on\('turn:done'/);
  assert.match(server,/doneThisRound/);
  assert.match(client,/I am done/);
  assert.match(client,/soloDone\(\)/);
});
test('bonus vodič i vizuelno označavanje dostupnih zgrada postoje', () => {
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const client=fs.readFileSync(path.join(root,'public/script.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/style.css'),'utf8');
  assert.match(html,/id="bonusHelp"/);
  assert.match(client,/Najveći graditelj/);
  assert.match(client,/available-\$\{can\}/);
  assert.match(css,/\.building-card\.available-true/);
});
