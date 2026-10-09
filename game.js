"use strict";

// A rota, os objetos e as regras ficam em dados separados dos desenhos.
const canvas = document.querySelector("#game-canvas");
let ctx = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const livesElement = document.querySelector("#lives");
const messageElement = document.querySelector("#message");
const bossHud = document.querySelector("#boss-hud");
const bossHealthFill = document.querySelector("#boss-health-fill");
const bossHealthTrack = document.querySelector(".boss-health-track");
const bossPhaseLabel = document.querySelector("#boss-phase-label");
const modal = document.querySelector("#story-modal");
const modalTitle = document.querySelector("#modal-title");
const modalText = document.querySelector("#modal-text");
const modalButton = document.querySelector("#modal-button");
const secondaryButton = document.querySelector("#secondary-button");
const soundButton = document.querySelector("#sound-button");
const gameArea = document.querySelector(".game-area");
const gameShell = document.querySelector(".game-shell");
const hasTouchInput = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
if(hasTouchInput)document.documentElement.classList.add("touch-device");

const map = { width: 3000, height: 1000 };
const player = { x: 100, y: 520, radius: 17, speed: 220, facingX: 1, facingY: 0, lives: 3, invulnerable: 0 };
const camera = { x: 0, y: 0 };
const routeY = x => 520 + Math.sin(x / 290) * 112;
const requiredHearts = 10;
const boss = { x: 2845, y: routeY(2810) - 26, radius: 62, maxHealth: 12, health: 12, phase: 1, mode: "sealed", timer: 0, phaseTimer: 0, enterProgress: 0, hitFlash: 0, openDoor: 0, attackNumber: 0, targetX: 0, targetY: 0, chargeX: 0, chargeY: 0, alive: true };
const bossCoins = [];
const floorCoins = [];
const input = { up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0, attack: false };
const hearts = [
  210, 360, 525, 700, 875, 1040, 1205, 1370, 1535, 1695,
  1855, 2020, 2185, 2350, 2520, 2690
].map((x, i) => ({ x, y: routeY(x) + (i % 2 ? 64 : -62), collected: false }));
const enemies = [
  [560, 490, 27], [810, 625, 27],
  [1080, 440, 38], [1335, 650, 40], [1590, 440, 42],
  [1840, 650, 47], [2070, 430, 49], [2300, 650, 51], [2500, 430, 53]
].map(([x, y, speed]) => ({ x, y, speed, radius: 19, alive: true, hitFlash: 0, knockX: 0, knockY: 0 }));
const projectiles = [];
const particles = [];
let width = 0, height = 0, lastTime = 0, score = 0, gameState = "playing", fireCooldown = 0;
let mouseAim = null;
let finalStep = 0, endingTimer = null, ambientContext = null, ambientGain = null, ambientOscillators = [], ambientTimer = null, soundEnabled = false, chordIndex = 0;
let resumeState = "playing";
let mapBackground = null;
const finalMessages = [
  "Sabe, Yanne… conhecer outros países é um sonho que eu tenho desde criança.",
  "Eu sei que não é fácil. Existem muitas coisas que preciso conquistar e muitos caminhos que ainda preciso percorrer.",
  "Mas esse é um sonho que eu não quero abandonar. Quero trabalhar, crescer e construir meu futuro até conseguir realizá-lo.",
  "E quando esse dia chegar, uma das coisas que mais quero é olhar para o lado e encontrar você comigo, conhecendo o mundo ao meu lado.",
  "Hoje, a gente está vivendo esse sonho dentro de um jogo. Mas eu espero que um dia possamos estar aqui de verdade. Não quero te prometer que será fácil, Yanne. Quero me esforçar para que um dia a gente possa dizer que conseguiu. 💗"
];
const ambientChords = [[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, hasTouchInput ? 1.5 : 2);
  width = rect.width; height = rect.height;
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function cameraUpdate() {
  if(["boss-intro","boss-battle","boss-victory","gate-opening"].includes(gameState)){
    const focusX=(player.x+boss.x)/2,focusY=(player.y+boss.y)/2;
    camera.x=Math.max(0,Math.min(map.width-width,focusX-width/2));
    camera.y=Math.max(0,Math.min(map.height-height,focusY-height/2));
    return;
  }
  camera.x = Math.max(0, Math.min(map.width - width, player.x - width * (hasTouchInput ? .5 : .42)));
  camera.y = Math.max(0, Math.min(map.height - height, player.y - height * (hasTouchInput ? .4 : .52)));
}

function heartShape(x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 20, size / 20);
  ctx.beginPath(); ctx.moveTo(0, 17); ctx.bezierCurveTo(-25, 1, -17, -17, -4, -11);
  ctx.bezierCurveTo(0, -9, 0, -5, 0, -5); ctx.bezierCurveTo(0, -5, 6, -18, 17, -10);
  ctx.bezierCurveTo(31, 1, 15, 13, 0, 17); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}

function drawSunflower(x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = "#6eaa68"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, 31); ctx.stroke();
  ctx.fillStyle = "#8bc58b"; ctx.beginPath(); ctx.ellipse(-7, 22, 8, 4, -.4, 0, Math.PI * 2); ctx.ellipse(7, 27, 8, 4, .4, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; ctx.fillStyle = "#f6ca59"; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 10, Math.sin(a) * 10, 5, 8, a, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#80543c"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawRoute() {
  ctx.fillStyle = "#e6f1d5"; ctx.fillRect(0, 0, map.width, map.height);
  // Colinas suaves se repetem em cada trecho; as flores acompanham a rota.
  for (let x = 0; x < map.width; x += 150) {
    const y = 130 + ((x * 17) % 150);
    ctx.fillStyle = x % 300 ? "#d9ebcb" : "#eaf3d9";
    ctx.beginPath(); ctx.ellipse(x + 45, y, 95, 37, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 90, map.height - y, 110, 44, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Trilha clara contínua que conduz do campo até Paris.
  ctx.beginPath();
  for (let x = 0; x <= map.width; x += 20) { const y = routeY(x); if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#fff9e8"; ctx.lineWidth = 104; ctx.stroke();
  ctx.strokeStyle = "#e8d3aa"; ctx.lineWidth = 3; ctx.setLineDash([4, 16]); ctx.stroke(); ctx.setLineDash([]);
  for (let x = 65; x < map.width - 130; x += 180) {
    const y = routeY(x);
    drawSunflower(x, y - 145, .8); drawSunflower(x + 82, y + 140, .7);
  }
  const regions = [
    { x: 300, label: "CAMPO DE GIRASSÓIS" }, { x: 1300, label: "CAMINHO DOS CORAÇÕES" }, { x: 2260, label: "PARIS ESTÁ PERTO" }
  ];
  for (const region of regions) {
    const y = routeY(region.x);
    ctx.fillStyle = "#fffaf0"; ctx.strokeStyle = "#dfbd7a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(region.x - 118, y - 218, 236, 47, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#9d5875"; ctx.textAlign = "center"; ctx.font = "800 15px Nunito, sans-serif";
    ctx.fillText(region.label, region.x, y - 188);
    ctx.fillStyle = "#c38b9c"; ctx.fillRect(region.x - 6, y - 171, 12, 32);
  }
  // Flechas e placas pequenas reforçam o sentido sem fechar a exploração.
  for (let x = 480; x < 2700; x += 390) {
    const y = routeY(x) + 92;
    ctx.fillStyle = "#b78394"; ctx.fillRect(x, y, 5, 33);
    ctx.fillStyle = "#fff6e6"; ctx.strokeStyle = "#d8ae83"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - 28, y - 15, 82, 27, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#a45c77"; ctx.font = "700 12px Nunito, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(x > 2200 ? "PARIS →" : "SIGA →", x + 13, y + 3);
  }
}

function cacheMapBackground(){
  const visibleContext=ctx;
  try{
    const background=document.createElement("canvas");
    background.width=map.width;background.height=map.height;
    const backgroundContext=background.getContext("2d");
    if(!backgroundContext)return;
    ctx=backgroundContext;drawRoute();ctx=visibleContext;mapBackground=background;
  }catch(error){ctx=visibleContext;mapBackground=null;}
}

function drawYanne(x, y, scale = 1, blinking = false) {
  // Personagem desenhada numa função isolada para facilitar a futura troca por sprite.
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.globalAlpha = blinking ? .45 : 1;
  ctx.fillStyle = "#7e6278"; ctx.beginPath(); ctx.ellipse(0, 19, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f18eaf"; ctx.beginPath(); ctx.roundRect(-11, 0, 22, 20, 8); ctx.fill();
  ctx.fillStyle = "#f0bd9f"; ctx.beginPath(); ctx.arc(0, -9, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#efc655"; ctx.beginPath(); ctx.arc(0, -13, 12, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9, -5, 4, 8, -.35, 0, Math.PI * 2); ctx.ellipse(9, -5, 4, 8, .35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#55434e"; ctx.beginPath(); ctx.arc(-4, -8, 1.4, 0, Math.PI * 2); ctx.arc(4, -8, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b85d76"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -4, 3, .15, 2.8); ctx.stroke();
  // Arco mágico rosa en la mano derecha.
  ctx.strokeStyle = "#d75f9b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(15, 3, 10, -1.2, 1.2); ctx.stroke();
  ctx.strokeStyle = "#fff0f8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(12, 12); ctx.stroke();
  ctx.restore();
}

function drawJunior(x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#547a76"; ctx.beginPath(); ctx.roundRect(-12, -1, 24, 25, 8); ctx.fill();
  ctx.fillStyle = "#efbd9e"; ctx.beginPath(); ctx.arc(0, -12, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#513c43"; ctx.beginPath(); ctx.arc(0, -16, 12, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#503f48"; ctx.beginPath(); ctx.arc(-4, -12, 1.4, 0, Math.PI * 2); ctx.arc(4, -12, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.sin(performance.now() / 220 + enemy.x) * .08);
  heartShape(0, 0, 30, enemy.hitFlash > 0 ? "#fff2f8" : "#82627f");
  heartShape(-4, -3, 9, "#b89bb4");
  ctx.strokeStyle = "#fff0f6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(-3, 6); ctx.moveTo(-3, 2); ctx.lineTo(-7, 6); ctx.moveTo(4, 4); ctx.lineTo(8, 8); ctx.stroke();
  ctx.restore();
}

function drawParis() {
  const x = 2810, y = routeY(x);
  ctx.fillStyle = "#fff4e6"; ctx.strokeStyle = "#dfa980"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(x - 100, y - 150, 180, 205, 24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a65e7a"; ctx.textAlign = "center"; ctx.font = "900 24px Nunito, sans-serif"; ctx.fillText("PARIS", x - 10, y - 117);
  ctx.fillStyle = "#bf7c91";
  ctx.beginPath(); ctx.moveTo(x - 67, y + 27); ctx.lineTo(x - 21, y - 64); ctx.lineTo(x - 14, y - 64); ctx.lineTo(x - 32, y + 27); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 47, y + 27); ctx.lineTo(x + 1, y - 64); ctx.lineTo(x - 6, y - 64); ctx.lineTo(x + 12, y + 27); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 37, y - 14, 54, 7); ctx.fillRect(x - 24, y - 43, 28, 6); ctx.fillRect(x - 2, y - 92, 5, 29);
  ctx.beginPath(); ctx.moveTo(x - 17, y - 43); ctx.lineTo(x + 8, y - 43); ctx.lineTo(x - 4, y - 62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#9e617d"; ctx.font = "700 12px Nunito, sans-serif"; ctx.fillText("DESTINO FINAL", x - 10, y + 43);
}

function drawBossGate(open = false) {
  const x=2810,y=routeY(2810)+15;
  // A torre aparece atrás do portão, mas permanece inacessível até a vitória.
  ctx.fillStyle="#b98191";ctx.globalAlpha=.68;
  ctx.beginPath();ctx.moveTo(x-24,y+10);ctx.lineTo(x-8,y-120);ctx.lineTo(x-4,y-120);ctx.lineTo(x-17,y+10);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(x+24,y+10);ctx.lineTo(x+8,y-120);ctx.lineTo(x+4,y-120);ctx.lineTo(x+17,y+10);ctx.closePath();ctx.fill();
  ctx.fillRect(x-15,y-53,30,4);ctx.fillRect(x-10,y-82,20,4);ctx.fillRect(x-2,y-143,4,25);ctx.globalAlpha=1;
  ctx.fillStyle="#684d69";ctx.strokeStyle="#d9ad67";ctx.lineWidth=5;
  ctx.beginPath();ctx.roundRect(x-148,y-9,296,100,20);ctx.fill();ctx.stroke();
  ctx.strokeStyle="#d8b66f";ctx.lineWidth=4;
  for(let i=-5;i<=5;i++){const barX=x+i*23;
    const shift=open?(i<0?-92:92):0;
    ctx.beginPath();ctx.moveTo(barX+shift,y+5);ctx.lineTo(barX+shift,y+87);ctx.stroke();
  }
  ctx.fillStyle="#fff0d2";ctx.beginPath();ctx.arc(x,y+41,9,0,Math.PI*2);ctx.fill();
  if(open){ctx.fillStyle="#ffe6ad";ctx.font="800 16px Nunito, sans-serif";ctx.textAlign="center";ctx.fillText("PARIS",x,y+116);}
}

function drawGoldCoin(x,y,size,rotation=0,alpha=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=alpha;
  ctx.fillStyle="#d99638";ctx.beginPath();ctx.ellipse(0,0,size,size*.72,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#ffe092";ctx.lineWidth=Math.max(1,size*.14);ctx.stroke();
  ctx.fillStyle="#fff0b4";ctx.font=`bold ${Math.max(8,size)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("✦",0,1);
  ctx.restore();
}

function drawDreamCollector(){
  if(!boss.alive&&gameState!=="boss-victory"&&gameState!=="gate-opening")return;
  const time=performance.now()/1000, bob=Math.sin(time*2.4)*4, x=boss.x, y=boss.y+bob;
  ctx.save();ctx.translate(x,y);
  // Fumaça em pequenas nuvens, sempre translúcida para preservar a leitura do combate.
  const defeated=boss.mode==="defeated";
  const fade=defeated?Math.max(0,1-boss.defeatElapsed/3):1;
  ctx.globalAlpha=fade;
  for(let i=0;i<(defeated?0:8);i++){
    const a=time*.35+i*Math.PI/4, radius=76+Math.sin(time*1.8+i)*7;
    ctx.globalAlpha=fade*(.13+.07*Math.sin(time*2+i));ctx.fillStyle=i%2?"#493e58":"#75546f";
    ctx.beginPath();ctx.arc(Math.cos(a)*radius,Math.sin(a)*radius*.72,18+(i%3)*4,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=fade;
  // Correntes cruzadas; na fase dois, giram ao redor do cofre.
  ctx.save();if(boss.phase===2&&!defeated)ctx.rotate(time*1.55);
  ctx.setLineDash(defeated?[12,15]:[]);ctx.strokeStyle=defeated?"#dbc6a5":"#383644";ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(0,4,78,52,-.5,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle="#b6a5a7";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,4,78,52,-.5,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);ctx.restore();
  for(let i=0;i<(defeated?0:6);i++){
    const angle=time*(boss.phase===2?1.4:.48)+i*Math.PI/3;
    drawGoldCoin(Math.cos(angle)*93,Math.sin(angle)*64,9,angle);
  }
  // Cofre antigo como corpo: metal gasto, rebites e uma porta que abre para revelar o núcleo.
  ctx.save();ctx.translate(0,bob===0?0:0);ctx.scale(boss.hitFlash>0?1.045:1,1);
  ctx.fillStyle=boss.hitFlash>0?"#fff0d2":"#655461";ctx.strokeStyle="#caa567";ctx.lineWidth=5;
  ctx.beginPath();ctx.roundRect(-65,-59,130,123,18);ctx.fill();ctx.stroke();
  ctx.fillStyle="#83717a";ctx.beginPath();ctx.roundRect(-53,-48,106,101,12);ctx.fill();
  ctx.strokeStyle="#d3b16f";ctx.lineWidth=3;ctx.strokeRect(-48,-43,96,91);
  for(const px of [-53,53])for(const py of [-47,48]){ctx.fillStyle="#efc96e";ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();}
  // Olhos âmbar sob a tampa do cofre.
  ctx.fillStyle="#332d3b";ctx.beginPath();ctx.ellipse(-27,-70,17,12,-.12,0,Math.PI*2);ctx.ellipse(27,-70,17,12,.12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#ffca55";ctx.beginPath();ctx.arc(-27,-70,6,0,Math.PI*2);ctx.arc(27,-70,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#fff4bd";ctx.beginPath();ctx.arc(-29,-72,2,0,Math.PI*2);ctx.arc(25,-72,2,0,Math.PI*2);ctx.fill();
  // A fechadura abre como uma portinhola durante as janelas vulneráveis.
  const openAmount=boss.openDoor,open=openAmount>.15;
  ctx.save();ctx.translate(-5,0);ctx.rotate(-.75*openAmount);
  ctx.fillStyle="#524452";ctx.strokeStyle="#edc977";ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-26,-25,53,51,8);ctx.fill();ctx.stroke();
  ctx.fillStyle=open?"#ffc85b":"#82657a";ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=open?"#fff3bd":"#e8c985";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.fillRect(-2,-2,4,11);
  if(open){ctx.globalAlpha=fade*openAmount*(.45+.3*Math.sin(time*8));ctx.fillStyle="#ffd875";ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.fill();}
  ctx.restore();ctx.restore();
  // Notas rasgadas acompanham a aura, sem parecerem objetos realistas.
  for(let i=0;i<(defeated?0:2);i++){
    const a=time*.55+i*Math.PI, nx=Math.cos(a)*111,ny=Math.sin(a)*75;
    ctx.save();ctx.translate(nx,ny);ctx.rotate(a+Math.sin(time+i)*.25);ctx.fillStyle="#dfc894";ctx.globalAlpha=.8;
    ctx.beginPath();ctx.moveTo(-9,-7);ctx.lineTo(8,-8);ctx.lineTo(9,7);ctx.lineTo(2,5);ctx.lineTo(-2,9);ctx.lineTo(-9,5);ctx.closePath();ctx.fill();ctx.restore();
  }
  if(boss.hitFlash>0)heartShape(0,-97,13,"#fff6cf");
  ctx.restore();ctx.globalAlpha=1;
}

function drawBossTelegraph(){
  if(boss.mode==="windup-coins"){
    ctx.save();ctx.setLineDash([8,8]);ctx.strokeStyle="#ffd56d";ctx.lineWidth=3;ctx.globalAlpha=.8;
    ctx.beginPath();ctx.moveTo(boss.x,boss.y);ctx.lineTo(boss.targetX,boss.targetY);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle="#ffcb68";ctx.beginPath();ctx.arc(boss.targetX,boss.targetY,18+Math.sin(performance.now()/90)*5,0,Math.PI*2);ctx.stroke();ctx.restore();
  } else if(boss.mode==="windup-charge"){
    ctx.save();ctx.setLineDash([12,9]);ctx.strokeStyle="#f6a974";ctx.lineWidth=20;ctx.globalAlpha=.28;
    ctx.beginPath();ctx.moveTo(boss.x,boss.y);ctx.lineTo(boss.targetX,boss.targetY);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle="#fff0c5";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(boss.x,boss.y);ctx.lineTo(boss.targetX,boss.targetY);ctx.stroke();ctx.restore();
  } else if(boss.mode==="phase-transition"){
    ctx.save();ctx.globalAlpha=.4+.25*Math.sin(performance.now()/70);ctx.fillStyle="#f4bf68";ctx.beginPath();ctx.arc(boss.x,boss.y,112,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

function drawBossHazards(){
  for(const coin of bossCoins)drawGoldCoin(coin.x,coin.y,coin.radius,performance.now()/140,1);
  for(const coin of floorCoins){
    const alpha=Math.min(1,coin.life/.6);drawGoldCoin(coin.x,coin.y,coin.radius,Math.sin(performance.now()/180)*.1,alpha);
    ctx.save();ctx.globalAlpha=.17*alpha;ctx.fillStyle="#dc9b48";ctx.beginPath();ctx.ellipse(coin.x,coin.y+8,coin.radius*1.7,coin.radius*.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

function drawWorld() {
  ctx.clearRect(0, 0, width, height); cameraUpdate(); ctx.save(); ctx.translate(-camera.x, -camera.y);
  if(mapBackground)ctx.drawImage(mapBackground,camera.x,camera.y,width,height,camera.x,camera.y,width,height);
  else drawRoute();
  const bossScene=["boss-intro","boss-battle","boss-victory","gate-opening"].includes(gameState);
  if(bossScene){
    const darkness=gameState==="boss-intro" ? 0.12+.53*boss.enterProgress : 0.64;
    ctx.fillStyle=`rgba(33,26,48,${darkness})`;ctx.fillRect(camera.x,camera.y,width,height);
    drawBossGate(gameState==="gate-opening");
    if(gameState==="boss-intro"||gameState==="boss-battle"){drawBossTelegraph();drawDreamCollector();}
    else if(gameState==="boss-victory"||gameState==="gate-opening")drawDreamCollector();
  } else drawParis();
  for (const heart of hearts) if (!heart.collected) heartShape(heart.x, heart.y + Math.sin(performance.now() / 250 + heart.x) * 4, 20, "#ee789f");
  for (const enemy of enemies) if (enemy.alive) drawEnemy(enemy);
  for (const shot of projectiles) heartShape(shot.x, shot.y, 13, "#f36baa");
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / .55); heartShape(p.x, p.y, p.size, p.color); }
  if(gameState==="boss-battle")drawBossHazards();
  if (gameState !== "help") drawYanne(player.x, player.y, 1, player.invulnerable > 0 && Math.floor(performance.now() / 90) % 2 === 0);
  ctx.restore();
  if (gameState === "help") drawHelpScene();
  if (gameState === "final") drawFinalScene();
}

function drawHelpScene() {
  ctx.fillStyle = "#e8ddf1"; ctx.fillRect(0, 0, width, height);
  const cloud = (x, y, s) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 28*s, 0, Math.PI*2); ctx.arc(x+32*s, y-13*s, 35*s, 0, Math.PI*2); ctx.arc(x+70*s, y, 27*s, 0, Math.PI*2); ctx.fill(); };
  cloud(width*.15, height*.22, 1); cloud(width*.69, height*.2, .85); cloud(width*.43, height*.58, 1.15);
  ctx.fillStyle = "#ffe7a5"; ctx.beginPath(); ctx.arc(width*.5, height*.28, 47, 0, Math.PI*2); ctx.fill();
  drawJunior(width*.5, height*.49, 2.2);
  for (let i=0;i<12;i++) heartShape((i*83+20)%width, height*(.12+((i*37)%65)/100), 12, "#ee8bb0");
}

function drawFinalScene() {
  const time = performance.now() / 1000;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#9d8dbb"); gradient.addColorStop(.38, "#e9a2b5"); gradient.addColorStop(.76, "#ffd19a"); gradient.addColorStop(1, "#f7d9bb");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);

  // Sol de fim de tarde, brilho delicado e primeiras estrelas.
  const sunGlow = ctx.createRadialGradient(width*.77,height*.31,5,width*.77,height*.31,Math.min(width,height)*.28);
  sunGlow.addColorStop(0,"#fff1c9a8"); sunGlow.addColorStop(1,"#fff1c900"); ctx.fillStyle=sunGlow;ctx.fillRect(0,0,width,height);
  ctx.fillStyle="#ffe5b3";ctx.beginPath();ctx.arc(width*.77,height*.31,Math.min(34,width*.1),0,Math.PI*2);ctx.fill();
  for(let i=0;i<28;i++){
    const x=(i*97+31)%Math.max(1,width), y=20+(i*53)%Math.max(40,height*.58), twinkle=.35+.65*(.5+.5*Math.sin(time*2.4+i*3));
    ctx.globalAlpha=twinkle;ctx.fillStyle=i%3?"#fff8e3":"#ffe0a0";ctx.beginPath();ctx.arc(x,y,i%5===0?1.8:1.1,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;

  // Silhuetas da cidade com janelas acesas ao anoitecer.
  const ground=height*.86;
  for(let i=0;i<12;i++){
    const bw=width/9, bx=i*bw-width*.06, bh=height*(.12+((i*17)%13)/100);
    ctx.fillStyle=i%2?"#8b708d":"#9b7790";ctx.fillRect(bx,ground-bh,bw+2,bh);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      ctx.globalAlpha=.48+.35*(.5+.5*Math.sin(time*1.5+i+row*2+col));ctx.fillStyle="#ffe6a8";
      ctx.fillRect(bx+7+col*10,ground-bh+9+row*13,3,5);
    }
  }
  ctx.globalAlpha=1;ctx.fillStyle="#a7758b";ctx.fillRect(0,ground,width,height-ground);
  ctx.fillStyle="#f3bfad";ctx.fillRect(0,ground,width,3);

  // A Torre Eiffel ganha luzes douradas cintilantes.
  const center=width*.58, base=ground+3, scale=Math.min(width/440,height/355,1.05);
  ctx.save();ctx.translate(center,base);ctx.scale(scale,scale);
  ctx.fillStyle="#a8627c";ctx.strokeStyle="#9f617a";ctx.lineWidth=5;ctx.lineJoin="round";
  ctx.beginPath();ctx.moveTo(-65,0);ctx.lineTo(-20,-154);ctx.lineTo(-8,-154);ctx.lineTo(-30,0);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(65,0);ctx.lineTo(20,-154);ctx.lineTo(8,-154);ctx.lineTo(30,0);ctx.closePath();ctx.fill();
  ctx.fillRect(-39,-57,78,8);ctx.fillRect(-24,-96,48,7);ctx.fillRect(-4,-196,8,44);
  ctx.beginPath();ctx.moveTo(-25,-96);ctx.lineTo(25,-96);ctx.lineTo(0,-157);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(-15,-57);ctx.lineTo(15,-57);ctx.lineTo(30,0);ctx.stroke();
  for(let i=0;i<16;i++){const lx=-48+(i%8)*13,ly=-12-Math.floor(i/8)*43;ctx.globalAlpha=.55+.45*(.5+.5*Math.sin(time*3+i));ctx.fillStyle="#ffe9a4";ctx.beginPath();ctx.arc(lx,ly,2.1,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.restore();

  // Yanne e Junior ficam lado a lado, com as mãos unidas diante da torre.
  const coupleX=width*.49,coupleY=ground-19,coupleScale=Math.min(width/390,height/310,1);
  ctx.save();ctx.translate(coupleX,coupleY);ctx.scale(coupleScale,coupleScale);
  ctx.strokeStyle="#fff1ed";ctx.lineWidth=4;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-14,8);ctx.lineTo(-2,12);ctx.moveTo(14,8);ctx.lineTo(2,12);ctx.stroke();
  drawYanne(-22,0,1.05);drawJunior(22,0,1.05);heartShape(0,10,10,"#f7b7c4");ctx.restore();

  // Pétalas passam devagar e pequenas partículas douradas sobem pelo céu.
  for(let i=0;i<12;i++){
    const cycle=(time*(18+i%4)+i*67)%(height+35), x=((i*83+Math.sin(time*.7+i)*32)%Math.max(1,width));
    ctx.save();ctx.translate(x,cycle-20);ctx.rotate(time*1.3+i);ctx.fillStyle=i%2?"#f5a8b8":"#ffe6a5";
    ctx.globalAlpha=.48+.42*Math.sin(time+i);ctx.beginPath();ctx.ellipse(0,0,3,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.globalAlpha=1;
}

function addBurst(x, y, color = "#f18bb0") {
  for (let i=0;i<8;i++) { const a = i*Math.PI/4; particles.push({ x, y, vx: Math.cos(a)*55, vy: Math.sin(a)*55, life:.55, size:7, color }); }
}

function shoot(targetX, targetY, assisted = false) {
  if ((gameState !== "playing"&&gameState!=="boss-battle") || fireCooldown > 0 || projectiles.length >= 5) return;
  let dx = targetX - player.x, dy = targetY - player.y;
  let length = Math.hypot(dx,dy) || 1; dx /= length; dy /= length;
  // No toque, escolha o inimigo próximo na direção do movimento, com uma mira permissiva.
  if (assisted) {
    let best = null, bestDistance = 450;
    for (const enemy of enemies) if (enemy.alive) {
      const ex=enemy.x-player.x, ey=enemy.y-player.y, d=Math.hypot(ex,ey), dot=(ex*dx+ey*dy)/(d||1);
      if (d < bestDistance && dot > .25) { best=enemy; bestDistance=d; }
    }
    if(gameState==="boss-battle"){
      const ex=boss.x-player.x,ey=boss.y-player.y,d=Math.hypot(ex,ey),dot=(ex*dx+ey*dy)/(d||1);
      if(d<bestDistance&&dot>.18)best=boss;
    }
    if (best) { dx=(best.x-player.x)/(Math.hypot(best.x-player.x,best.y-player.y)); dy=(best.y-player.y)/(Math.hypot(best.x-player.x,best.y-player.y)); }
  }
  player.facingX=dx; player.facingY=dy;
  projectiles.push({ x:player.x+dx*22, y:player.y+dy*22, vx:dx*480, vy:dy*480, life:1.15 });
  fireCooldown=.42;
}

function worldAim(event) {
  const rect=canvas.getBoundingClientRect();
  return { x:camera.x+event.clientX-rect.left, y:camera.y+event.clientY-rect.top };
}

function updateBossHealth(){
  const ratio=Math.max(0,boss.health/boss.maxHealth);
  bossHealthFill.style.width=`${ratio*100}%`;
  bossHealthTrack.setAttribute("aria-valuenow",String(boss.health));
  bossPhaseLabel.textContent=boss.phase===1?"FASE 1 · CUSTO DA VIAGEM":"FASE 2 · IMPREVISTOS";
}

function spawnCoinVolley(){
  const aim=Math.atan2(player.y-boss.y,player.x-boss.x);
  for(const offset of [-.27,0,.27]){
    const angle=aim+offset,speed=245;
    bossCoins.push({x:boss.x-36,y:boss.y+22,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-45,gravity:175,life:3.4,radius:12,age:0});
  }
  boss.mode="open";boss.timer=boss.phase===1?1.9:1.65;
  messageElement.textContent="O cofre abriu! Acerte o núcleo com flechas de coração.";
}

function startBossAttack(){
  boss.targetX=player.x;boss.targetY=player.y;boss.timer=boss.phase===1?1.0:.82;
  if(boss.phase===1||boss.attackNumber%2===0){boss.mode="windup-coins";messageElement.textContent="Atenção: moedas a caminho. Prepare-se para desviar.";}
  else {boss.mode="windup-charge";messageElement.textContent="Desvie da faixa marcada antes da investida!";}
  boss.attackNumber++;
}

function hurtYanne(sourceX,sourceY,text){
  if(player.invulnerable>0)return false;
  player.lives--;player.invulnerable=1.7;updateLives();
  const dx=player.x-sourceX,dy=player.y-sourceY,d=Math.hypot(dx,dy)||1;
  player.x+=dx/d*30;player.y+=dy/d*30;
  addBurst(player.x,player.y,"#f5a8c1");messageElement.textContent=text;
  if(player.lives<=0)showHelp();
  return true;
}

function defeatBoss(){
  if(gameState!=="boss-battle")return;
  gameState="boss-victory";boss.alive=false;boss.mode="defeated";boss.timer=3.1;boss.defeatElapsed=0;
  bossCoins.length=0;floorCoins.length=0;projectiles.length=0;bossHud.hidden=true;clearMovement();
  messageElement.textContent="Talvez não seja fácil chegar até aqui. Mas difícil não significa impossível. 💗";
  for(let i=0;i<32;i++){
    const angle=i*Math.PI*2/32,speed=25+(i%4)*15;
    particles.push({x:boss.x,y:boss.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-18,life:2.8,size:6+(i%3)*2,color:i%2?"#f5bb61":"#ef91b2"});
  }
}

function damageBoss(){
  if(gameState!=="boss-battle"||boss.mode!=="open")return;
  boss.health=Math.max(0,boss.health-1);boss.hitFlash=.24;
  for(let i=0;i<9;i++){
    const angle=i*Math.PI*2/9,speed=30+(i%3)*16;
    particles.push({x:boss.x,y:boss.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.85,size:7,color:i%2?"#ffdc85":"#f4a1be"});
  }
  updateBossHealth();
  if(boss.health===0){defeatBoss();return;}
  if(boss.phase===1&&boss.health<=boss.maxHealth/2){
    boss.phase=2;boss.mode="phase-transition";boss.phaseTimer=2.2;
    bossCoins.length=0;floorCoins.length=0;
    messageElement.textContent="As correntes se soltam! O Cobrador mudou de estratégia.";
    updateBossHealth();
  } else messageElement.textContent="Acerto! Espere o cofre abrir novamente.";
}

function updateBoss(dt){
  boss.hitFlash=Math.max(0,boss.hitFlash-dt);
  const doorTarget=boss.mode==="open"||boss.mode==="defeated"?1:0;
  boss.openDoor+=(doorTarget-boss.openDoor)*Math.min(1,dt*7);
  if(boss.mode==="phase-transition"){
    boss.phaseTimer-=dt;
    if(boss.phaseTimer<=0){boss.mode="idle";boss.timer=.8;messageElement.textContent="Fase 2: observe os avisos e encontre uma abertura.";}
  } else if(boss.mode==="idle"){
    boss.timer-=dt;if(boss.timer<=0)startBossAttack();
  } else if(boss.mode==="windup-coins"){
    boss.timer-=dt;if(boss.timer<=0)spawnCoinVolley();
  } else if(boss.mode==="windup-charge"){
    boss.timer-=dt;if(boss.timer<=0){const d=Math.hypot(boss.targetX-boss.x,boss.targetY-boss.y)||1;boss.chargeX=(boss.targetX-boss.x)/d*440;boss.chargeY=(boss.targetY-boss.y)/d*440;boss.mode="charge";boss.timer=.58;}
  } else if(boss.mode==="charge"){
    boss.x=Math.max(2780,Math.min(2915,boss.x+boss.chargeX*dt));
    boss.y=Math.max(routeY(2810)-145,Math.min(routeY(2810)+75,boss.y+boss.chargeY*dt));
    boss.timer-=dt;
    if(Math.hypot(player.x-boss.x,player.y-boss.y)<boss.radius+player.radius){hurtYanne(boss.x,boss.y,"A investida passou! Aproveite a abertura do cofre.");if(gameState==="help")return;}
    if(boss.timer<=0){boss.mode="open";boss.timer=1.6;messageElement.textContent="O cofre abriu depois da investida!";}
  } else if(boss.mode==="open"){
    boss.timer-=dt;if(boss.timer<=0){boss.mode="idle";boss.timer=boss.phase===1 ? .65 : .48;}
  }

  const floor=routeY(2810)+156;
  for(let i=bossCoins.length-1;i>=0;i--){
    const coin=bossCoins[i];coin.age+=dt;coin.life-=dt;coin.vy+=coin.gravity*dt;coin.x+=coin.vx*dt;coin.y+=coin.vy*dt;
    if(Math.hypot(player.x-coin.x,player.y-coin.y)<player.radius+coin.radius){hurtYanne(coin.x,coin.y,"Uma moeda acertou! As próximas ainda podem ser evitadas.");bossCoins.splice(i,1);if(gameState==="help")return;continue;}
    if(coin.y>=floor){floorCoins.push({x:coin.x,y:floor,life:3.2,radius:17});bossCoins.splice(i,1);continue;}
    if(coin.life<=0||coin.x<2670||coin.x>2980||coin.y<routeY(2810)-250)bossCoins.splice(i,1);
  }
  for(let i=floorCoins.length-1;i>=0;i--){
    const coin=floorCoins[i];coin.life-=dt;
    if(Math.hypot(player.x-coin.x,player.y-coin.y)<player.radius+coin.radius&&hurtYanne(coin.x,coin.y,"Uma moeda no chão! Afaste-se até ela desaparecer.")){floorCoins.splice(i,1);if(gameState==="help")return;continue;}
    if(coin.life<=0)floorCoins.splice(i,1);
  }
}

function startBossIntro(){
  gameState="boss-intro";boss.alive=true;boss.mode="entrance";boss.enterProgress=0;
  boss.x=2845;boss.y=routeY(2810)-26;player.x=Math.min(player.x,2745);player.y=routeY(2810)+105;
  input.attack=false;clearMovement();bossHud.hidden=true;updateBossHealth();gameArea.classList.add("boss-encounter","story-open");
  modalTitle.textContent="O Cobrador dos Sonhos";
  modalText.textContent="Paris? Você acha mesmo que pode chegar tão longe? Sonhos custam caro, viajante. Nem todo mundo consegue pagar o preço.";
  modalButton.textContent="Enfrentar o desafio";secondaryButton.hidden=true;soundButton.hidden=true;
  modal.dataset.scene="boss-intro";modal.hidden=false;
}

function startBossBattle(){
  if(gameState!=="boss-intro")return;
  clearMovement();modal.hidden=true;gameArea.classList.remove("story-open");gameState="boss-battle";bossHud.hidden=false;
  boss.alive=true;boss.mode="idle";boss.timer=1.05;boss.attackNumber=0;
  bossCoins.length=0;floorCoins.length=0;projectiles.length=0;fireCooldown=.25;
  messageElement.textContent="Fase 1: desvie das moedas e dispare quando o cofre abrir.";
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
}

function update(dt) {
  if(gameState==="boss-intro"){
    boss.enterProgress=Math.min(1,boss.enterProgress+dt/1.1);
    boss.y=routeY(2810)-26+(1-boss.enterProgress)*120;
    return;
  }
  if(gameState==="boss-victory"){
    boss.defeatElapsed+=dt;boss.timer-=dt;updateParticles(dt);
    if(boss.timer<=0){gameState="gate-opening";boss.timer=1.7;}
    return;
  }
  if(gameState==="gate-opening"){
    boss.defeatElapsed+=dt;boss.timer-=dt;updateParticles(dt);
    if(boss.timer<=0){gameArea.classList.remove("boss-encounter","story-open");showFinal();}
    return;
  }
  if(gameState!=="playing"&&gameState!=="boss-battle")return;
  fireCooldown=Math.max(0,fireCooldown-dt); player.invulnerable=Math.max(0,player.invulnerable-dt);
  let dx=Number(input.right)-Number(input.left)+input.joystickX, dy=Number(input.down)-Number(input.up)+input.joystickY;
  const mag=Math.hypot(dx,dy); if(mag>1){dx/=mag;dy/=mag;}
  if (dx||dy) { player.facingX=dx; player.facingY=dy; }
  if(gameState==="boss-battle"){
    const floor=routeY(2810)+156;
    player.x=Math.max(2690,Math.min(2960,player.x+dx*player.speed*dt));
    player.y=Math.max(floor-225,Math.min(floor-25,player.y+dy*player.speed*dt));
  } else {
    player.x=Math.max(player.radius,Math.min(map.width-player.radius,player.x+dx*player.speed*dt));
    player.y=Math.max(player.radius,Math.min(map.height-player.radius,player.y+dy*player.speed*dt));
  }
  for (const heart of hearts) if (!heart.collected && Math.hypot(player.x-heart.x,player.y-heart.y)<player.radius+14) {
    heart.collected=true; score++; scoreElement.textContent=`${score} / ${requiredHearts}`;
    messageElement.textContent=score>=requiredHearts?"O caminho para Paris está livre!":"Coração encontrado. Continue pela trilha!";
    addBurst(heart.x,heart.y,"#ef80a4");
  }
  if (input.attack && fireCooldown<=0) {
    if (mouseAim) shoot(mouseAim.x,mouseAim.y,false);
    else shoot(player.x+player.facingX*400,player.y+player.facingY*400,true);
  }
  for (const enemy of enemies) if (gameState==="playing"&&enemy.alive) {
    enemy.hitFlash=Math.max(0,enemy.hitFlash-dt);
    const d=Math.hypot(player.x-enemy.x,player.y-enemy.y);
    if (d<390) { enemy.x+=(player.x-enemy.x)/(d||1)*enemy.speed*dt; enemy.y+=(player.y-enemy.y)/(d||1)*enemy.speed*dt; }
    enemy.x+=enemy.knockX*dt; enemy.y+=enemy.knockY*dt; enemy.knockX*=Math.max(0,1-dt*5); enemy.knockY*=Math.max(0,1-dt*5);
    if (d<player.radius+enemy.radius && player.invulnerable<=0) {
      player.lives--; player.invulnerable=1.7; updateLives();
      enemy.knockX=(enemy.x-player.x)*2.6; enemy.knockY=(enemy.y-player.y)*2.6;
      addBurst(player.x,player.y,"#f5a8c1"); messageElement.textContent="Ai! Respire e continue pela trilha.";
      if (player.lives<=0) { showHelp(); return; }
    }
  }
  for (let i=projectiles.length-1;i>=0;i--) {
    const shot=projectiles[i]; shot.x+=shot.vx*dt; shot.y+=shot.vy*dt; shot.life-=dt;
    let hit=false;
    for (const enemy of enemies) if (enemy.alive && Math.hypot(shot.x-enemy.x,shot.y-enemy.y)<enemy.radius+9) {
      enemy.alive=false; hit=true; addBurst(enemy.x,enemy.y); break;
    }
    if(!hit&&gameState==="boss-battle"&&Math.hypot(shot.x-boss.x,shot.y-boss.y)<boss.radius+12){
      hit=true;if(boss.mode==="open")damageBoss();else messageElement.textContent="O núcleo está protegido. Espere o cofre abrir.";
      if(gameState!=="boss-battle"){projectiles.length=0;break;}
    }
    if (hit||shot.life<=0||shot.x<camera.x-80||shot.x>camera.x+width+80||shot.y<camera.y-80||shot.y>camera.y+height+80) projectiles.splice(i,1);
  }
  if(gameState==="boss-battle")updateBoss(dt);
  updateParticles(dt);
  const atParis=player.x>2740&&player.y>routeY(2810)-150&&player.y<routeY(2810)+70;
  if (gameState==="playing"&&atParis) {
    if(score<requiredHearts){player.x=2700;messageElement.textContent=`Paris precisa de ${requiredHearts} corações. Você tem ${score}.`;}
    else if(enemies.some(enemy=>enemy.alive)){player.x=2700;messageElement.textContent="Derrote os inimigos que ainda guardam a rota até Paris.";}
    else startBossIntro();
  }
}

function updateLives() { livesElement.textContent="♥ ".repeat(Math.max(0,player.lives)).trim()||"♡"; }
function showHelp() {
  resumeState=gameState;gameState="help"; input.attack=false; clearMovement();
  if(resumeState==="boss-battle"){bossCoins.length=0;floorCoins.length=0;projectiles.length=0;bossHud.hidden=true;}
  gameArea.classList.add("story-open");
  modalTitle.textContent="Uma mensagem do Junior";
  modalText.textContent="Yanne, não desiste. Eu estou com você. 💗";
  modalButton.textContent="Vamos continuar"; modal.hidden=false; modal.dataset.scene="help";
}
function continueJourney() {
  if(gameState!=="help")return;
  clearMovement();
  player.lives=3; player.invulnerable=4;
  if(resumeState==="boss-battle"){
    const floor=routeY(2810)+156;player.x=2745;player.y=floor-35;
    boss.alive=true;boss.x=2845;boss.y=routeY(2810)-26;boss.mode="idle";boss.timer=1.35;boss.hitFlash=0;
    bossCoins.length=0;floorCoins.length=0;projectiles.length=0;bossHud.hidden=false;updateBossHealth();gameState="boss-battle";
  }else{
    player.x=Math.max(100,player.x-75);player.y=routeY(player.x);
    for(const enemy of enemies)if(enemy.alive&&Math.hypot(enemy.x-player.x,enemy.y-player.y)<250){const d=Math.hypot(enemy.x-player.x,enemy.y-player.y)||1;enemy.x+=((enemy.x-player.x)/d)*280;enemy.y+=((enemy.y-player.y)/d)*280;}
    gameState="playing";
  }
  updateLives();modal.hidden=true;gameArea.classList.remove("story-open");messageElement.textContent=resumeState==="boss-battle"?"Junior está com você. O Cobrador está enfraquecido — tente de novo!":"Junior está com você. Você consegue!";
}
function showFinal() {
  gameState="final"; clearMovement(); input.attack=false; finalStep=0;
  gameArea.classList.add("final-arrival","story-open");gameShell.classList.add("final-story");
  secondaryButton.hidden=true; soundButton.hidden=false;
  modal.dataset.scene="final-dialogue"; modal.hidden=false;
  showFinalMessage();
}
function showFinalMessage() {
  modalTitle.textContent=`Uma viagem, uma mensagem ${finalStep+1} de ${finalMessages.length}`;
  modalText.textContent=finalMessages[finalStep];
  modalButton.textContent="Continuar";
  modalButton.focus();
  // Reiniciar a animação deixa cada nova fala surgir com suavidade.
  const card=document.querySelector(".story-card");
  card.classList.remove("message-in"); void card.offsetWidth; card.classList.add("message-in");
}
function advanceFinal() {
  if(finalStep<finalMessages.length-1){finalStep++;showFinalMessage();return;}
  modal.hidden=true;gameArea.classList.remove("story-open");
  if(endingTimer)clearTimeout(endingTimer);
  endingTimer=setTimeout(showEnding,3000);
}
function showEnding() {
  endingTimer=null;
  if(gameState!=="final")return;
  document.querySelector(".story-card").classList.remove("message-in");
  modalTitle.textContent="Que um dia esse sonho se torne uma lembrança de verdade. 💗";
  modalText.textContent="Yanne e Junior, lado a lado diante da Torre Eiffel.";
  modalButton.textContent="Jogar novamente";
  secondaryButton.textContent="Rever as mensagens";secondaryButton.hidden=false;
  soundButton.hidden=false;modal.dataset.scene="final-ending";modal.hidden=false;gameArea.classList.add("story-open");
  modalButton.focus();
}
function replayFinalMessages() {
  if(endingTimer)clearTimeout(endingTimer);endingTimer=null;finalStep=0;
  modal.dataset.scene="final-dialogue";modal.hidden=false;gameArea.classList.add("story-open");secondaryButton.hidden=true;showFinalMessage();
}
function startAmbient() {
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass){soundButton.textContent="Áudio não disponível";soundButton.disabled=true;return;}
  try {
    if(!ambientContext){
      ambientContext=new AudioContextClass();ambientGain=ambientContext.createGain();ambientGain.gain.value=0;ambientGain.connect(ambientContext.destination);
      for(const [i,frequency] of ambientChords[0].entries()){
        const oscillator=ambientContext.createOscillator(),gain=ambientContext.createGain();
        oscillator.type="sine";oscillator.frequency.value=frequency;gain.gain.value=[.075,.05,.035][i];
        oscillator.connect(gain);gain.connect(ambientGain);oscillator.start();ambientOscillators.push(oscillator);
      }
    }
    ambientContext.resume();soundEnabled=true;chordIndex=0;
    ambientGain.gain.setTargetAtTime(.16,ambientContext.currentTime,.6);
    const changeChord=()=>{
      const chord=ambientChords[chordIndex%ambientChords.length];
      ambientOscillators.forEach((oscillator,i)=>oscillator.frequency.setTargetAtTime(chord[i],ambientContext.currentTime,.9));
      chordIndex++;
    };
    changeChord();ambientTimer=setInterval(changeChord,4800);
    soundButton.textContent="♫ Som suave: ligado";soundButton.setAttribute("aria-pressed","true");
  } catch(error) { soundButton.textContent="Áudio não disponível";soundButton.disabled=true; }
}
function stopAmbient() {
  if(ambientTimer){clearInterval(ambientTimer);ambientTimer=null;}
  if(ambientContext&&ambientGain)ambientGain.gain.setTargetAtTime(0,ambientContext.currentTime,.25);
  soundEnabled=false;soundButton.textContent="♫ Som suave: desligado";soundButton.setAttribute("aria-pressed","false");
}
function resetGame() {
  if(endingTimer)clearTimeout(endingTimer);endingTimer=null;stopAmbient();
  player.x=100;player.y=520;player.lives=3;player.invulnerable=0;score=0;gameState="playing";fireCooldown=0;finalStep=0;
  boss.x=2845;boss.y=routeY(2810)-26;boss.health=boss.maxHealth;boss.phase=1;boss.mode="sealed";boss.timer=0;boss.phaseTimer=0;boss.enterProgress=0;boss.hitFlash=0;boss.attackNumber=0;boss.alive=true;boss.defeatElapsed=0;
  hearts.forEach(h=>h.collected=false);enemies.forEach(e=>{e.alive=true;e.hitFlash=0;e.knockX=0;e.knockY=0;});projectiles.length=0;particles.length=0;
  bossCoins.length=0;floorCoins.length=0;bossHud.hidden=true;updateBossHealth();
  scoreElement.textContent=`0 / ${requiredHearts}`;updateLives();messageElement.textContent="Siga a trilha de pedras e flores até Paris!";modal.hidden=true;secondaryButton.hidden=true;soundButton.hidden=true;gameArea.classList.remove("final-arrival","story-open","boss-encounter");gameShell.classList.remove("final-story");clearMovement();
}

function clearMovement(){for(const k of ["up","down","left","right","attack"])input[k]=false;input.joystickX=0;input.joystickY=0;resetJoystick(true);document.querySelectorAll(".touch-button").forEach(b=>b.classList.remove("is-pressed"));}
function setDirection(button, value) { const d=button.dataset.direction; if(d)input[d]=value; }
const joystick=document.querySelector(".virtual-joystick");
const joystickKnob=joystick.querySelector(".joystick-knob");
let joystickPointerId=null;
function moveJoystick(event){
  const rect=joystick.getBoundingClientRect();
  const maxTravel=(rect.width-joystickKnob.offsetWidth)/2;
  const rawX=event.clientX-(rect.left+rect.width/2), rawY=event.clientY-(rect.top+rect.height/2);
  const distance=Math.hypot(rawX,rawY), scale=distance>maxTravel?maxTravel/distance:1;
  const offsetX=rawX*scale, offsetY=rawY*scale;
  input.joystickX=offsetX/maxTravel;input.joystickY=offsetY/maxTravel;
  joystickKnob.style.transform=`translate(${offsetX}px,${offsetY}px)`;
  joystick.classList.add("is-active");
}
function resetJoystick(releaseCapture=false){
  const activePointer=joystickPointerId;
  joystickPointerId=null;input.joystickX=0;input.joystickY=0;
  if(joystickKnob)joystickKnob.style.transform="translate(0,0)";
  if(joystick)joystick.classList.remove("is-active");
  if(releaseCapture&&activePointer!==null&&joystick.hasPointerCapture(activePointer))joystick.releasePointerCapture(activePointer);
}
const keyDirections={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
window.addEventListener("keydown",e=>{if(keyDirections[e.key]){e.preventDefault();if(modal.hidden&&(gameState==="playing"||gameState==="boss-battle"))input[keyDirections[e.key]]=true;}if(e.key===" "||e.key==="Enter"){if(!modal.hidden){if(!(e.target instanceof HTMLButtonElement)){e.preventDefault();modalButton.click();}}else if(gameState==="playing"||gameState==="boss-battle")input.attack=true;}});
window.addEventListener("keyup",e=>{if(keyDirections[e.key]){input[keyDirections[e.key]]=false;e.preventDefault();}if(e.key===" ")input.attack=false;});
joystick.addEventListener("pointerdown",event=>{
  if(joystickPointerId!==null)return;
  event.preventDefault();joystickPointerId=event.pointerId;joystick.setPointerCapture(event.pointerId);moveJoystick(event);
});
joystick.addEventListener("pointermove",event=>{if(event.pointerId===joystickPointerId){event.preventDefault();moveJoystick(event);}});
const releaseJoystick=event=>{
  if(event.pointerId!==joystickPointerId)return;
  if(joystick.hasPointerCapture(event.pointerId))joystick.releasePointerCapture(event.pointerId);
  resetJoystick();
};
joystick.addEventListener("pointerup",releaseJoystick);joystick.addEventListener("pointercancel",releaseJoystick);joystick.addEventListener("lostpointercapture",resetJoystick);
canvas.addEventListener("pointermove",e=>{if(e.pointerType==="mouse")mouseAim=worldAim(e);});
canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button===0){mouseAim=worldAim(e);shoot(mouseAim.x,mouseAim.y,false);}});
document.querySelectorAll(".touch-button").forEach(button=>{
  button.addEventListener("pointerdown",e=>{e.preventDefault();button.setPointerCapture(e.pointerId);button.classList.add("is-pressed");if(button.dataset.direction)setDirection(button,true);if(button.dataset.action==="attack")input.attack=true;});
  const release=e=>{if(e&&button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);if(button.dataset.direction)setDirection(button,false);if(button.dataset.action==="attack")input.attack=false;button.classList.remove("is-pressed");};
  button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);button.addEventListener("lostpointercapture",()=>{if(button.dataset.direction)setDirection(button,false);if(button.dataset.action==="attack")input.attack=false;button.classList.remove("is-pressed");});
});
window.addEventListener("blur",clearMovement);document.addEventListener("visibilitychange",()=>{if(document.hidden)clearMovement();});
document.querySelector("#restart-button").addEventListener("click",resetGame);
modalButton.addEventListener("click",()=>{
  if(modal.dataset.scene==="help")continueJourney();
  else if(modal.dataset.scene==="boss-intro")startBossBattle();
  else if(modal.dataset.scene==="final-dialogue")advanceFinal();
  else if(modal.dataset.scene==="final-ending")resetGame();
});
secondaryButton.addEventListener("click",replayFinalMessages);
soundButton.addEventListener("click",()=>soundEnabled?stopAmbient():startAmbient());
function frame(time){const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;update(dt);drawWorld();requestAnimationFrame(frame);}
new ResizeObserver(resizeCanvas).observe(canvas);resizeCanvas();cacheMapBackground();
window.addEventListener("resize",resizeCanvas);window.addEventListener("orientationchange",resizeCanvas);
if(window.visualViewport)window.visualViewport.addEventListener("resize",resizeCanvas);
updateLives();scoreElement.textContent=`0 / ${requiredHearts}`;requestAnimationFrame(frame);
