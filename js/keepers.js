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
  const diveArt = typeof Image !== 'undefined' ? new Image() : null;
  const centerArt = typeof Image !== 'undefined' ? new Image() : null;
  const lowLeftArt = typeof Image !== 'undefined' ? new Image() : null;
  const lowRightArt = typeof Image !== 'undefined' ? new Image() : null;
  if (diveArt) diveArt.src = './assets/goalkeeper-dive-frames.png';
  if (centerArt) centerArt.src = './assets/goalkeeper-center-frames-v2.png';
  if (lowLeftArt) lowLeftArt.src = './assets/goalkeeper-low-left-v2.png';
  if (lowRightArt) lowRightArt.src = './assets/goalkeeper-low-right-v2.png';
  if (cardArt) {
    cardArt.src = './assets/goalkeeper-models.png';
    cardArt.onload = () => document.querySelectorAll('.keeper-card__portrait').forEach(canvas =>
      paintPortrait(canvas, canvas.dataset.keeperId, canvas.parentElement.classList.contains('is-equipped')));
  }

  function getContactOffset(zoneId, scale = 1) {
    if (zoneId === 'center') return { x: 42 * scale, y: 8 * scale };
    if (zoneId?.startsWith('bottom')) return { x: (zoneId.endsWith('left') ? -70 : 70) * scale, y: 65 * scale };
    const direction = zoneId?.endsWith('left') ? -1 : 1;
    const angle = direction * -.035;
    const gloveX = direction * 113 * scale * .68;
    const gloveY = -72 * scale * .68;
    return {
      x: gloveX * Math.cos(angle) - gloveY * Math.sin(angle),
      y: -28 + gloveX * Math.sin(angle) + gloveY * Math.cos(angle)
    };
  }

  function draw(ctx, keeper, x = 0, y = 0, scale = 1, time = 0, diving = false, diveRotation = 0, diveProgress = 0, anticipating = false, diveDirection = 0, keeperState = 'idle', landingTimer = 0, zoneId = null) {
    if (!cardArt?.complete || !cardArt.naturalWidth) return;
    const p = byId(keeper);
    const frameSize = 256;
    const spriteScale = scale * .68;
    const direction = diveDirection || Math.sign(diveRotation);
    const motion = Math.max(0, Math.min(1, diveProgress));
    const landing = ['saved', 'beaten'].includes(keeperState) ? Math.max(0, 1 - landingTimer / 1.2) : 0;
    const idlePhase = time * [1.2, 2.7, 1.1, .8, 1.9, 1.35, 1.05, .9][p.artIndex];
    const breath = Math.sin(idlePhase);
    const diveFrame = direction < 0 ? 2 : direction > 0 ? 3 : 1;
    const center = zoneId === 'center';
    const low = zoneId?.startsWith('bottom');
    const finalAngle = direction * -.035;
    const footX = x + (diving ? -direction * motion * 3 : Math.sin(idlePhase * .55) * 1.2);
    const footY = y + 40 + (diving ? 0 : breath * .8) - (diving ? Math.sin(motion * Math.PI) * 5 : 0);

    const drawPose = (pose, alpha, offsetX = 0, offsetY = 0, angle = 0) => {
      if (alpha <= .01) return;
      const sourceX = pose * frameSize;
      const sourceY = p.artIndex * frameSize;
      const standing = pose < 2;
      const anchorX = x + offsetX;
      const anchorY = (standing ? footY : y - 28) + offsetY;
      const left = anchorX - frameSize * spriteScale / 2;
      const top = standing
        ? anchorY - 244 * spriteScale
        : anchorY - frameSize * spriteScale / 2;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(anchorX, anchorY);
      ctx.rotate(angle);
      ctx.translate(-anchorX, -anchorY);
      ctx.drawImage(cardArt, sourceX, sourceY, frameSize, frameSize, left, top, frameSize * spriteScale, frameSize * spriteScale);
      ctx.restore();
    };
    const drawDivePose = (frame, alpha, offsetY = 0, angle = 0) => {
      if (alpha <= .01 || !diveArt?.complete || !diveArt.naturalWidth) return;
      const anchorX = x;
      const anchorY = y - 28 + offsetY;
      const left = anchorX - frameSize * spriteScale / 2;
      const top = anchorY - frameSize * spriteScale / 2;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(anchorX, anchorY);
      ctx.rotate(angle);
      ctx.translate(-anchorX, -anchorY);
      ctx.drawImage(diveArt, frame * frameSize, p.artIndex * frameSize, frameSize, frameSize,
        left, top, frameSize * spriteScale, frameSize * spriteScale);
      ctx.restore();
    };

    const drawCenterPose = (frame, alpha) => {
      if (alpha <= .01 || !centerArt?.complete || !centerArt.naturalWidth) return;
      const cell = centerArt.naturalWidth / 4;
      const centerScale = scale * .78;
      const size = cell * centerScale;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(centerArt, frame * cell, p.artIndex * cell, cell, cell,
        x - size / 2, y - size / 2, size, size);
      ctx.restore();
    };

    const drawLowPose = (frame, alpha, value) => {
      const art = direction < 0 ? lowLeftArt : lowRightArt;
      if (alpha <= .01 || !art?.complete || !art.naturalWidth) return;
      const cell = art.naturalWidth / 4;
      const size = cell * scale * .78;
      const trimRight = frame < 3 ? 16 : 0;
      // Early crouch frames have feet lower inside their cells than the dive
      // frame. Keep them on the goal line and release that offset in flight.
      const groundOffset = (1 - value) * 50;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(art, frame * cell, p.artIndex * cell, cell - trimRight, cell,
        x - size / 2, y - groundOffset - size / 2, size * (1 - trimRight / cell), size);
      ctx.restore();
    };

    // Every display refresh draws a frame between these hand-authored poses.
    // Body travel and rotation are continuous; the brief pose transitions keep
    // the illustrated limbs from popping without prolonged ghost silhouettes.
    const blend = (start, end, value) => Math.max(0, Math.min(1, (value - start) / (end - start)));
    const drawSideSequence = value => {
      const lowArt = direction < 0 ? lowLeftArt : lowRightArt;
      if (low && lowArt?.complete && lowArt.naturalWidth) {
        if (value < .18) {
          const mix = blend(.07, .18, value);
          drawPose(1, 1 - mix);
          drawLowPose(0, mix, value);
        } else if (value < .44) {
          const mix = blend(.35, .44, value);
          drawLowPose(0, 1 - mix, value);
          drawLowPose(1, mix, value);
        } else if (value < .7) {
          const mix = blend(.61, .7, value);
          drawLowPose(1, 1 - mix, value);
          drawLowPose(2, mix, value);
        } else {
          const mix = blend(.82, .96, value);
          drawLowPose(2, 1 - mix, value);
          drawLowPose(3, mix, value);
        }
        return;
      }
      const first = direction < 0 ? 0 : 3;
      const angle = finalAngle * blend(.08, .92, value);
      const settle = -Math.sin(value * Math.PI) * 5;
      if (!diveArt?.complete || !diveArt.naturalWidth || !direction) {
        drawPose(1, 1 - blend(.08, .2, value));
        drawPose(diveFrame, blend(.08, .2, value), 0, settle, angle);
      } else if (value < .16) {
        const mix = blend(.05, .16, value);
        drawPose(1, 1 - mix, 0, -2, direction * -.025);
        drawDivePose(first, mix, settle, angle);
      } else if (value < .43) {
        const mix = blend(.34, .43, value);
        drawDivePose(first, 1 - mix, settle, angle);
        drawDivePose(first + 1, mix, settle, angle);
      } else if (value < .69) {
        const mix = blend(.6, .69, value);
        drawDivePose(first + 1, 1 - mix, settle, angle);
        drawDivePose(first + 2, mix, settle, angle);
      } else {
        const mix = blend(.82, .96, value);
        drawDivePose(first + 2, 1 - mix, settle, angle);
        drawPose(diveFrame, mix, 0, settle, angle);
      }
    };

    const drawCenterSequence = value => {
      if (!centerArt?.complete || !centerArt.naturalWidth) {
        drawPose(1, 1);
        return;
      }
      if (value < .49) {
        const mix = blend(.36, .49, value);
        drawCenterPose(0, 1 - mix);
        drawCenterPose(1, mix);
      } else {
        const mix = blend(.64, .8, value);
        drawCenterPose(1, 1 - mix);
        drawCenterPose(2, mix);
      }
    };

    ctx.save();
    ctx.globalAlpha = .42;
    ctx.fillStyle = '#020916';
    ctx.beginPath();
    ctx.ellipse(footX, y + 40, 24 + (diving ? 12 : 0), 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (diving && !low) {
      ctx.save();
      ctx.globalAlpha = .16 + motion * .18;
      ctx.strokeStyle = p.colors[0];
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const streakY = y - 58 + i * 19;
        const length = 18 + motion * (18 + (i % 3) * 6);
        ctx.beginPath();
        ctx.moveTo(footX - direction * 10, streakY);
        ctx.lineTo(footX - direction * (10 + length), streakY - 4 + (i % 2) * 7);
        ctx.stroke();
      }
      ctx.restore();
    } else if (landing > .78) {
      ctx.save();
      ctx.globalAlpha = (landing - .78) * 1.8;
      ctx.strokeStyle = p.colors[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 40, 27 + (1 - landing) * 30, 5 + (1 - landing) * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (diving) {
      if (center) drawCenterSequence(motion);
      else drawSideSequence(motion);
    } else if (landing > 0) {
      if (landing < .05) {
        drawPose(0, 1 - landing / .05);
        if (center) drawCenterPose(0, landing / .05);
        else drawPose(1, landing / .05);
      } else if (center) drawCenterSequence(landing);
      else drawSideSequence(landing);
    } else if (anticipating) {
      drawPose(1, 1, 0, -2, direction * -.025);
    } else {
      drawPose(0, 1, 0, -Math.abs(breath) * 1.2, Math.sin(idlePhase * .5) * .008);
    }

    if (anticipating) {
      ctx.save();
      ctx.globalAlpha = .18 + Math.sin(time * 24) * .05;
      ctx.strokeStyle = p.colors[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(footX, y + 36, 29 + Math.sin(time * 18) * 2, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (!diving && landing <= 0) {
      ctx.save();
      ctx.globalAlpha = .055 + (breath + 1) * .025;
      ctx.strokeStyle = p.colors[0];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(footX, y + 39, 27 + breath * 1.5, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
      const frameSize = 256;
      const sourceY = p.artIndex * frameSize;
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#12344b'); bg.addColorStop(.52, p.colors[1]); bg.addColorStop(1, '#07111e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * .5, height * .32, 2, width * .5, height * .32, width * .8);
      glow.addColorStop(0, `${p.colors[0]}99`); glow.addColorStop(1, `${p.colors[0]}00`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(cardArt, 44, sourceY + 8, 168, 234, 0, 0, width, height);
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
  return { roster, byId, draw, paintPortrait, getContactOffset };
});
