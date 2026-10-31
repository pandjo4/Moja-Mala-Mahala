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

const MATERIALS = ['wood','brick','stone'];
const BUILDINGS = [{"id":"cottage","name":"Glavna kuća","icon":"⌂","color":"#d8a66b","points":4,"recipe":{"wood":2,"brick":1},"category":"glavna","desc":"+1 bod za svaki različiti tip građevine koji direktno dodiruje Glavnu kuću.","example":"Ako je dodiruju Farma, Kula i Ciglana, dobija +3 boda."},{"id":"farm","name":"Farma","icon":"♧","color":"#a8bd61","points":2,"recipe":{"wood":1,"stone":2},"category":"glavna","desc":"+2 boda za svaku drugu Farmu koja je direktno dodiruje.","example":"Ako dodiruje dvije druge Farme, dobija +4 boda."},{"id":"watchtower","name":"Kula","icon":"♜","color":"#8295a8","points":4,"recipe":{"wood":2,"stone":1},"category":"glavna","desc":"+2 boda ako je postavljena u jednom od četiri ugaona polja.","example":"Ako je postavljena u ugaono polje, dobija +2 boda."},{"id":"kiln","name":"Ciglana","icon":"▥","color":"#c96d5c","points":4,"recipe":{"brick":2,"stone":1},"category":"glavna","desc":"+1 bod ako se u istom redu ili koloni nalazi druga Ciglana ili Radionica.","example":"Ako se u istom redu ili koloni nalazi Radionica, dobija +1 bod."},{"id":"workshop","name":"Radionica","icon":"⚒","color":"#a98bca","points":4,"recipe":{"wood":1,"brick":1,"stone":1},"category":"glavna","desc":"+1 bod ako se u istom redu ili koloni nalazi druga Ciglana ili Radionica.","example":"Ako se u istom redu ili koloni nalazi Ciglana, dobija +1 bod."},{"id":"market","name":"Pijaca","icon":"◇","color":"#e0b84e","points":3,"recipe":{"wood":1,"brick":1,"stone":1},"category":"glavna","desc":"+2 boda za svaki neiskorišteni materijal koji je direktno dodiruje na kraju partije.","example":"Ako je na kraju dodiruju tri neiskorištena materijala, dobija +6 bodova."},{"id":"library","name":"Biblioteka","icon":"✧","color":"#68a9d1","points":4,"recipe":{"brick":2,"stone":2},"category":"glavna","desc":"+1 bod za svaku drugu građevinu u osam okolnih polja, uključujući dijagonalna (najviše +7). Posebna cijena: 4 materijala.","example":"Ako je okružuje pet drugih građevina, dobija +5 bodova; najviše +7."},{"id":"fountain","name":"Fontana","icon":"◉","color":"#55aeb5","points":2,"recipe":{"wood":1,"stone":1},"category":"dopunska","desc":"+1 bod za svako prazno polje koje je direktno dodiruje na kraju partije (najviše +4).","example":"Ako su tri susjedna polja prazna na kraju, dobija +3 boda; najviše +4."}];
const rooms = new Map();
const cleanName = n => String(n || 'Igrač').trim().replace(/[<>]/g,'').slice(0,18) || 'Igrač';
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const clone = x => JSON.parse(JSON.stringify(x));
const emptyBoard = () => Array(16).fill(null);
const makePlayer = (id,name,token) => ({id,name,token,connected:true,ready:false,board:emptyBoard(),rewind:true,placedThisRound:false,builtThisRound:false,doneThisRound:false,score:0,coins:0,rewardedRows:[],rewardedCols:[],final:null});
function publicRoom(room, viewerId) {
  return {code:room.code,name:room.name,hostId:room.hostId,status:room.status,settings:room.settings,round:room.round,phase:room.phase,selectorId:room.selectorId,selectedMaterial:room.selectedMaterial,deadline:room.deadline,players:room.players.map(({token,...p})=>({...p})),buildings:BUILDINGS,viewerId};
}
function emitRoom(room) { io.to(room.code).emit('room:update', publicRoom(room)); }
function findRoom(socket) { return socket.data.roomCode && rooms.get(socket.data.roomCode); }
function error(socket,msg) { socket.emit('notice',{type:'error',message:msg}); }
function isHost(room,socket) { return room.hostId===socket.id; }
function idxNeighbors(i) { const r=Math.floor(i/4),c=i%4; return [r>0?i-4:-1,r<3?i+4:-1,c>0?i-1:-1,c<3?i+1:-1].filter(x=>x>=0); }
function connectedGroup(selected) {
  if (!Array.isArray(selected) || !selected.length) return false;
  const neighbors = i => { const r=Math.floor(i/4),c=i%4; return [r>0?i-4:-1,r<3?i+4:-1,c>0?i-1:-1,c<3?i+1:-1].filter(x=>x>=0); };
  const seen = new Set([selected[0]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of selected) if (!seen.has(i) && selected.some(j => seen.has(j) && neighbors(j).includes(i))) {
      seen.add(i); changed = true;
    }
  }
  return seen.size === selected.length;
}
function recipeMatches(board, selected, b) {
  const required = Object.values(b.recipe).reduce((sum,n)=>sum+n,0);
  if (!Array.isArray(selected) || selected.length !== required || new Set(selected).size !== required) return false;
  if (selected.some(i => !Number.isInteger(i) || i < 0 || i > 15)) return false;
  const cells = selected.map(i => board[i]);
  if (cells.some(x => !x || x.type !== 'resource')) return false;
  const counts = {};
  cells.forEach(x => counts[x.material] = (counts[x.material] || 0) + 1);
  if (Object.keys(b.recipe).some(k => (counts[k] || 0) !== b.recipe[k])) return false;
  if (Object.keys(counts).some(k => !b.recipe[k])) return false;
  return connectedGroup(selected);
}
function calcBuildingBonus(board,i,b,final=false) {
  const near=idxNeighbors(i).map(j=>board[j]);
  if(b.id==='cottage') return new Set(near.filter(x=>x?.type==='building').map(x=>x.buildingId)).size;
  if(b.id==='farm') return near.filter(x=>x?.buildingId==='farm').length*2;
  if(b.id==='watchtower') return [0,3,12,15].includes(i)?2:0;
  if(b.id==='kiln'||b.id==='workshop') return board.some((x,j)=>j!==i&&(x?.buildingId==='kiln'||x?.buildingId==='workshop')&&((Math.floor(j/4)===Math.floor(i/4))||j%4===i%4))?1:0;
  if(b.id==='market') return final?near.filter(x=>x?.type==='resource').length*2:0;
  if(b.id==='library') { const r=Math.floor(i/4),c=i%4,around=[]; for(let y=Math.max(0,r-1);y<=Math.min(3,r+1);y++)for(let x=Math.max(0,c-1);x<=Math.min(3,c+1);x++){const j=y*4+x;if(j!==i)around.push(board[j]);} return Math.min(7,around.filter(x=>x?.type==='building').length); }
  if(b.id==='fountain') return final?Math.min(4,near.filter(x=>!x).length):0;
  return 0;
}
function finalBuildingScore(board) {
  return board.reduce((sum,x,i)=>{if(x?.type!=='building')return sum;const b=BUILDINGS.find(v=>v.id===x.buildingId);return sum+(b?b.points+calcBuildingBonus(board,i,b,true):0);},0);
}
function currentBuildingScore(board) {
  return board.reduce((sum,x,i)=>{if(x?.type!=='building')return sum;const b=BUILDINGS.find(v=>v.id===x.buildingId);return sum+(b?b.points+calcBuildingBonus(board,i,b,false):0);},0);
}
function awardCompletedLines(player) {
  player.rewardedRows=player.rewardedRows||[];player.rewardedCols=player.rewardedCols||[];player.coins=player.coins||0;
  const messages=[];
  for(let r=0;r<4;r++) if(!player.rewardedRows.includes(r)&&player.board.slice(r*4,r*4+4).every(x=>x?.type==='building')) {player.rewardedRows.push(r);player.coins++;messages.push('Kompletiran red: +1 novčić!');}
  for(let c=0;c<4;c++) if(!player.rewardedCols.includes(c)&&[0,1,2,3].every(r=>player.board[r*4+c]?.type==='building')) {player.rewardedCols.push(c);player.coins++;messages.push('Kompletirana kolona: +1 novčić!');}
  return messages;
}
function finishGame(room) {
  clearTimeout(room.timer); room.status='finished'; room.phase='finished';
  const stats=room.players.map(p=>{
    const buildings=p.board.filter(x=>x?.type==='building');
    const rows=Array.from({length:4},(_,r)=>p.board.slice(r*4,r*4+4).every(x=>x?.type==='building')).filter(Boolean).length;
    const cols=Array.from({length:4},(_,c)=>[0,1,2,3].every(r=>p.board[r*4+c]?.type==='building')).filter(Boolean).length;
    const types=new Set(buildings.map(x=>x.buildingId)).size,farms=buildings.filter(x=>x.buildingId==='farm').length;
    const base=finalBuildingScore(p.board);
    return {id:p.id,name:p.name,buildings:buildings.length,types,farms,rows,cols,base,rowPoints:rows,columnPoints:cols,board:p.board.map(x=>x?{...x}:null),builderAward:0,varietyAward:0,farmAward:0,coins:p.coins||0,score:base+rows+cols};
  });
  for(const key of ['buildings','types','farms']) {const max=Math.max(...stats.map(s=>s[key]));const winners=stats.filter(s=>s[key]===max);if(winners.length===1){const award=key==='farms'?2:3;winners[0].score+=award;winners[0][key==='buildings'?'builderAward':key==='types'?'varietyAward':'farmAward']=award;}}
  room.players.forEach(p=>{p.final=stats.find(s=>s.id===p.id);p.score=p.final.score;});
  io.to(room.code).emit('game:finished',{results:stats.sort((a,b)=>b.score-a.score),awards:['Najveći graditelj','Najraznovrsniji grad','Najveći poljoprivrednik']});
}
function beginRound(room) {
  if(room.round>=room.settings.rounds){finishGame(room);return;}
  room.round++; room.phase='select'; room.selectedMaterial=null; room.players.forEach(p=>{p.placedThisRound=false;p.builtThisRound=false;p.doneThisRound=false;});
  room.selectorIndex=(room.selectorIndex+1)%room.players.length; room.selectorId=room.players[room.selectorIndex].id;
  room.deadline=Date.now()+room.settings.seconds*1000;
  io.to(room.code).emit('round:start',{round:room.round,selectorId:room.selectorId,deadline:room.deadline}); emitRoom(room);
  clearTimeout(room.timer); room.timer=setTimeout(()=>{if(room.status==='playing'&&room.phase==='select') autoSelect(room); else if(room.status==='playing'&&room.phase==='place') autoPlace(room);},room.settings.seconds*1000);
}
function autoSelect(room){ if(room.phase!=='select')return; const mat=MATERIALS[Math.floor(Math.random()*MATERIALS.length)]; room.selectedMaterial=mat; room.phase='place'; room.deadline=Date.now()+room.settings.seconds*1000; io.to(room.code).emit('material:selected',{material:mat,by:room.selectorId,deadline:room.deadline}); emitRoom(room); clearTimeout(room.timer); room.timer=setTimeout(()=>autoPlace(room),room.settings.seconds*1000); }
function autoPlace(room){ if(room.phase!=='place')return; room.players.forEach(p=>{if(!p.placedThisRound){const i=p.board.findIndex(x=>!x); if(i>=0)p.board[i]={type:'resource',material:room.selectedMaterial}; p.placedThisRound=true;}}); io.to(room.code).emit('round:placements',{automatic:true}); afterPlacements(room); }
function afterPlacements(room){
  if(room.phase==='finished'||room.status!=='playing')return;
  room.phase='build'; room.deadline=Date.now()+room.settings.seconds*1000;
  io.to(room.code).emit('build:phase',{deadline:room.deadline}); emitRoom(room);
  if(room.players.every(p=>p.doneThisRound)){nextIfDone(room);return;}
  clearTimeout(room.timer);
  room.timer=setTimeout(()=>{room.players.forEach(p=>{p.builtThisRound=true;p.doneThisRound=true;});nextIfDone(room);},room.settings.seconds*1000);
}
function nextIfDone(room){if(room.players.every(p=>p.doneThisRound)){clearTimeout(room.timer);beginRound(room);}}

io.on('connection', socket=>{
  socket.on('room:create',(payload={})=>{
    let c=code(); while(rooms.has(c))c=code(); const player=makePlayer(socket.id,cleanName(payload.name),crypto.randomBytes(18).toString('hex'));
    const room={code:c,name:String(payload.roomName||'Malo kraljevstvo').slice(0,28),hostId:socket.id,players:[player],status:'lobby',phase:'lobby',round:0,selectorIndex:-1,selectorId:null,selectedMaterial:null,deadline:null,settings:{rounds:[10,15,20,30,40].includes(+payload.rounds)?+payload.rounds:15,seconds:[15,20,30,45,60].includes(+payload.seconds)?+payload.seconds:30},timer:null};
    rooms.set(c,room); socket.join(c);socket.data.roomCode=c;socket.emit('room:joined',{code:c,playerId:socket.id,token:player.token});emitRoom(room);
  });
  socket.on('room:join',({code:c,name}={})=>{const room=rooms.get(String(c||'').toUpperCase());if(!room)return error(socket,'Soba s tim kodom ne postoji.');if(room.status!=='lobby')return error(socket,'Partija je već počela.');if(room.players.length>=8)return error(socket,'Soba je popunjena (najviše 8 igrača).');const p=makePlayer(socket.id,cleanName(name),crypto.randomBytes(18).toString('hex'));room.players.push(p);socket.join(room.code);socket.data.roomCode=room.code;socket.emit('room:joined',{code:room.code,playerId:socket.id,token:p.token});emitRoom(room);});
  socket.on('room:reconnect',({code:c,token}={})=>{const room=rooms.get(String(c||'').toUpperCase());if(!room||!token)return error(socket,'Nije moguće pronaći prethodnu sesiju.');const p=room.players.find(x=>x.token===token);if(!p)return error(socket,'Sesija više nije dostupna.');const oldId=p.id;p.id=socket.id;p.connected=true;socket.join(room.code);socket.data.roomCode=room.code;if(room.hostId===oldId)room.hostId=socket.id;socket.emit('room:joined',{code:room.code,playerId:socket.id,token:p.token});io.to(room.code).emit('player:reconnected',{playerId:socket.id,name:p.name});emitRoom(room);});
  socket.on('player:ready',()=>{const r=findRoom(socket);if(!r||r.status!=='lobby')return;const p=r.players.find(x=>x.id===socket.id);if(p){p.ready=!p.ready;emitRoom(r);}});
  socket.on('host:settings',s=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='lobby')return error(socket,'Samo domaćin može mijenjati postavke.');if([10,15,20,30,40].includes(+s.rounds))r.settings.rounds=+s.rounds;if([15,20,30,45,60].includes(+s.seconds))r.settings.seconds=+s.seconds;emitRoom(r);});
  socket.on('host:start',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket))return error(socket,'Samo domaćin može pokrenuti partiju.');if(r.status!=='lobby'||r.players.length<2)return error(socket,'Za početak su potrebna najmanje dva igrača.');r.status='playing';r.players.forEach(p=>p.ready=true);r.selectorIndex=-1;io.to(r.code).emit('game:started');beginRound(r);});
  socket.on('material:choose',({material}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='select'||r.selectorId!==socket.id)return error(socket,'Sada ne biraš materijal.');if(!MATERIALS.includes(material))return error(socket,'Nepoznat materijal.');r.selectedMaterial=material;r.phase='place';r.deadline=Date.now()+r.settings.seconds*1000;clearTimeout(r.timer);r.timer=setTimeout(()=>autoPlace(r),r.settings.seconds*1000);io.to(r.code).emit('material:selected',{material,by:socket.id,deadline:r.deadline});emitRoom(r);});
  socket.on('material:place',({index}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='place')return error(socket,'Trenutno nije faza postavljanja.');const p=r.players.find(x=>x.id===socket.id);if(!p||p.placedThisRound)return error(socket,'Već si postavio materijal.');if(!Number.isInteger(index)||index<0||index>15||p.board[index])return error(socket,'Odabrano polje nije slobodno.');p.board[index]={type:'resource',material:r.selectedMaterial};p.placedThisRound=true;io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,placed:true});if(r.players.every(x=>x.placedThisRound))afterPlacements(r);});
  socket.on('building:construct',({buildingId,resourceIndexes,placementIndex}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='build')return error(socket,'Sada nije moguće graditi.');const p=r.players.find(x=>x.id===socket.id);const b=BUILDINGS.find(x=>x.id===buildingId);if(!p||p.builtThisRound||!b)return error(socket,'Izgradnja nije dostupna.');if(!Array.isArray(resourceIndexes)||!recipeMatches(p.board,resourceIndexes,b))return error(socket,'Odabrani materijali ne odgovaraju receptu ili rasporedu.');if(!resourceIndexes.includes(placementIndex))return error(socket,'Zgrada mora zauzeti jedno od tri oslobođena polja.');resourceIndexes.forEach(i=>p.board[i]=null);const bonus=calcBuildingBonus(p.board,placementIndex,b,false);p.board[placementIndex]={type:'building',buildingId:b.id,name:b.name,points:b.points,bonus};p.builtThisRound=true;p.doneThisRound=true;p.score=currentBuildingScore(p.board);awardCompletedLines(p).forEach(message=>socket.emit('notice',{type:'success',message}));socket.emit('building:built',{board:p.board,building:b,bonus,placementIndex});io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,placed:true});emitRoom(r);nextIfDone(r);});
  socket.on('building:skip',()=>{const r=findRoom(socket);if(!r||r.status!=='playing'||r.phase!=='build')return;const p=r.players.find(x=>x.id===socket.id);if(p){p.builtThisRound=true;p.doneThisRound=true;emitRoom(r);nextIfDone(r);}});
  socket.on('turn:done',()=>{
    const r=findRoom(socket);if(!r||r.status!=='playing'||!['place','build'].includes(r.phase))return;
    const p=r.players.find(x=>x.id===socket.id);if(!p||p.doneThisRound)return;
    if(r.phase==='place'&&!p.placedThisRound){
      const i=p.board.findIndex(x=>!x);
      if(i>=0)p.board[i]={type:'resource',material:r.selectedMaterial};
      p.placedThisRound=true;
      io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,placed:true});
    }
    p.doneThisRound=true;p.builtThisRound=true;
    if(r.phase==='place'&&r.players.every(x=>x.placedThisRound))afterPlacements(r);
    else if(r.phase==='build')nextIfDone(r);
    emitRoom(r);
  });
  socket.on('rewind:use',({index}={})=>{const r=findRoom(socket);if(!r||r.status!=='playing'||!['place','build'].includes(r.phase))return error(socket,'Token se sada ne može koristiti.');const p=r.players.find(x=>x.id===socket.id);if(!p||!p.rewind)return error(socket,'REWIND token je već iskorišten.');if(!Number.isInteger(index)||index<0||index>15||!p.board[index]||p.board[index].type!=='resource')return error(socket,'Možeš vratiti samo materijal, ne i zgradu.');p.board[index]={type:'resource',material:r.selectedMaterial};p.rewind=false;io.to(r.code).emit('player:board',{playerId:p.id,board:p.board,rewindUsed:true});socket.emit('notice',{type:'success',message:'REWIND je iskorišten.'});});
  socket.on('host:pause',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='playing')return error(socket,'Samo domaćin može pauzirati partiju.');r.status='paused';clearTimeout(r.timer);io.to(r.code).emit('game:paused');emitRoom(r);});
  socket.on('host:resume',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='paused')return; r.status='playing';io.to(r.code).emit('game:resumed');if(r.phase==='select')r.timer=setTimeout(()=>autoSelect(r),r.settings.seconds*1000);else if(r.phase==='place')r.timer=setTimeout(()=>autoPlace(r),r.settings.seconds*1000);else if(r.phase==='build')r.timer=setTimeout(()=>{r.players.forEach(p=>{p.builtThisRound=true;p.doneThisRound=true;});nextIfDone(r);},r.settings.seconds*1000);});
  socket.on('host:skip',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='playing')return;if(r.phase==='select')autoSelect(r);else if(r.phase==='place')autoPlace(r);else{r.players.forEach(p=>{p.builtThisRound=true;p.doneThisRound=true;});nextIfDone(r);}});
  socket.on('host:end',()=>{const r=findRoom(socket);if(!r||!isHost(r,socket))return;finishGame(r);});
  socket.on('host:kick',({playerId}={})=>{const r=findRoom(socket);if(!r||!isHost(r,socket)||r.status!=='lobby')return;const p=r.players.find(x=>x.id===playerId);if(!p||p.id===r.hostId)return;io.to(p.id).emit('room:kicked');const s=io.sockets.sockets.get(p.id);if(s){s.leave(r.code);s.data.roomCode=null;}r.players=r.players.filter(x=>x.id!==playerId);emitRoom(r);});
  socket.on('room:leave',()=>{
    const r=findRoom(socket);if(!r)return;
    const p=r.players.find(x=>x.id===socket.id);
    if(p){r.players=r.players.filter(x=>x.id!==socket.id);socket.leave(r.code);}
    socket.data.roomCode=null;
    if(!r.players.length){clearTimeout(r.timer);rooms.delete(r.code);return;}
    if(r.hostId===socket.id){const next=r.players.find(x=>x.connected);if(next)r.hostId=next.id;}
    if(r.status==='playing'&&r.players.length&&r.players.every(x=>x.doneThisRound))nextIfDone(r);
    emitRoom(r);
  });
  socket.on('disconnect',()=>{const r=findRoom(socket);if(!r)return;const p=r.players.find(x=>x.id===socket.id);if(p)p.connected=false;if(r.hostId===socket.id){const next=r.players.find(x=>x.connected);if(next)r.hostId=next.id;}if(r.status==='lobby'&&r.players.every(x=>!x.connected)){rooms.delete(r.code);return;}emitRoom(r);});
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log(`MINI KINGDOM sluša na ${PORT}`));
