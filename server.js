'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ['GET','POST'] } });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'MINI KINGDOM' }));

const MATERIALS = ['wood','brick','stone','grain','crystal'];
const BUILDINGS = [
  {id:'cottage',name:'Mirna kuća',icon:'⌂',color:'#d8a66b',points:2,recipe:{wood:2,grain:1},shape:'any',desc:'Pouzdan temelj grada. Donosi 1 dodatni bod ako je uz farmu.'},
  {id:'farm',name:'Zlatna farma',icon:'♧',color:'#a8bd61',points:2,recipe:{grain:2,wood:1},shape:'any',desc:'Poljoprivredno srce kraljevstva. Svaka farma vrijedi +1 ako dodiruje drugu farmu.'},
  {id:'kiln',name:'Crvena ciglana',icon:'▥',color:'#c96d5c',points:3,recipe:{brick:2,stone:1},shape:'line',desc:'Ako je u istom redu ili koloni s drugom ciglanom, dobija +1 bod.'},
  {id:'workshop',name:'Majstorska radionica',icon:'⚒',color:'#a98bca',points:3,recipe:{wood:1,brick:1,stone:1},shape:'any',desc:'Svaka radionica uz kuću donosi +1 bod.'},
  {id:'market',name:'Trgovački trg',icon:'◇',color:'#e0b84e',points:3,recipe:{grain:1,brick:1,crystal:1},shape:'adjacent',desc:'Dobija +1 bod za svaku susjednu različitu zgradu (najviše +2).'},
  {id:'watchtower',name:'Stražarska kula',icon:'♜',color:'#8295a8',points:4,recipe:{wood:1,brick:1,stone:1},shape:'L',desc:'Dobija +2 boda ako se nalazi u uglu ploče.'},
  {id:'library',name:'Kristalna biblioteka',icon:'✧',color:'#68a9d1',points:4,recipe:{crystal:2,wood:1},shape:'any',desc:'Dobija +1 bod za svaki kristalni objekat u istom redu ili koloni (najviše +2).'},
  {id:'sanctuary',name:'Šumsko svetište',icon:'❋',color:'#5eaa8a',points:4,recipe:{wood:1,grain:1,crystal:1},shape:'adjacent',desc:'Svaka susjedna farma donosi +1 bod.'},
  {id:'fortress',name:'Kamena utvrda',icon:'⬟',color:'#78818e',points:5,recipe:{brick:1,stone:2},shape:'L',desc:'Dobija +2 boda ako dodiruje najmanje dvije različite zgrade.'},
  {id:'obelisk',name:'Nebeski obelisk',icon:'♢',color:'#6b8ed4',points:5,recipe:{crystal:1,stone:1,grain:1},shape:'any',desc:'Dobija +1 bod za svaki drugi obelisk u gradu.'}
];
const rooms = new Map();
const cleanName = n => String(n || 'Igrač').trim().replace(/[<>]/g,'').slice(0,18) || 'Igrač';
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const clone = x => JSON.parse(JSON.stringify(x));
const emptyBoard = () => Array(16).fill(null);
const makePlayer = (id,name,token) => ({id,name,token,connected:true,ready:false,board:emptyBoard(),rewind:true,placedThisRound:false,builtThisRound:false,score:0,final:null});
function publicRoom(room, viewerId) {
  return {code:room.code,name:room.name,hostId:room.hostId,status:room.status,settings:room.settings,round:room.round,phase:room.phase,selectorId:room.selectorId,selectedMaterial:room.selectedMaterial,deadline:room.deadline,players:room.players.map(({token,...p})=>({...p})),buildings:BUILDINGS,viewerId};
}
function emitRoom(room) { io.to(room.code).emit('room:update', publicRoom(room)); }
function findRoom(socket) { return socket.data.roomCode && rooms.get(socket.data.roomCode); }
function error(socket,msg) { socket.emit('notice',{type:'error',message:msg}); }
function isHost(room,socket) { return room.hostId===socket.id; }
function idxNeighbors(i) { const r=Math.floor(i/4),c=i%4; return [r>0?i-4:-1,r<3?i+4:-1,c>0?i-1:-1,c<3?i+1:-1].filter(x=>x>=0); }
function recipeMatches(board, selected, b) {
  if (selected.length!==3 || new Set(selected).size!==3) return false;
  const cells=selected.map(i=>board[i]); if(cells.some(x=>!x || x.type!=='resource')) return false;
  const counts={}; cells.forEach(x=>counts[x.material]=(counts[x.material]||0)+1);
  const need=b.recipe;
  if(Object.keys(need).some(k=>(counts[k]||0)<need[k])) return false;
  const extras=Object.keys(counts).reduce((s,k)=>s+counts[k]-(need[k]||0),0);
  if(extras!==0) return false;
  if(b.shape==='line') { const rows=selected.map(i=>Math.floor(i/4)); const cols=selected.map(i=>i%4); if(!(rows.every(x=>x===rows[0])||cols.every(x=>x===cols[0]))) return false; }
  if(b.shape==='adjacent') { const seen=new Set([selected[0]]); let changed=true; while(changed){changed=false; for(const i of selected) if(!seen.has(i)&&selected.some(j=>seen.has(j)&&idxNeighbors(j).includes(i))){seen.add(i);changed=true;} } if(seen.size!==3)return false; }
  if(b.shape==='L') { const rs=selected.map(i=>Math.floor(i/4)),cs=selected.map(i=>i%4); const rspan=Math.max(...rs)-Math.min(...rs),cspan=Math.max(...cs)-Math.min(...cs); if(!(rspan===1&&cspan===1&&new Set(selected).size===3)) return false; }
  return true;
}
function calcBuildingBonus(board,i,b) {
  const near=idxNeighbors(i).map(j=>board[j]).filter(x=>x&&x.type==='building');
  if(b.id==='cottage' && near.some(x=>x.buildingId==='farm')) return 1;
  if(b.id==='farm' && near.some(x=>x.buildingId==='farm')) return 1;
  if(b.id==='kiln' && board.some((x,j)=>j!==i&&x?.buildingId==='kiln'&&(Math.floor(j/4)===Math.floor(i/4)||j%4===i%4))) return 1;
  if(b.id==='workshop' && near.some(x=>x.buildingId==='cottage')) return 1;
  if(b.id==='market') return Math.min(2,new Set(near.map(x=>x.buildingId)).size);
  if(b.id==='watchtower' && [0,3,12,15].includes(i)) return 2;
  if(b.id==='library') return Math.min(2,board.filter((x,j)=>x?.type==='building'&&['library','obelisk'].includes(x.buildingId)&&j!==i&&(Math.floor(j/4)===Math.floor(i/4)||j%4===i%4)).length);
  if(b.id==='sanctuary') return near.filter(x=>x.buildingId==='farm').length;
  if(b.id==='fortress' && new Set(near.map(x=>x.buildingId)).size>=2) return 2;
  if(b.id==='obelisk') return board.filter((x,j)=>j!==i&&x?.buildingId==='obelisk').length;
  return 0;
}
function finishGame(room) {
  clearTimeout(room.timer); room.status='finished'; room.phase='finished';
  const stats=room.players.map(p=>{const buildings=p.board.filter(x=>x?.type==='building'); const rows=Array.from({length:4},(_,r)=>p.board.slice(r*4,r*4+4).every(x=>x?.type==='building')).filter(Boolean).length; const cols=Array.from({length:4},(_,c)=>[0,1,2,3].every(r=>p.board[r*4+c]?.type==='building')).filter(Boolean).length; const types=new Set(buildings.map(x=>x.buildingId)).size; const farms=buildings.filter(x=>x.buildingId==='farm').length; const base=buildings.reduce((s,x)=>s+x.points+x.bonus,0); return {id:p.id,name:p.name,buildings:buildings.length,types,farms,rows,cols,base,rowPoints:rows,columnPoints:cols,builderAward:0,varietyAward:0,farmAward:0,score:base+rows+cols};});
  for(const key of ['buildings','types','farms']) {const max=Math.max(...stats.map(s=>s[key]));const winners=stats.filter(s=>s[key]===max); if(winners.length===1){const award=key==='farms'?2:3; winners[0].score+=award; winners[0][key==='buildings'?'builderAward':key==='types'?'varietyAward':'farmAward']=award;}}
  room.players.forEach(p=>{p.final=stats.find(s=>s.id===p.id);p.score=p.final.score;});
  io.to(room.code).emit('game:finished',{results:stats.sort((a,b)=>b.score-a.score),awards:['Najveći graditelj','Majstor arhitekture','Zeleni grad']});
}
function beginRound(room) {
  if(room.round>=room.settings.rounds){finishGame(room);return;}
  room.round++; room.phase='select'; room.selectedMaterial=null; room.players.forEach(p=>{p.placedThisRound=false;p.builtThisRound=false;});
  room.selectorIndex=(room.selectorIndex+1)%room.players.length; room.selectorId=room.players[room.selectorIndex].id;
  room.deadline=Date.now()+room.settings.seconds*1000;
  io.to(room.code).emit('round:start',{round:room.round,selectorId:room.selectorId,deadline:room.deadline}); emitRoom(room);
  clearTimeout(room.timer); room.timer=setTimeout(()=>{if(room.status==='playing'&&room.phase==='select') autoSelect(room); else if(room.status==='playing'&&room.phase==='place') autoPlace(room);},room.settings.seconds*1000);
}
function autoSelect(room){ if(room.phase!=='select')return; const mat=MATERIALS[Math.floor(Math.random()*MATERIALS.length)]; room.selectedMaterial=mat; room.phase='place'; room.deadline=Date.now()+room.settings.seconds*1000; io.to(room.code).emit('material:selected',{material:mat,by:room.selectorId,deadline:room.deadline}); emitRoom(room); clearTimeout(room.timer); room.timer=setTimeout(()=>autoPlace(room),room.settings.seconds*1000); }
function autoPlace(room){ if(room.phase!=='place')return; room.players.forEach(p=>{if(!p.placedThisRound){const i=p.board.findIndex(x=>!x); if(i>=0)p.board[i]={type:'resource',material:room.selectedMaterial}; p.placedThisRound=true;}}); io.to(room.code).emit('round:placements',{automatic:true}); afterPlacements(room); }
function afterPlacements(room){ room.phase='build'; room.deadline=Date.now()+room.settings.seconds*1000; room.players.forEach(p=>{p.builtThisRound=false;}); io.to(room.code).emit('build:phase',{deadline:room.deadline}); emitRoom(room); clearTimeout(room.timer); room.timer=setTimeout(()=>{room.players.forEach(p=>p.builtThisRound=true); nextIfDone(room);},room.settings.seconds*1000); }
function nextIfDone(room){if(room.players.every(p=>p.builtThisRound)){clearTimeout(room.timer);beginRound(room);}}

io.on('connection', socket=>{
  socket.on('room:create',(payload={})=>{
    let c=code(); while(rooms.has(c))c=code(); const player=makePlayer(socket.id,cleanName(payload.name),crypto.randomBytes(18).toString('hex'));
    const room={code:c,name:String(payload.roomName||'Malo kraljevstvo').slice(0,28),hostId:socket.id,players:[player],status:'lobby',phase:'lobby',round:0,selectorIndex:-1,selectorId:null,selectedMaterial:null,deadline:null,settings:{rounds:[10,15,20].includes(+payload.rounds)?+payload.rounds:15,seconds:[15,20,30,45,60].includes(+payload.seconds)?+payload.seconds:30},timer:null};
    rooms.set(c,room); socket.join(c);socket.data.roomCode=c;socket.emit('room:joined',{code:c,playerId:socket.id,token:player.token});emitRoom(room);
  });
  socket.on('room:join',({code:c,name}={})=>{const room=rooms.get(String(c||'').toUpperCase());if(!room)return error(socket,'Soba s tim kodom ne postoji.');if(room.status!=='lobby')return error(socket,'Partija je već počela.');if(room.players.length>=8)return error(socket,'Soba je popunjena (najviše 8 igrača).');const p=makePlayer(socket.id,cleanName(name),crypto.randomBytes(18).toString('hex'));room.players.push(p);socket.join(room.code);socket.data.roomCode=room.code;socket.emit('room:joined',{code:room.code,playerId:socket.id,token:p.token});emitRoom(room);});
  socket.on('room:reconnect',({code:c,token}={})=>{const room=rooms.get(String(c||'').toUpperCase());if(!room||!token)return error(socket,'Nije moguće pronaći prethodnu sesiju.');const p=room.players.find(x=>x.token===token);if(!p)return error(socket,'Sesija više nije dostupna.');const oldId=p.id;p.id=socket.id;p.connected=true;socket.join(room.code);socket.data.roomCode=room.code;if(room.hostId===oldId)room.hostId=socket.id;socket.emit('room:joined',{code:room.code,playerId:socket.id,token:p.token});io.to(room.code).emit('player:reconnected',{playerId:socket.id,name:p.name});emitRoom(room);});
  socket.on('player:ready',()=>{const r=findRoom(socket);if(!r||r.status!=='lobby')return;const p=r.players.find(x=>x.id===socket.id);if(p){p.ready=!p.ready;emitRoom(r);}});
  socket.on('host:settings',s=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='lobby')return error(socket,'Samo domaćin može mijenjati postavke.');if([10,15,20].includes(+s.rounds))r.settings.rounds=+s.rounds;if([15,20,30,45,60].includes(+s.seconds))r.settings.seconds=+s.seconds;emitRoom(r);});
  socket.on('host:start',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket))return error(socket,'Samo domaćin može pokrenuti partiju.');if(r.status!=='lobby'||r.players.length<2)return error(socket,'Za početak su potrebna najmanje dva igrača.');r.status='playing';r.players.forEach(p=>p.ready=true);r.selectorIndex=-1;io.to(r.code).emit('game:started');beginRound(r);});
  socket.on('material:choose',({material}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='select'||r.selectorId!==socket.id)return error(socket,'Sada ne biraš materijal.');if(!MATERIALS.includes(material))return error(socket,'Nepoznat materijal.');r.selectedMaterial=material;r.phase='place';r.deadline=Date.now()+r.settings.seconds*1000;clearTimeout(r.timer);r.timer=setTimeout(()=>autoPlace(r),r.settings.seconds*1000);io.to(r.code).emit('material:selected',{material,by:socket.id,deadline:r.deadline});emitRoom(r);});
  socket.on('material:place',({index}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='place')return error(socket,'Trenutno nije faza postavljanja.');const p=r.players.find(x=>x.id===socket.id);if(!p||p.placedThisRound)return error(socket,'Već si postavio materijal.');if(!Number.isInteger(index)||index<0||index>15||p.board[index])return error(socket,'Odabrano polje nije slobodno.');p.board[index]={type:'resource',material:r.selectedMaterial};p.placedThisRound=true;io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,placed:true});if(r.players.every(x=>x.placedThisRound))afterPlacements(r);});
  socket.on('building:construct',({buildingId,resourceIndexes,placementIndex}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='build')return error(socket,'Sada nije moguće graditi.');const p=r.players.find(x=>x.id===socket.id);const b=BUILDINGS.find(x=>x.id===buildingId);if(!p||p.builtThisRound||!b)return error(socket,'Izgradnja nije dostupna.');if(!Array.isArray(resourceIndexes)||!recipeMatches(p.board,resourceIndexes,b))return error(socket,'Odabrani materijali ne odgovaraju receptu ili rasporedu.');if(!resourceIndexes.includes(placementIndex))return error(socket,'Zgrada mora zauzeti jedno od tri oslobođena polja.');resourceIndexes.forEach(i=>p.board[i]=null);const bonus=calcBuildingBonus(p.board,placementIndex,b);p.board[placementIndex]={type:'building',buildingId:b.id,name:b.name,points:b.points,bonus};p.builtThisRound=true;p.score+=b.points+bonus;socket.emit('building:built',{board:p.board,building:b,bonus,placementIndex});io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,placed:true});nextIfDone(r);});
  socket.on('building:skip',()=>{const r=findRoom(socket);if(!r||r.phase!=='build')return;const p=r.players.find(x=>x.id===socket.id);if(p){p.builtThisRound=true;nextIfDone(r);}});
  socket.on('rewind:use',({index}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||!['place','build'].includes(r.phase))return error(socket,'Token se sada ne može koristiti.');const p=r.players.find(x=>x.id===socket.id);if(!p||!p.rewind)return error(socket,'REWIND token je već iskorišten.');if(!Number.isInteger(index)||index<0||index>15||!p.board[index]||p.board[index].type!=='resource')return error(socket,'Možeš vratiti samo materijal, ne i zgradu.');p.board[index]={type:'resource',material:r.selectedMaterial};p.rewind=false;io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,rewindUsed:true});socket.emit('notice',{type:'success',message:'REWIND je iskorišten.'});});
  socket.on('host:pause',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='playing')return error(socket,'Samo domaćin može pauzirati partiju.');r.status='paused';clearTimeout(r.timer);io.to(r.code).emit('game:paused');emitRoom(r);});
  socket.on('host:resume',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='paused')return; r.status='playing';io.to(r.code).emit('game:resumed');if(r.phase==='select')r.timer=setTimeout(()=>autoSelect(r),r.settings.seconds*1000);else if(r.phase==='place')r.timer=setTimeout(()=>autoPlace(r),r.settings.seconds*1000);else if(r.phase==='build')r.timer=setTimeout(()=>{r.players.forEach(p=>p.builtThisRound=true);nextIfDone(r);},r.settings.seconds*1000);});
  socket.on('host:skip',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='playing')return;if(r.phase==='select')autoSelect(r);else if(r.phase==='place')autoPlace(r);else{r.players.forEach(p=>p.builtThisRound=true);nextIfDone(r);}});
  socket.on('host:end',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket))return;finishGame(r);});
  socket.on('host:kick',({playerId}={})=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='lobby')return;const p=r.players.find(x=>x.id===playerId);if(!p||p.id===r.hostId)return;io.to(p.id).emit('room:kicked');const s=io.sockets.sockets.get(p.id);if(s){s.leave(r.code);s.data.roomCode=null;}r.players=r.players.filter(x=>x.id!==playerId);emitRoom(r);});
  socket.on('disconnect',()=>{const r=findRoom(socket);if(!r)return;const p=r.players.find(x=>x.id===socket.id);if(p)p.connected=false;if(r.hostId===socket.id){const next=r.players.find(x=>x.connected);if(next)r.hostId=next.id;}if(r.status==='lobby'&&r.players.every(x=>!x.connected)){rooms.delete(r.code);return;}emitRoom(r);});
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log(`MINI KINGDOM sluša na ${PORT}`));
