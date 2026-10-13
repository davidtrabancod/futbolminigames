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
  const byId = id => roster.find(item => item.id === id) || roster[0];

  function draw(ctx, keeper, x = 0, y = 0, scale = 1, time = 0, diving = false) {
    const p = byId(typeof keeper === 'string' ? keeper : keeper?.id);
    const [bright, dark, trim, shorts] = p.colors;
    ctx.save();
    const rhythm = p.style === 'spikes' || p.style === 'bandana' ? 5 : p.style === 'helmet' ? 2 : 3.2;
    ctx.translate(x, y + Math.sin(time * rhythm) * (diving ? 0 : (p.style === 'helmet' ? .6 : 1.4)));
    ctx.rotate(diving ? Math.sin(time * 8) * 0.11 : Math.sin(time * rhythm * .5) * (p.style === 'ponytail' ? .035 : .012));
    ctx.scale(scale, scale);
    ctx.shadowColor = bright;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 41, 29, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Back accessories make each silhouette readable from the field.
    if (p.style === 'ponytail') {
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.ellipse(20, -42, 8, 23, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.hair; ctx.beginPath(); ctx.moveTo(9,-51); ctx.quadraticCurveTo(30,-56,29,-36); ctx.quadraticCurveTo(25,-21,17,-27); ctx.closePath(); ctx.fill();
    }
    if (p.style === 'ears' || p.style === 'crown') {
      ctx.fillStyle = p.style === 'ears' ? p.hair : trim;
      ctx.beginPath(); ctx.moveTo(-12,-52); ctx.lineTo(-22,-73); ctx.lineTo(-2,-60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12,-52); ctx.lineTo(22,-73); ctx.lineTo(2,-60); ctx.closePath(); ctx.fill();
    }
    // Legs, socks and cleats
    ctx.fillStyle = shorts; ctx.beginPath(); ctx.roundRect(-17,-2,34,20,5); ctx.fill();
    ctx.fillStyle = bright; ctx.fillRect(-14,13,9,22); ctx.fillRect(5,13,9,22);
    ctx.fillStyle = trim; ctx.fillRect(-14,25,9,3); ctx.fillRect(5,25,9,3);
    ctx.fillStyle = '#111b2c'; ctx.beginPath(); ctx.roundRect(-18,34,15,7,3); ctx.roundRect(3,34,15,7,3); ctx.fill();

    // Dynamic keeper tunic with piping and chest badge.
    const grad = ctx.createLinearGradient(-20,-31,20,15); grad.addColorStop(0,bright); grad.addColorStop(1,dark);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(-13,-32); ctx.lineTo(-22,-24); ctx.lineTo(-19,1); ctx.quadraticCurveTo(0,7,19,1); ctx.lineTo(22,-24); ctx.lineTo(13,-32); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = trim; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(-18,-19); ctx.lineTo(-15,-1); ctx.moveTo(18,-19); ctx.lineTo(15,-1); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-8,-31); ctx.lineTo(0,-23); ctx.lineTo(8,-31); ctx.lineTo(4,-34); ctx.lineTo(-4,-34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.sigil, 0, -7);
    ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(-11,-13,3.2,0,Math.PI*2); ctx.fill();

    // Face and anime hair.
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.ellipse(0,-44,13,15,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-5,-48,3,5,-.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = p.hair; ctx.beginPath();
    ctx.moveTo(-14,-45); ctx.quadraticCurveTo(-19,-65,-4,-63); ctx.quadraticCurveTo(2,-70,9,-61); ctx.quadraticCurveTo(19,-57,14,-43);
    if (p.style === 'spikes') { ctx.lineTo(18,-60); ctx.lineTo(7,-56); ctx.lineTo(2,-68); ctx.lineTo(-4,-57); ctx.lineTo(-15,-61); }
    else { ctx.lineTo(9,-50); ctx.lineTo(3,-55); ctx.lineTo(-2,-50); ctx.lineTo(-8,-56); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-5,-43,3.1,4,0,0,Math.PI*2); ctx.ellipse(5,-43,3.1,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = p.eyes || bright; ctx.beginPath(); ctx.ellipse(-5,-42.5,1.9,3,0,0,Math.PI*2); ctx.ellipse(5,-42.5,1.9,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#17243a'; ctx.beginPath(); ctx.arc(-5,-42,1.1,0,Math.PI*2); ctx.arc(5,-42,1.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5.7,-44,1,0,Math.PI*2); ctx.arc(4.3,-44,1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = p.hair; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-8,-48); ctx.lineTo(-3,-49); ctx.moveTo(3,-49); ctx.lineTo(8,-48); ctx.stroke();
    ctx.strokeStyle = '#a95556'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2,-36); ctx.quadraticCurveTo(0,-34,3,-36); ctx.stroke();
    if (p.style === 'headband' || p.style === 'bandana') { ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(-14,-53,28,4,2); ctx.fill(); ctx.fillRect(10,-51,9,3); }
    if (p.style === 'visor' || p.style === 'helmet' || p.style === 'crown') {
      ctx.fillStyle = p.style === 'visor' ? 'rgba(31,53,82,.9)' : trim;
      ctx.beginPath(); ctx.roundRect(-15,-57,30,7,3); ctx.fill();
      if (p.style === 'helmet') { ctx.fillStyle=bright; ctx.beginPath(); ctx.arc(0,-56,3,0,Math.PI*2); ctx.fill(); }
      if (p.style === 'crown') { ctx.fillStyle=trim; ctx.beginPath(); ctx.moveTo(-10,-57); ctx.lineTo(-8,-67); ctx.lineTo(-2,-60); ctx.lineTo(2,-68); ctx.lineTo(7,-60); ctx.lineTo(10,-57); ctx.closePath(); ctx.fill(); }
    }

    const span = diving ? 43 : 28;
    const gloveY = diving ? -44 : -16;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(side * span, gloveY); ctx.rotate(side * (diving ? -.45 : .12));
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(-11,-13,22,24,7); ctx.fill();
      ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(-12,-19,24,13,6); ctx.fill();
      ctx.strokeStyle = bright; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7,-15); ctx.lineTo(7,-15); ctx.stroke();
      ctx.restore();
    }
    if (p.style === 'ears' || p.style === 'crown') {
      ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.arc(0,-8,29+Math.sin(time*4)*2,Math.PI*1.08,Math.PI*1.92); ctx.stroke();
    }
    ctx.restore();
  }

  function paintPortrait(canvas, keeper, selected = false) {
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 112, height = canvas.clientHeight || 104;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.scale(ratio, ratio);
    const p = byId(keeper);
    const [bright,dark,trim] = p.colors;
    const bg = ctx.createLinearGradient(0,0,width,height);
    bg.addColorStop(0, dark); bg.addColorStop(.58, '#101a34'); bg.addColorStop(1, '#050b18');
    ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.52,height*.36,2,width*.52,height*.36,width*.72);
    glow.addColorStop(0,bright+'bb'); glow.addColorStop(1,bright+'00'); ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
    ctx.save(); ctx.globalAlpha=.35; ctx.strokeStyle=trim; ctx.lineWidth=1.2;
    for(let i=-height;i<width+height;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+height*.72,height);ctx.stroke();}
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
