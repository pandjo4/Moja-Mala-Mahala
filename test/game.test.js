const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

test('projekat sadrži osnovne fajlove za Render', () => {
  for (const file of ['server.js','package.json','README.md','public/index.html','public/style.css','public/script.js'])
    assert.ok(fs.existsSync(path.join(root,file)), `Nedostaje ${file}`);
});
test('server koristi Express, Socket.IO i Render PORT', () => {
  const source=read('server.js');
  assert.match(source,/require\('express'\)/);
  assert.match(source,/require\('socket\.io'\)/);
  assert.match(source,/process\.env\.PORT/);
  assert.match(source,/0\.0\.0\.0/);
});
test('igra koristi tri materijala i osam građevina', () => {
  const client=read('public/script.js');
  const server=read('server.js');
  for(const material of ['wood','brick','stone']) assert.ok(client.includes(`${material}:`));
  assert.equal((client.match(/\{id:'(?:cottage|farm|kiln|workshop|market|watchtower|library|fortress)'/g)||[]).length,8);
  assert.match(server,/const MATERIALS = \['wood','brick','stone'\]/);
});
test('recepti zahtijevaju povezanu grupu materijala na klijentu i serveru',()=>{
  const client=read('public/script.js'),server=read('server.js');
  assert.match(client,/return connectedGroup\(selected\)/);
  assert.match(server,/return connectedGroup\(selected\)/);
  for (const source of [client,server]) {
    const helper=source.match(/function connectedGroup\([\s\S]*?\n\}/)?.[0];
    assert.ok(helper,'Nedostaje provjera povezanosti');
    const connected=vm.runInNewContext(`(${helper.replace('function connectedGroup','function')})`);
    assert.equal(connected([0,1,3]),false,'Polja 1, 2 i 4 ne smiju formirati recept');
    assert.equal(connected([0,1,5]),true,'Polja 1, 2 i 6 čine povezanu grupu');
    assert.equal(connected([0,1,4]),true,'Polja 1, 2 i 5 čine povezanu grupu');
  }
});
test('lista građevina ostaje vidljiva i prikazuje recepte i bonuse',()=>{
  const client=read('public/script.js'),css=read('public/style.css');
  assert.match(client,/BUILDINGS\.map\(b=>/);
  assert.match(client,/building-recipe/);
  assert.match(client,/b\.desc/);
  assert.match(css,/\.building-card\.available-true/);
});
test('tabla prikazuje brojeve polja 1–16',()=>{ const c=read('public/script.js'); assert.match(c,/cell-number/); assert.match(c,/i\+1/); });
test('završavanje kruga i reset su povezani',()=>{
  const server=read('server.js'),client=read('public/script.js');
  assert.match(server,/socket\.on\('turn:done'/);
  assert.match(client,/I am done/);
  assert.match(client,/socket\.emit\('room:leave'\)/);
});
test('vodič prikazuje posebne bonuse i završne nagrade',()=>{
  const client=read('public/script.js');
  assert.match(client,/showBonusHelp/);
  assert.match(client,/Najveći graditelj/);
  assert.match(client,/Najraznovrsniji grad/);
});
