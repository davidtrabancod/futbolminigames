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
    cardArt.src = './assets/goalkeeper-roster.png';
    cardArt.onload = () => document.querySelectorAll('.keeper-card__portrait').forEach(canvas =>
      paintPortrait(canvas, canvas.dataset.keeperId, canvas.parentElement.classList.contains('is-equipped')));
  }

  function drawSegment(ctx, a, b, width, color, highlight) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = '#101a2a'; ctx.lineWidth = width + 5; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    if (highlight) {
      ctx.beginPath(); ctx.moveTo(a.x - width * .16, a.y - width * .12); ctx.lineTo(b.x - width * .16, b.y - width * .12);
      ctx.strokeStyle = highlight; ctx.lineWidth = Math.max(1.5, width * .19); ctx.stroke();
    }
    ctx.restore();
  }

  function drawGlove(ctx, x, y, angle, p, openness = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const [bright, dark, trim] = p.colors;
    ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(-10, -7, 21, 17, 6); ctx.fill();
    ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(-10, -8, 20, 15, 5); ctx.fill();
    ctx.strokeStyle = bright; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(7, 3); ctx.stroke();
    for (let finger = 0; finger < 4; finger++) {
      const offset = (finger - 1.5) * 4.3;
      const spread = (finger - 1.5) * openness * 2.1;
      ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(offset, -4); ctx.lineTo(offset + spread, -13 - (finger === 1 || finger === 2 ? 3 : 0)); ctx.stroke();
      ctx.strokeStyle = trim; ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(offset, -4); ctx.lineTo(offset + spread, -13 - (finger === 1 || finger === 2 ? 3 : 0)); ctx.stroke();
      ctx.fillStyle = bright; ctx.beginPath(); ctx.arc(offset + spread, -15 - (finger === 1 || finger === 2 ? 3 : 0), 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawRiggedGoalkeeper(ctx, p, x, y, scale, time, diving, diveRotation, diveProgress, anticipating, diveDirection, keeperState, landingTimer) {
    const [bright, dark, trim, shorts] = p.colors;
    const profile = [
      { pace: 2.3, bob: 1.2, sway: .018, tilt: .92 }, { pace: 6.4, bob: .7, sway: .03, tilt: 1.16 },
      { pace: 1.9, bob: 1.4, sway: .05, tilt: .94 }, { pace: 1.3, bob: 1.8, sway: .02, tilt: .8 },
      { pace: 4.7, bob: 1.1, sway: .045, tilt: 1.12 }, { pace: 3.1, bob: .55, sway: .012, tilt: .88 },
      { pace: 2.1, bob: 1.5, sway: .06, tilt: 1.02 }, { pace: 1.6, bob: .65, sway: .015, tilt: .84 }
    ][p.artIndex];
    const phase = time * profile.pace + p.artIndex * 1.19;
    const landing = ['saved', 'beaten'].includes(keeperState) ? Math.max(0, 1 - landingTimer / .58) : 0;
    const d = diving ? Math.min(1, diveProgress) : 0;
    const prep = anticipating ? .18 : 0;
    const side = diveDirection || 0;
    const breath = Math.sin(phase);
    const idleSway = Math.sin(phase * .52) * profile.sway;
    const bob = diving ? Math.sin(d * Math.PI) * 2.8 : Math.sin(phase * 2) * profile.bob;
    const anticipationLean = anticipating ? side * .13 : 0;
    const diveLean = diving ? (diveRotation || side * profile.tilt * d) * profile.tilt : 0;
    const landingLean = landing * diveRotation * .42 + Math.sin(landingTimer * 26) * Math.exp(-landingTimer * 6) * .035;
    const torsoLean = diving ? diveLean : landing > 0 ? landingLean : idleSway + anticipationLean;
    const impactShake = landing > 0 ? Math.sin(landingTimer * 31) * Math.exp(-landingTimer * 7) : 0;
    const motion = diving ? d : prep;

    ctx.save();
    // Pressure shadow and team-colored goal-line glow keep the model grounded.
    ctx.save(); ctx.translate(x + (diving ? -side * d * 9 : Math.sin(phase) * 1.5), y + 38);
    ctx.scale(scale * (diving ? 1.08 - d * .35 : 1 + breath * .035), scale * .72);
    ctx.fillStyle = 'rgba(1,9,18,.48)'; ctx.beginPath(); ctx.ellipse(0, 0, 27, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = .11 + (Math.sin(phase) + 1) * .035; ctx.strokeStyle = bright; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(x, y + 28, 30 + Math.sin(phase) * 2, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

    // Character-specific anticipation and flight streaks sit behind the body rig.
    if (anticipating || diving) {
      const weight = anticipating ? .22 + Math.sin(time * 25) * .06 : .32 * (1 - d * .5);
      ctx.save(); ctx.globalAlpha = weight; ctx.strokeStyle = trim; ctx.lineWidth = p.artIndex === 5 ? 3 : 2;
      const n = p.artIndex === 1 || p.artIndex === 4 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const yy = y - 46 + i * 15;
        const back = (i + 1) * (diving ? 8 + d * 10 : 4);
        ctx.beginPath(); ctx.moveTo(x - side * back, yy); ctx.lineTo(x - side * (back + 10), yy - 4); ctx.stroke();
      }
      ctx.restore();
    }

    const rootX = x + (diving ? -side * d * 3 : Math.sin(phase) * (p.artIndex === 2 || p.artIndex === 6 ? 1.8 : .65)) + impactShake * 2;
    const rootY = y - 8 - bob - (diving ? Math.sin(d * Math.PI) * 7 : 0) + impactShake;
    const drawBone = (a, b, width, color, highlight) => drawSegment(ctx, a, b, width * scale, color, highlight);
    const point = (ax, ay, bx, by) => ({ x: ax + (bx - ax) * motion, y: ay + (by - ay) * motion });

    ctx.save(); ctx.translate(rootX, rootY); ctx.rotate(torsoLean * .52); ctx.scale(scale, scale);
    const dir = side || (diveRotation < 0 ? -1 : 1);
    const shirtGrad = ctx.createLinearGradient(-22, -42, 24, 12);
    shirtGrad.addColorStop(0, bright); shirtGrad.addColorStop(1, dark);

    // Back legs articulate at hip, knee and ankle; the dive trails the legs behind.
    for (const leg of [-1, 1]) {
      const hip = { x: leg * 10, y: -1 };
      const idleKnee = { x: leg * 25, y: 23 };
      const idleAnkle = { x: leg * 31, y: 48 };
      const diveKnee = { x: -dir * 20 + leg * 7, y: 13 + Math.abs(leg) * 2 };
      const diveAnkle = { x: -dir * (38 + (leg === -dir ? 8 : 0)) + leg * 4, y: 27 + (leg === dir ? 13 : 0) };
      const knee = point(idleKnee.x, idleKnee.y, diveKnee.x, diveKnee.y);
      const ankle = point(idleAnkle.x, idleAnkle.y, diveAnkle.x, diveAnkle.y);
      drawBone(hip, knee, 13, shorts, trim);
      ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(knee.x - 5, knee.y - 5, 10, 10, 3); ctx.fill();
      drawBone(knee, ankle, 10, bright, '#f5f7ff');
      ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(knee.x - 4, knee.y + 10); ctx.lineTo(ankle.x - 4, ankle.y - 5); ctx.stroke();
      ctx.save(); ctx.translate(ankle.x, ankle.y + 3); ctx.rotate(leg * -.05 + (diving ? -dir * .22 : 0));
      ctx.fillStyle = '#111a2b'; ctx.beginPath(); ctx.roundRect(-8, -3, 19, 9, 4); ctx.fill();
      ctx.fillStyle = trim; ctx.fillRect(-2, -2, 3, 2); ctx.restore();
    }

    // Hip/shorts and fitted keeper jersey with piping, stripes and chest emblem.
    ctx.fillStyle = shorts; ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(15, -7); ctx.lineTo(18, 8); ctx.lineTo(10, 15); ctx.lineTo(2, 8); ctx.lineTo(-7, 15); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = shirtGrad; ctx.beginPath(); ctx.moveTo(-14, -43); ctx.lineTo(-23, -36); ctx.lineTo(-20, -10); ctx.quadraticCurveTo(0, -3, 20, -10); ctx.lineTo(23, -36); ctx.lineTo(14, -43); ctx.lineTo(8, -47); ctx.lineTo(-8, -47); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = trim; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-18, -35); ctx.lineTo(-15, -14); ctx.moveTo(18, -35); ctx.lineTo(15, -14); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-11, -41); ctx.lineTo(-8, -30); ctx.moveTo(11, -41); ctx.lineTo(8, -30); ctx.stroke();
    ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(-7, -46); ctx.lineTo(0, -38); ctx.lineTo(7, -46); ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = '900 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.sigil, 0, -16);
    ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(-10, -31, 2.6, 0, Math.PI * 2); ctx.fill();

    // Arms are independent bones. The leading glove reaches into the selected corner.
    const arms = [];
    for (const arm of [-1, 1]) {
      const shoulder = { x: arm * 18, y: -39 };
      const idleElbow = { x: arm * 28, y: -18 };
      const idleWrist = { x: arm * 37, y: -4 };
      const lead = side === 0 ? 1 : arm === dir ? 1 : .66;
      const diveElbow = side === 0 ? { x: arm * 24, y: -37 } : { x: dir * (lead === 1 ? 28 : 4), y: lead === 1 ? -32 : -16 };
      const diveWrist = side === 0 ? { x: arm * 31, y: -43 } : { x: dir * (lead === 1 ? 46 : 27), y: lead === 1 ? -42 : -11 };
      const elbow = point(idleElbow.x, idleElbow.y - prep * 8, diveElbow.x, diveElbow.y);
      const wrist = point(idleWrist.x, idleWrist.y - prep * 13, diveWrist.x, diveWrist.y);
      drawBone(shoulder, elbow, 11.5, bright, trim);
      ctx.fillStyle = '#101a2a'; ctx.beginPath(); ctx.arc(elbow.x, elbow.y, 6.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bright; ctx.beginPath(); ctx.arc(elbow.x, elbow.y, 4.7, 0, Math.PI * 2); ctx.fill();
      drawBone(elbow, wrist, 9.5, bright, '#fff1da');
      arms.push({ arm, wrist, elbow, lead: lead === 1 });
    }
    for (const arm of arms) {
      const gloveAngle = diving ? dir * -.25 : arm.arm * -.12 + Math.sin(phase + arm.arm) * .035;
      drawGlove(ctx, arm.wrist.x, arm.wrist.y, gloveAngle, p, diving ? 1.25 : 1 + Math.sin(phase) * .08);
    }
    ctx.restore();

    // Head stays counter-balanced against the torso, with character-specific hair/gear.
    const headLean = -torsoLean * .28 + (diving ? -dir * .08 : 0);
    ctx.save(); ctx.translate(rootX + (diving ? side * d * 2 : 0), rootY - 54 - bob * .25); ctx.rotate(headLean); ctx.scale(scale, scale);
    if (p.style === 'ponytail') {
      ctx.fillStyle = p.hair; ctx.beginPath(); ctx.moveTo(4, -8); ctx.quadraticCurveTo(31, -18 + Math.sin(phase) * 3, 27, 18); ctx.quadraticCurveTo(20, 29, 15, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (p.style === 'ears' || p.style === 'crown') {
      ctx.fillStyle = p.style === 'ears' ? p.hair : trim;
      ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-18, -31); ctx.lineTo(-1, -15); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(18, -31); ctx.lineTo(1, -15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 2; ctx.stroke();
      if (p.style === 'ears') { ctx.fillStyle = '#ff9bb2'; ctx.beginPath(); ctx.moveTo(-12, -13); ctx.lineTo(-16, -25); ctx.lineTo(-5, -14); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(12, -13); ctx.lineTo(16, -25); ctx.lineTo(5, -14); ctx.closePath(); ctx.fill(); }
    }
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.ellipse(0, 0, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-5, -6, 3, 6, -.3, 0, Math.PI * 2); ctx.fill();
    const blinkCycle = (time + p.artIndex * .83) % 4.8;
    const blink = blinkCycle > 4.58 ? Math.max(.12, 1 - (blinkCycle - 4.58) / .18) : 1;
    if (p.style === 'helmet') {
      ctx.fillStyle = '#202b37'; ctx.beginPath(); ctx.roundRect(-14, -9, 28, 11, 4); ctx.fill();
      ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#a7ff57'; ctx.shadowColor = '#a7ff57'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(-10, -6, 20, 3, 2); ctx.fill(); ctx.shadowBlur = 0;
    } else {
      for (const eye of [-1, 1]) {
        const ex = eye * 5.2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, -2, 3.4, 4.6 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.eyes || bright; ctx.beginPath(); ctx.ellipse(ex, -1.5, 2, 3.2 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#101a2a'; ctx.beginPath(); ctx.ellipse(ex, -1, .95, 2.1 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - .7, -3, .9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = p.hair; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-3, -9); ctx.moveTo(3, -9); ctx.lineTo(8, -8); ctx.stroke();
      ctx.strokeStyle = '#a95556'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.quadraticCurveTo(0, 10, 2, 8); ctx.stroke();
    }
    ctx.fillStyle = p.hair; ctx.beginPath(); ctx.moveTo(-14, -7); ctx.quadraticCurveTo(-18, -27, -5, -25); ctx.quadraticCurveTo(6, -31, 15, -17); ctx.lineTo(13, -8);
    if (p.style === 'spikes') { ctx.lineTo(19, -27); ctx.lineTo(7, -21); ctx.lineTo(3, -32); ctx.lineTo(-3, -21); ctx.lineTo(-15, -28); }
    else { ctx.lineTo(8, -13); ctx.lineTo(3, -18); ctx.lineTo(-1, -12); ctx.lineTo(-7, -18); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 2; ctx.stroke();
    if (p.style === 'headband' || p.style === 'bandana') { ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(-13, -18, 26, 4, 2); ctx.fill(); ctx.fillRect(10, -17, 8, 2); }
    if (p.style === 'visor') { ctx.fillStyle = 'rgba(116,224,255,.68)'; ctx.beginPath(); ctx.roundRect(-14, -17, 28, 5, 2); ctx.fill(); ctx.strokeStyle = '#eafcff'; ctx.lineWidth = 1; ctx.stroke(); }
    if (p.style === 'crown') { ctx.fillStyle = trim; ctx.beginPath(); ctx.moveTo(-10, -19); ctx.lineTo(-8, -27); ctx.lineTo(-2, -21); ctx.lineTo(2, -29); ctx.lineTo(7, -21); ctx.lineTo(10, -19); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#101a2a'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();

    // Character signatures: swift cyan streaks, icy motes, servo lights, or a titan shock ring.
    if (diving && p.artIndex === 7 && diveProgress > .72) {
      ctx.save(); ctx.globalAlpha = (diveProgress - .72) * 1.8; ctx.strokeStyle = trim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 34, 34 + diveProgress * 10, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (diving && (p.artIndex === 1 || p.artIndex === 4)) {
      ctx.save(); ctx.globalAlpha = .55 * (1 - diveProgress); ctx.strokeStyle = p.artIndex === 1 ? '#49dcff' : '#ff4568'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - side * (35 + i * 6), y - 34 + i * 17); ctx.lineTo(x - side * (57 + i * 7), y - 39 + i * 17); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  function draw(ctx, keeper, x = 0, y = 0, scale = 1, time = 0, diving = false, diveRotation = 0, diveProgress = 0, anticipating = false, diveDirection = 0, keeperState = 'idle', landingTimer = 0) {
    const p = byId(keeper);
    drawRiggedGoalkeeper(ctx, p, x, y, scale, time, diving, diveRotation, diveProgress, anticipating, diveDirection, keeperState, landingTimer);
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
      const sourceY = Math.floor(p.artIndex / 4) * cellHeight + 20;
      ctx.drawImage(cardArt, (p.artIndex % 4) * cellWidth, sourceY, cellWidth, sourceHeight, 0, 0, width, height);
      ctx.fillStyle = 'rgba(3,12,26,.1)'; ctx.fillRect(0, 0, width, height);
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
