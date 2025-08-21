
(() => {
  const canvas = document.getElementById('universe');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0, CX = 0, CY = 0;

  // ---------- Utilities ----------
  const rand = (a=1,b=0)=>Math.random()*(b-a)+a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI*2;

  function resize(){
    W = canvas.width = Math.floor(innerWidth * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    CX = W/2; CY = H/2;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize);
  resize();

  // ---------- Scene State ----------
  const state = {
    paused: false,
    stars: [],
    planets: [],
    comets: [],
    particles: [], // supernova + tails
    starTarget: 900,
    nebula: true,
    accDisk: true,
    t: 0
  };

  // ---------- Starfield (parallax layers) ----------
  const LAYERS = [ {z: 0.2, size:[0.5,1.2], twinkle:.25}, {z: 0.5, size:[0.7,1.8], twinkle:.35}, {z: 1.0, size:[1.0,2.4], twinkle:.5} ];
  function makeStar(){
    const layer = LAYERS[(Math.random()*LAYERS.length)|0];
    return {
      x: Math.random()*W,
      y: Math.random()*H,
      r: rand(layer.size[0], layer.size[1]),
      s: layer,
      tw: Math.random()*TAU,
      hue: 200+rand(-25,25)
    };
  }
  function seedStars(n){
    state.stars = Array.from({length:n}, makeStar);
  }
  seedStars(state.starTarget);

  // ---------- Nebula (animated noise via moving alpha splats) ----------
  const clouds = Array.from({length: 18}, () => ({
    x: rand(0,W), y: rand(0,H), r: rand(200, 640), a: rand(0.04, 0.12), vx: rand(-0.06, 0.06), vy: rand(-0.04, 0.04), hue: rand(200, 300)
  }));

  // ---------- Black Hole & Accretion Disk ----------
  const BH = { x: ()=>CX, y: ()=>CY+H*0.02*Math.sin(state.t*0.0007), r: ()=>Math.min(W,H)*0.06 };

  // ---------- Planets (elliptical orbits, parallax) ----------
  function makePlanet(cfg){
    return Object.assign({
      a: cfg.a, b: cfg.b, // ellipse axes
      speed: cfg.speed, phase: Math.random()*TAU,
      size: cfg.size, hue: cfg.hue,
      ring: cfg.ring||false, ringTilt: cfg.ringTilt||0.35
    });
  }
  state.planets = [
    makePlanet({ a: Math.min(W,H)*0.18, b: Math.min(W,H)*0.12, speed: 0.00012, size: 8*DPR, hue: 200 }),
    makePlanet({ a: Math.min(W,H)*0.26, b: Math.min(W,H)*0.20, speed: 0.00008, size: 12*DPR, hue: 35, ring: true, ringTilt: 0.55 }),
    makePlanet({ a: Math.min(W,H)*0.36, b: Math.min(W,H)*0.30, speed: 0.00006, size: 5*DPR, hue: 320 })
  ];

  // ---------- Comets ----------
  function spawnComet(){
    const side = Math.random()<0.5 ? 0 : 1;
    const x = side ? W+50 : -50; const y = rand(H*0.1, H*0.9);
    const vx = (side?-1:1)*rand(0.6, 1.2)*DPR; const vy = rand(-0.25,0.25)*DPR;
    return { x,y,vx,vy, life: 1, tail: [] };
  }

  // ---------- Particles ----------
  function spawnBurst(x, y, count=220, hue=rand(10,60)){
    for (let i=0;i<count;i++){
      const a = Math.random()*TAU, sp = rand(0.6, 5.0)*DPR;
      state.particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 1, hue, r: rand(0.8,2.6)*DPR });
    }
  }

  // ---------- Rendering ----------
  function drawStars(dt){
    for (const s of state.stars){
      // subtle drift
      s.x += (s.s.z-0.2)*0.02*DPR*dt; if (s.x>W) s.x -= W; if (s.x<0) s.x += W;
      s.y += (s.s.z-0.2)*0.015*DPR*dt; if (s.y>H) s.y -= H; if (s.y<0) s.y += H;
      const tw = (Math.sin(state.t*0.003 + s.tw)*0.5+0.5) * s.s.twinkle + 0.5;
      ctx.beginPath();
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*2);
      g.addColorStop(0, `hsla(${s.hue}, 100%, 85%, ${0.95*tw})`);
      g.addColorStop(1, `hsla(${s.hue}, 100%, 60%, 0)`);
      ctx.fillStyle = g; ctx.arc(s.x, s.y, s.r*2, 0, TAU); ctx.fill();
    }
  }

  function drawNebula(dt){
    if (!state.nebula) return;
    ctx.globalCompositeOperation = 'screen';
    for (const c of clouds){
      c.x += c.vx*dt; c.y += c.vy*dt;
      if (c.x < -c.r) c.x = W + c.r; if (c.x > W + c.r) c.x = -c.r;
      if (c.y < -c.r) c.y = H + c.r; if (c.y > H + c.r) c.y = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `hsla(${c.hue}, 70%, 55%, ${c.a})`);
      g.addColorStop(1, `hsla(${c.hue+40}, 70%, 50%, 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawAccretionDisk(){
    if (!state.accDisk) return;
    const r = BH.r();
    // glare
    const glow = ctx.createRadialGradient(CX, CY, r*0.6, CX, CY, r*3.0);
    glow.addColorStop(0, 'rgba(255,255,255,0.12)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(CX,CY,r*3,0,TAU); ctx.fill();

    // disk (tilted ellipse)
    const tilt = 0.55; const R1 = r*2.0, R2 = r*0.35;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(0.15*Math.sin(state.t*0.0004));
    const grd = ctx.createLinearGradient(-R1,0,R1,0);
    grd.addColorStop(0, 'hsla(210, 80%, 70%, .1)');
    grd.addColorStop(0.5, 'hsla(45, 100%, 60%, .55)');
    grd.addColorStop(1, 'hsla(210, 80%, 70%, .1)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    for (let i=0;i<2;i++){
      ctx.save();
      ctx.scale(1, tilt*(i?1.1:0.9));
      ctx.ellipse(0, 0, R1*(i?1.15:1), R2*(i?1.15:1), 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // event horizon
    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(CX, CY, r, 0, TAU); ctx.fill();

    // lensing ring (photon sphere)
    ctx.beginPath();
    const ring = ctx.createRadialGradient(CX,CY,r*1.1,CX,CY,r*1.45);
    ring.addColorStop(0, 'rgba(255,255,255,0.15)');
    ring.addColorStop(0.9, 'rgba(255,255,255,0.02)');
    ring.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ring;
    ctx.arc(CX, CY, r*1.5, 0, TAU); ctx.fill();
  }

  function drawPlanets(dt){
    const rBH = BH.r();
    for (const p of state.planets){
      p.phase += p.speed*dt;
      const x = CX + Math.cos(p.phase)*p.a;
      const y = CY + Math.sin(p.phase)*p.b;
      // simple gravitational lensing wobble near BH
      const dx = x-CX, dy = y-CY; const d = Math.hypot(dx,dy);
      const lens = clamp(1 - d/(rBH*3.5), 0, 1);
      const lx = x + (dx/d||0)*(-20*DPR* lens*lens);
      const ly = y + (dy/d||0)*(-20*DPR* lens*lens);

      // planet body
      const grad = ctx.createRadialGradient(lx-p.size*0.6, ly-p.size*0.8, p.size*0.2, lx, ly, p.size*1.4);
      grad.addColorStop(0, `hsla(${p.hue}, 80%, 68%, 1)`);
      grad.addColorStop(1, `hsla(${p.hue}, 80%, 35%, 1)`);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(lx, ly, p.size, 0, TAU); ctx.fill();

      // rings
      if (p.ring){
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(0.5);
        ctx.scale(1, p.ringTilt);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2*DPR; ctx.beginPath(); ctx.ellipse(0,0,p.size*2.1,p.size*1.1,0,0,TAU); ctx.stroke();
        ctx.globalAlpha = .5; ctx.lineWidth = .8*DPR; ctx.beginPath(); ctx.ellipse(0,0,p.size*2.6,p.size*1.4,0,0,TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawComets(dt){
    for (const c of state.comets){
      c.x += c.vx*dt; c.y += c.vy*dt; c.life -= 0.002*dt;
      // tail particles
      c.tail.push({x:c.x, y:c.y, life:1}); if (c.tail.length>120) c.tail.shift();
      // draw tail
      for (let i=0;i<c.tail.length;i++){
        const t = c.tail[i]; t.life -= 0.008*dt; if (t.life<=0) { c.tail.splice(i,1); i--; continue; }
        const a = t.life*0.7; const r = (1 - i/c.tail.length)*6*DPR;
        const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
        g.addColorStop(0, `rgba(160,220,255,${a})`);
        g.addColorStop(1, `rgba(160,220,255,0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x,t.y,r,0,TAU); ctx.fill();
      }
      // nucleus
      ctx.fillStyle = '#ecfeff'; ctx.beginPath(); ctx.arc(c.x, c.y, 2.5*DPR, 0, TAU); ctx.fill();
    }
    // remove dead comets
    state.comets = state.comets.filter(c => c.life>0 && c.x>-80 && c.x<W+80 && c.y>-80 && c.y<H+80);
  }

  function drawParticles(dt){
    for (let i=0;i<state.particles.length;i++){
      const p = state.particles[i];
      p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.995; p.vy *= 0.995; p.life -= 0.006*dt;
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);
      g.addColorStop(0, `hsla(${p.hue},100%,60%,${p.life})`);
      g.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*3,0,TAU); ctx.fill();
      if (p.life<=0){ state.particles.splice(i,1); i--; }
    }
  }

  // ---------- Animation Loop ----------
  let last = performance.now();
  let fpsAcc=0, fpsFrames=0, fpsOut=0;
  const fpsEl = document.getElementById('fps');
  const objEl = document.getElementById('objCount');

  function frame(now){
    const dt = Math.min(33, now-last); // clamp delta for stability
    last = now; state.t = now; if (state.paused){ requestAnimationFrame(frame); return; }

    // auto-adjust stars if changed
    const target = +document.getElementById('starDensity').value;
    if (target !== state.starTarget){
      state.starTarget = target;
      if (state.stars.length < target){
        const need = target - state.stars.length; for (let i=0;i<need;i++) state.stars.push(makeStar());
      } else if (state.stars.length > target){
        state.stars.length = target;
      }
    }

    // draw background fade
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation = 'source-over';

    drawNebula(dt);
    drawStars(dt);
    drawPlanets(dt);
    drawAccretionDisk();
    drawComets(dt);
    drawParticles(dt);

    // HUD metrics
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 500){ fpsOut = Math.round(1000 / (fpsAcc/fpsFrames)); fpsAcc=0; fpsFrames=0; fpsEl.textContent = fpsOut; }
    objEl.textContent = state.stars.length + state.planets.length + state.comets.length + state.particles.length;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- Interactions ----------
  const btnPause = document.getElementById('togglePause');
  const btnBurst = document.getElementById('burst');
  const btnComet = document.getElementById('comet');
  const chkNebula = document.getElementById('nebula');
  const chkDisk = document.getElementById('accDisk');

  btnPause.addEventListener('click', ()=>{ state.paused = !state.paused; btnPause.textContent = state.paused ? 'Play' : 'Pause'; });
  btnBurst.addEventListener('click', ()=> spawnBurst(CX, CY, 320, rand(10,60)) );
  btnComet.addEventListener('click', ()=> state.comets.push(spawnComet()) );
  chkNebula.addEventListener('change', e=> state.nebula = e.target.checked);
  chkDisk.addEventListener('change', e=> state.accDisk = e.target.checked);

  addEventListener('keydown', (e)=>{
    if (e.code==='Space'){ e.preventDefault(); btnPause.click(); }
    else if (e.key==='n' || e.key==='N'){ chkNebula.checked = !chkNebula.checked; chkNebula.dispatchEvent(new Event('change')); }
    else if (e.key==='b' || e.key==='B'){ btnBurst.click(); }
    else if (e.key==='c' || e.key==='C'){ btnComet.click(); }
    else if (e.key==='d' || e.key==='D'){ chkDisk.checked = !chkDisk.checked; chkDisk.dispatchEvent(new Event('change')); }
  });

  // Click to spawn local burst
  canvas.addEventListener('click', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * DPR;
    const y = (e.clientY - rect.top) * DPR;
    spawnBurst(x,y, rand(120,220), rand(180,320));
  });

  // Auto spawn a comet every 12–20s
  setInterval(()=> state.comets.push(spawnComet()), rand(12000,20000));
})();
