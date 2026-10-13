(function (root, factory) {
  const roster = factory();
  if (typeof module === 'object' && module.exports) module.exports = roster;
  else root.GOALKEEPER_ROSTER = roster;
})(globalThis, function () {
  const roster = [
    { id: 'rookie', name: 'Rookie', title: 'El debutante', unlockRating: 0, colors: ['#28d17c', '#086b55', '#ffe05a', '#183447'], skin: '#f2bd91', hair: '#25334c', style: 'headband', sigil: '01' },
    { id: 'blitz', name: 'Kaito Blitz', title: 'Relámpago azul', unlockRating: 1200, colors: ['#36d9ff', '#1451b8', '#f8f8ff', '#16284d'], skin: '#e9b08b', hair: '#172344', style: 'spikes', sigil: '02' },
    { id: 'sol', name: 'Sol Vega', title: 'Guardiana solar', unlockRating: 1400, colors: ['#ffb52e', '#d84e20', '#fff078', '#51301e'], skin: '#bd7650', hair: '#301d26', style: 'ponytail', sigil: '03' },
    { id: 'frost', name: 'Nix Boreal', title: 'Muro de hielo', unlockRating: 1600, colors: ['#9ff6ff', '#347cb4', '#e5fdff', '#243c63'], skin: '#f4d1b3', hair: '#d8f1ff', style: 'visor', sigil: '04' },
    { id: 'crimson', name: 'Akira Rojo', title: 'Instinto carmesí', unlockRating: 1800, colors: ['#ff4765', '#8b183d', '#ffc34d', '#321b31'], skin: '#edbb91', hair: '#55152f', style: 'bandana', sigil: '05' },
    { id: 'mecha', name: 'MECHA-09', title: 'Unidad imparable', unlockRating: 2000, colors: ['#b4ff55', '#318b67', '#faffdc', '#293843'], skin: '#b5d6cb', hair: '#33434e', style: 'helmet', sigil: '09' },
    { id: 'kitsune', name: 'Yuki Kitsune', title: 'Zorro de la noche', unlockRating: 2200, colors: ['#c17aff', '#5425a0', '#ffcf65', '#202448'], skin: '#f4c9a8', hair: '#312347', style: 'ears', sigil: '狐' },
    { id: 'titan', name: 'Titán Solar', title: 'La última muralla', unlockRating: 2400, colors: ['#ffe45e', '#c67713', '#fff2b3', '#493326'], skin: '#8e533c', hair: '#28232b', style: 'crown', sigil: '★' }
  ];
  roster.forEach((keeper, index) => { keeper.artIndex = index; });
  const byId = value => {
    const id = typeof value === 'string' ? value : value?.id;
    return roster.find(item => item.id === id) || roster[0];
  };
  const cardArt = typeof Image !== 'undefined' ? new Image() : null;
  if (cardArt) {
    cardArt.src = './assets/goalkeeper-cutouts.png';
    cardArt.onload = () => document.querySelectorAll('.keeper-card__portrait').forEach(canvas =>
      paintPortrait(canvas, canvas.dataset.keeperId, canvas.parentElement.classList.contains('is-equipped')));
  }

  function draw(ctx, keeper, x = 0, y = 0, scale = 1, time = 0, diving = false, diveRotation = 0, diveProgress = 0, anticipating = false, diveDirection = 0, keeperState = 'idle', landingTimer = 0) {
    if (!cardArt?.complete || !cardArt.naturalWidth) return;
    const p = byId(keeper);
    const cellWidth = cardArt.naturalWidth / 4;
    const cellHeight = cardArt.naturalHeight / 2;
    const sourceX = (p.artIndex % 4) * cellWidth;
    const sourceY = Math.floor(p.artIndex / 4) * cellHeight;
    const spriteScale = scale * .22;
    const drawWidth = cellWidth * spriteScale;
    const drawHeight = cellHeight * spriteScale;
    const direction = diveDirection || (diveRotation < 0 ? -1 : 1);
    const motion = Math.max(0, Math.min(1, diveProgress));
    const landing = ['saved', 'beaten'].includes(keeperState) ? Math.max(0, 1 - landingTimer / .58) : 0;
    const idlePhase = time * [1.2, 2.7, 1.1, .8, 1.9, 1.35, 1.05, .9][p.artIndex];
    const anticipationTilt = anticipating ? direction * .045 : 0;
    const diveTilt = diving ? Math.max(-.14, Math.min(.14, diveRotation * .16)) : 0;
    const landingTilt = landing * diveRotation * .08;
    const breathing = Math.sin(idlePhase) * .8;
    const footX = x + (diving ? -direction * motion * 3 : Math.sin(idlePhase * .55) * 1.2);
    const footY = y + 40 + breathing - (diving ? Math.sin(motion * Math.PI) * 5 : 0);
    // The source art is the actual roster character. Anchor its feet to the pitch
    // and animate the whole illustration, preserving its face, kit, and silhouette.
    const top = footY - cellHeight * .9 * spriteScale;
    const left = footX - drawWidth / 2;

    ctx.save();
    ctx.globalAlpha = .42;
    ctx.fillStyle = '#020916';
    ctx.beginPath();
    ctx.ellipse(footX, y + 40, 24 + motion * 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (diving && motion < .72) {
      ctx.save();
      ctx.globalAlpha = .13 * (1 - motion);
      ctx.translate(-direction * 10, -3);
      ctx.drawImage(cardArt, sourceX, sourceY, cellWidth, cellHeight, left, top, drawWidth, drawHeight);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(footX, footY);
    ctx.rotate(anticipationTilt + diveTilt + landingTilt + Math.sin(idlePhase) * .008);
    ctx.translate(-footX, -footY);
    if (anticipating) {
      ctx.save();
      ctx.globalAlpha = .18 + Math.sin(time * 24) * .05;
      ctx.strokeStyle = p.colors[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(footX, y + 36, 29 + Math.sin(time * 18) * 2, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.drawImage(cardArt, sourceX, sourceY, cellWidth, cellHeight, left, top, drawWidth, drawHeight);
    ctx.restore();
  }

  function paintPortrait(canvas, keeper, selected = false) {
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 112, height = canvas.clientHeight || 104;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.scale(ratio, ratio);
    const p = byId(keeper);
    canvas.dataset.keeperId = p.id;
    if (cardArt?.complete && cardArt.naturalWidth) {
      const cellWidth = cardArt.naturalWidth / 4;
      const cellHeight = cardArt.naturalHeight / 2;
      const sourceHeight = Math.min(cellHeight, cellWidth * height / width);
      const sourceX = (p.artIndex % 4) * cellWidth;
      const sourceY = Math.floor(p.artIndex / 4) * cellHeight;
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#12344b'); bg.addColorStop(.52, p.colors[1]); bg.addColorStop(1, '#07111e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * .5, height * .32, 2, width * .5, height * .32, width * .8);
      glow.addColorStop(0, `${p.colors[0]}99`); glow.addColorStop(1, `${p.colors[0]}00`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(cardArt, sourceX, sourceY, cellWidth, sourceHeight, 0, 0, width, height);
      const shade = ctx.createLinearGradient(0, height * .55, 0, height);
      shade.addColorStop(0, 'rgba(3,12,26,0)'); shade.addColorStop(1, 'rgba(3,12,26,.42)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = p.colors[0]; ctx.lineWidth = selected ? 3 : 1.5; ctx.strokeRect(1, 1, width - 2, height - 2);
      return;
    }
    const [bright,dark,trim] = p.colors;
    const bg = ctx.createLinearGradient(0,0,width,height);
    bg.addColorStop(0, '#71d8ff'); bg.addColorStop(.34, '#d8f6ff'); bg.addColorStop(.48, dark); bg.addColorStop(1, '#050b18');
    ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
    // Anime stadium: floodlights, packed stands, sweeping roof and pitch.
    ctx.fillStyle='rgba(255,255,255,.8)';
    for(let i=0;i<7;i++){const lx=width*(.08+i*.14);ctx.beginPath();ctx.moveTo(lx,0);ctx.lineTo(lx+width*.08,height*.38);ctx.lineTo(lx-width*.02,height*.38);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#10243d';ctx.beginPath();ctx.moveTo(0,height*.34);ctx.quadraticCurveTo(width*.5,height*.23,width,height*.34);ctx.lineTo(width,height*.52);ctx.lineTo(0,height*.52);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ed5b83';ctx.fillRect(0,height*.37,width,height*.08);
    for(let i=0;i<70;i++){ctx.fillStyle=i%3?'#fff0d2':'#7be5ff';ctx.globalAlpha=.4+(i%4)*.1;ctx.fillRect((i*37)%width,height*(.38+(i%5)*.012),2,2);}
    ctx.globalAlpha=1;
    ctx.fillStyle='#20b763';ctx.fillRect(0,height*.52,width,height*.48);
    ctx.fillStyle='rgba(255,255,255,.11)';for(let i=0;i<6;i++)ctx.fillRect(i*width/3,height*.52,width/6,height*.48);
    ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(width/2,height*.91,width*.46,height*.25,0,Math.PI,Math.PI*2);ctx.stroke();
    const glow=ctx.createRadialGradient(width*.52,height*.42,2,width*.52,height*.42,width*.72);
    glow.addColorStop(0,bright+'bb'); glow.addColorStop(1,bright+'00'); ctx.fillStyle=glow; ctx.fillRect(0,height*.25,width,height*.75);
    ctx.save(); ctx.globalAlpha=.3; ctx.strokeStyle=trim; ctx.lineWidth=1.2;
    for(let i=-height;i<width+height;i+=18){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+height*.72,height);ctx.stroke();}
    ctx.restore();
    ctx.save(); ctx.translate(width/2,height*.51); ctx.scale(width/108,height/160);
    ctx.shadowColor=bright; ctx.shadowBlur=selected?22:11;
    // Shoulder silhouette and a high collar frame the portrait like a character card.
    ctx.fillStyle=dark; ctx.beginPath(); ctx.moveTo(-57,82); ctx.quadraticCurveTo(-51,35,-25,31); ctx.lineTo(-14,23); ctx.lineTo(14,23); ctx.lineTo(25,31); ctx.quadraticCurveTo(51,35,57,82); ctx.closePath(); ctx.fill();
    const jacket=ctx.createLinearGradient(-40,20,35,80); jacket.addColorStop(0,bright); jacket.addColorStop(1,dark);
    ctx.fillStyle=jacket; ctx.beginPath(); ctx.moveTo(-47,78);ctx.lineTo(-38,44);ctx.lineTo(-17,31);ctx.lineTo(0,48);ctx.lineTo(17,31);ctx.lineTo(38,44);ctx.lineTo(47,78);ctx.closePath();ctx.fill();
    ctx.fillStyle=trim;ctx.beginPath();ctx.moveTo(-17,30);ctx.lineTo(0,47);ctx.lineTo(17,30);ctx.lineTo(10,25);ctx.lineTo(-10,25);ctx.closePath();ctx.fill();
    // Neck, face and oversized expressive anime eyes.
    ctx.fillStyle=p.skin;ctx.fillRect(-10,16,20,22);
    ctx.fillStyle=p.skin;ctx.beginPath();ctx.ellipse(0,-14,31,37,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.ellipse(-12,-23,6,10,-.35,0,Math.PI*2);ctx.fill();
    // Hair mass with sharp, character-specific bangs.
    ctx.fillStyle=p.hair;ctx.beginPath();ctx.moveTo(-31,-12);ctx.quadraticCurveTo(-39,-57,-9,-53);ctx.quadraticCurveTo(16,-62,31,-36);ctx.lineTo(29,-7);
    if(p.style==='spikes'){ctx.lineTo(41,-51);ctx.lineTo(19,-42);ctx.lineTo(10,-63);ctx.lineTo(-2,-43);ctx.lineTo(-22,-58);ctx.lineTo(-17,-34);}
    else if(p.style==='ears'){ctx.lineTo(37,-52);ctx.lineTo(16,-36);ctx.lineTo(6,-47);ctx.lineTo(-8,-32);ctx.lineTo(-21,-48);}
    else {ctx.lineTo(19,-26);ctx.lineTo(8,-35);ctx.lineTo(1,-22);ctx.lineTo(-9,-38);ctx.lineTo(-19,-25);}
    ctx.closePath();ctx.fill();
    if(p.style==='ponytail'){ctx.fillStyle=p.hair;ctx.beginPath();ctx.moveTo(24,-37);ctx.quadraticCurveTo(58,-34,41,5);ctx.quadraticCurveTo(31,20,25,-4);ctx.closePath();ctx.fill();}
    if(p.style==='ears'||p.style==='crown'){
      ctx.fillStyle=p.style==='ears'?p.hair:trim;ctx.beginPath();ctx.moveTo(-20,-43);ctx.lineTo(-32,-78);ctx.lineTo(-5,-51);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(20,-43);ctx.lineTo(32,-78);ctx.lineTo(5,-51);ctx.closePath();ctx.fill();
      if(p.style==='ears'){ctx.fillStyle='#f49ba8';ctx.beginPath();ctx.moveTo(-24,-54);ctx.lineTo(-29,-70);ctx.lineTo(-15,-54);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(24,-54);ctx.lineTo(29,-70);ctx.lineTo(15,-54);ctx.closePath();ctx.fill();}
    }
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(-12,-12,8,11,-.08,0,Math.PI*2);ctx.ellipse(12,-12,8,11,.08,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.eyes||bright;ctx.beginPath();ctx.ellipse(-11,-10,5.4,8.4,0,0,Math.PI*2);ctx.ellipse(11,-10,5.4,8.4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#101629';ctx.beginPath();ctx.ellipse(-11,-8,2.5,5,0,0,Math.PI*2);ctx.ellipse(11,-8,2.5,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-13,-14,2.3,0,Math.PI*2);ctx.arc(9,-14,2.3,0,Math.PI*2);ctx.arc(-8,-5,1,0,Math.PI*2);ctx.arc(14,-5,1,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.hair;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-21,-27);ctx.lineTo(-7,-29);ctx.moveTo(7,-29);ctx.lineTo(21,-27);ctx.stroke();
    ctx.strokeStyle='#a95556';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-3,3);ctx.quadraticCurveTo(0,6,4,3);ctx.stroke();
    if(p.style==='headband'||p.style==='bandana'){ctx.fillStyle=trim;ctx.beginPath();ctx.roundRect(-30,-39,60,7,3);ctx.fill();ctx.fillRect(25,-36,16,4);}
    if(p.style==='visor'||p.style==='helmet'||p.style==='crown'){ctx.fillStyle=p.style==='visor'?'#b7eaf2':trim;ctx.beginPath();ctx.roundRect(-31,-43,62,10,4);ctx.fill();if(p.style==='visor'){ctx.fillStyle='rgba(42,90,117,.7)';ctx.beginPath();ctx.roundRect(-27,-41,54,6,3);ctx.fill();}}
    ctx.shadowBlur=0;ctx.fillStyle=trim;ctx.font='900 9px sans-serif';ctx.textAlign='right';ctx.fillText(p.sigil,48,73);
    ctx.restore();
    // Foil slash and top rank plate.
    const shine=ctx.createLinearGradient(0,0,width,height);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.48,'#ffffff00');shine.addColorStop(.53,'#ffffff38');shine.addColorStop(.58,'#ffffff00');shine.addColorStop(1,'#ffffff00');
    ctx.fillStyle=shine;ctx.fillRect(0,0,width,height);
    ctx.strokeStyle=bright;ctx.globalAlpha=selected?.95:.55;ctx.lineWidth=selected?2.5:1.2;ctx.strokeRect(2,2,width-4,height-4);ctx.globalAlpha=1;
  }
  return { roster, byId, draw, paintPortrait };
});
