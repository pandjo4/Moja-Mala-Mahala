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
  assert.equal((client.match(/\"id\":\"(?:cottage|farm|kiln|workshop|market|watchtower|library|fountain)\"/g)||[]).length,8);
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
  assert.match(client,/Najveći graditelj|Najraznovrsniji grad/);
  assert.match(client,/Najraznovrsniji grad/);
});


test('Biblioteka je jedini recept od 4 materijala, Fontana koristi 2',()=>{
  const client=read('public/script.js');
  const match=client.match(/const BUILDINGS=(\[[\s\S]*?\]);/);
  assert.ok(match,'Nedostaje definicija građevina');
  const buildings=JSON.parse(match[1]);
  assert.equal(buildings.length,8);
  const counts=buildings.map(b=>[b.id,Object.values(b.recipe).reduce((a,n)=>a+n,0)]);
  assert.deepEqual(counts.find(x=>x[0]==='library'),['library',4]);
  assert.deepEqual(counts.find(x=>x[0]==='fountain'),['fountain',2]);
  assert.equal(counts.filter(x=>x[1]===4).length,1);
});
test('server prihvata povezani recept od 2 i 4 materijala',()=>{
  const server=read('server.js');
  const helper=server.match(/function connectedGroup\(selected\) \{[\s\S]*?\n\}/)?.[0];
  const recipe=server.match(/function recipeMatches\(board, selected, b\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(helper&&recipe);
  const context={};
  vm.runInNewContext(`${helper}\n${recipe}\nthis.check=recipeMatches;`,context);
  const board=Array(16).fill(null);
  board[0]={type:'resource',material:'wood'};board[1]={type:'resource',material:'stone'};
  assert.equal(context.check(board,[0,1],{recipe:{wood:1,stone:1}}),true);
  board[0]={type:'resource',material:'brick'};board[1]={type:'resource',material:'brick'};
  board[2]={type:'resource',material:'stone'};board[3]={type:'resource',material:'stone'};
  assert.equal(context.check(board,[0,1,2,3],{recipe:{brick:2,stone:2}}),true);
  assert.equal(context.check(board,[0,1,2],{recipe:{brick:2,stone:2}}),false);
});


test('bonusi građevina računaju se prema novim pravilima',()=>{
  const server=read('server.js');
  const defs=JSON.parse(server.match(/const BUILDINGS = (\[[\s\S]*?\]);/)[1]);
  const neighbors=server.match(/function idxNeighbors\(i\) \{[\s\S]*?\n\}/)[0];
  const bonus=server.match(/function calcBuildingBonus\(board,i,b,final=false\) \{[\s\S]*?\n\}/)[0];
  const ctx={BUILDINGS:defs};
  vm.runInNewContext(`${neighbors}\n${bonus}\nthis.calc=calcBuildingBonus;`,ctx);
  const b=id=>defs.find(x=>x.id===id);
  let board=Array(16).fill(null);
  board[1]={type:'building',buildingId:'farm'};
  board[4]={type:'building',buildingId:'farm'};
  board[6]={type:'building',buildingId:'watchtower'};
  board[9]={type:'building',buildingId:'kiln'};
  assert.equal(ctx.calc(board,5,b('cottage')),3);
  assert.equal(ctx.calc(board,5,b('farm')),4);
  assert.equal(ctx.calc(board,0,b('watchtower')),2);
  board=Array(16).fill(null);board[4]={type:'building',buildingId:'workshop'};
  assert.equal(ctx.calc(board,5,b('kiln')),1);
  board=Array(16).fill(null);board[1]={type:'building',buildingId:'kiln'};
  assert.equal(ctx.calc(board,5,b('workshop')),1);
  board=Array(16).fill(null);board[1]={type:'resource'};board[4]={type:'resource'};board[6]={type:'resource'};
  assert.equal(ctx.calc(board,5,b('market'),false),0);
  assert.equal(ctx.calc(board,5,b('market'),true),6);
  board=Array(16).fill(null);[0,1,2,4,6].forEach(i=>board[i]={type:'building',buildingId:'farm'});
  assert.equal(ctx.calc(board,5,b('library'),true),5);
  board=Array(16).fill(null);
  assert.equal(ctx.calc(board,5,b('fountain'),true),4);
});


test('dinamički pravilnik ne zaustavlja učitavanje ostatka interfejsa',()=>{
  const client=read('public/script.js');
  assert.match(client,/const originalShowRules=\$\('showRules'\)\.onclick/);
  assert.match(client,/const closeRules=\$\('closeRules'\);if\(closeRules\)closeRules\.onclick=closeModal/);
  assert.doesNotMatch(client,/\$\('closeRules'\)\.onclick=closeModal;\$\('backHome'\)/);
  assert.match(client,/socket\.on\('connect_error'/);
});
