(function(){
  var heroPaused = false;
  var heroFrameId = null;
  var trailsFrameId = null;
  var heroLoopRunning = false;
  var trailsLoopRunning = false;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* FALLBACK FOR REDUCED MOTION */
  if (reduceMotion) {
    var c = document.getElementById('pcanvas');
    c.style.display = 'block';
    var ctx = c.getContext('2d');
    var W = c.width, H = c.height;

    function targetPoints(){
      var pts = [];
      var cx = W/2, cy = H/2, s = 62;
      var box = [[-1,-0.8],[1,-0.8],[1,0.8],[-1,0.8]];
      for (var i=0;i<box.length;i++){
        var a = box[i], b = box[(i+1)%box.length];
        for (var t=0;t<16;t++){
          var tt = t/16;
          pts.push([cx+(a[0]+(b[0]-a[0])*tt)*s, cy+(a[1]+(b[1]-a[1])*tt)*s]);
        }
      }
      return pts;
    }

    var targets = targetPoints();
    ctx.clearRect(0,0,W,H);
    for (var i=0;i<targets.length;i++){
      ctx.beginPath();
      ctx.arc(targets[i][0],targets[i][1],1.8,0,Math.PI*2);
      ctx.fillStyle = 'rgba(230,120,30,0.9)';
      ctx.fill();
    }

    document.querySelectorAll('.metric .value').forEach(function(el) {
      el.textContent = el.getAttribute('data-value');
    });
    return;
  }

  /* 1. THREE.JS 3D HERO & HIGH DENSITY PARTICLE SYSTEM */
  gsap.registerPlugin(ScrollTrigger);

  var container = document.getElementById('hero-webgl-container');
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0c, 0.018);

  var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 10);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Background Starfield
  var starCount = 700;
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(starCount * 3);
  for (var i = 0; i < starCount * 3; i += 3) {
    starPos[i] = (Math.random() - 0.5) * 48;
    starPos[i + 1] = (Math.random() - 0.5) * 48;
    starPos[i + 2] = (Math.random() - 0.5) * 40;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  var starMat = new THREE.PointsMaterial({
    size: 0.032,
    color: 0xf2f1ee,
    transparent: true,
    opacity: 0.32
  });
  var starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // Custom Soft Radial Particle Texture
  function createParticleTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }

  // DENSITY: 12000 PARTICLES PER SHAPE
  var TOTAL_PARTICLES = 12000;

  function addLinePoints(pts, p1, p2, density) {
    for (var i = 0; i <= density; i++) {
      var t = i / density;
      pts.push(new THREE.Vector3().lerpVectors(p1, p2, t));
    }
  }

  /* HIGHLY DETAILED & HIGH DENSITY 3D SHAPE GENERATORS */

  // 1. "dairy" — Milk bottles cluster in crate
  function generateDairyPoints() {
    var points = [];
    var w = 1.4, h = 0.7, d = 1.4;
    var c = [
      new THREE.Vector3(-w,-h,-d), new THREE.Vector3(w,-h,-d),
      new THREE.Vector3(w,h,-d), new THREE.Vector3(-w,h,-d),
      new THREE.Vector3(-w,-h,d), new THREE.Vector3(w,-h,d),
      new THREE.Vector3(w,h,d), new THREE.Vector3(-w,h,d)
    ];
    addLinePoints(points, c[0], c[1], 80); addLinePoints(points, c[1], c[2], 60);
    addLinePoints(points, c[2], c[3], 80); addLinePoints(points, c[3], c[0], 60);
    addLinePoints(points, c[4], c[5], 80); addLinePoints(points, c[5], c[6], 60);
    addLinePoints(points, c[6], c[7], 80); addLinePoints(points, c[7], c[4], 60);
    addLinePoints(points, c[0], c[4], 60); addLinePoints(points, c[1], c[5], 60);
    addLinePoints(points, c[2], c[6], 60); addLinePoints(points, c[3], c[7], 60);

    for(var s=-0.45; s<=0.45; s+=0.09){
      addLinePoints(points, new THREE.Vector3(-w, s, -d), new THREE.Vector3(w, s, -d), 50);
      addLinePoints(points, new THREE.Vector3(-w, s, d), new THREE.Vector3(w, s, d), 50);
      addLinePoints(points, new THREE.Vector3(-w, s, -d), new THREE.Vector3(-w, s, d), 50);
      addLinePoints(points, new THREE.Vector3(w, s, -d), new THREE.Vector3(w, s, d), 50);
    }

    var bottleOffsets = [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]];
    bottleOffsets.forEach(function(off) {
      var bx = off[0], bz = off[1];
      for (var layer = 0.35; layer <= 1.0; layer += 0.13) {
        for (var y = -0.6; y <= 0.4; y += 0.025) {
          var r = 0.38 * layer;
          for (var a = 0; a < Math.PI * 2; a += Math.PI / 24) {
            points.push(new THREE.Vector3(bx + Math.cos(a) * r, y, bz + Math.sin(a) * r));
          }
        }
      }
      for (var y = 0.4; y <= 0.8; y += 0.02) {
        var t = (y - 0.4) / 0.4;
        var r = 0.38 * (1 - t * 0.55);
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 20) {
          points.push(new THREE.Vector3(bx + Math.cos(a) * r, y, bz + Math.sin(a) * r));
        }
      }
      for (var y = 0.8; y <= 0.95; y += 0.015) {
        var r = 0.18;
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 16) {
          points.push(new THREE.Vector3(bx + Math.cos(a) * r, y, bz + Math.sin(a) * r));
        }
      }
    });
    return points;
  }

  // 2. "icecream" — Waffle Cone & Dense Soft Serve
  function generateIcecreamPoints() {
    var points = [];
    for (var y = -1.6; y <= 0.1; y += 0.022) {
      var t = (y + 1.6) / 1.7;
      var r = 0.08 + t * 0.92;
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 28) {
        var waffle = Math.sin(a * 8 + y * 12) * 0.04;
        points.push(new THREE.Vector3(Math.cos(a) * (r + waffle), y, Math.sin(a) * (r + waffle)));
      }
    }
    for (var layer = 0.3; layer <= 1.0; layer += 0.175) {
      for (var y = 0.1; y <= 1.4; y += 0.018) {
        var t = (y - 0.1) / 1.3;
        var baseR = 1.0 * Math.pow(1 - t, 0.75) * layer;
        var spiralAngle = y * 9.0;
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 24) {
          var lobe = Math.sin(a * 4 + spiralAngle) * 0.15;
          var r = baseR + lobe;
          points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
        }
      }
    }
    var cy = 1.55;
    for (var v = 0; v < Math.PI; v += Math.PI / 20) {
      var cr = 0.22 * Math.sin(v);
      var cz = 0.22 * Math.cos(v);
      for (var u = 0; u < Math.PI * 2; u += Math.PI / 20) {
        points.push(new THREE.Vector3(Math.cos(u) * cr, cy + cz, Math.sin(u) * cr));
      }
    }
    for (var t = 0; t <= 1; t += 0.02) {
      points.push(new THREE.Vector3(t * 0.2, cy + 0.2 + t * 0.3, Math.sin(t * Math.PI) * 0.1));
    }
    return points;
  }

  // 3. "momo" — Plate, Momos, Rising Steam
  function generateMomoPoints() {
    var points = [];
    for (var r = 0.1; r <= 1.85; r += 0.035) {
      var py = -0.8 + (r > 1.4 ? (r - 1.4) * 0.35 : 0);
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 30) {
        points.push(new THREE.Vector3(Math.cos(a) * r, py, Math.sin(a) * r));
      }
    }
    var momoCenters = [[-0.5, -0.3], [0.5, -0.3], [0, 0.5]];
    momoCenters.forEach(function(mc) {
      var mx = mc[0], mz = mc[1];
      for (var layer = 0.3; layer <= 1.0; layer += 0.14) {
        for (var v = 0; v <= Math.PI / 2; v += Math.PI / 26) {
          var mr = 0.52 * Math.cos(v * 0.85) * layer;
          var my = -0.75 + Math.sin(v) * 0.55;
          for (var u = 0; u < Math.PI * 2; u += Math.PI / 22) {
            var pleat = Math.sin(u * 8) * 0.08 * (1 - v / (Math.PI / 2));
            points.push(new THREE.Vector3(mx + Math.cos(u) * (mr + pleat), my, mz + Math.sin(u) * (mr + pleat)));
          }
        }
      }
    });
    for (var s = 0; s < 7; s++) {
      var sx = (s - 3) * 0.3;
      for (var sy = 0; sy <= 1.5; sy += 0.025) {
        var wave = Math.sin(sy * 4 + s) * 0.17;
        for (var d = -0.06; d <= 0.06; d += 0.03) {
          points.push(new THREE.Vector3(sx + wave + d, 0.1 + sy, (s - 3) * 0.13 + d));
        }
      }
    }
    return points;
  }

  // 4. "rocket" — Cylindrical Body, Fins, Exhaust
  function generateRocketPoints() {
    var points = [];
    for (var layer = 0.45; layer <= 1.0; layer += 0.11) {
      for (var y = -0.8; y <= 0.8; y += 0.025) {
        var r = 0.65 * layer;
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 26) {
          points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
        }
      }
    }
    for (var y = 0.8; y <= 1.8; y += 0.018) {
      var t = (y - 0.8) / 1.0;
      var r = 0.65 * Math.cos(t * Math.PI * 0.5);
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
    }
    for (var f = 0; f < 3; f++) {
      var angle = (f / 3) * Math.PI * 2;
      for (var fy = -1.2; fy <= -0.3; fy += 0.015) {
        var ext = (1.2 + fy) * 0.85;
        var r = 0.65 + ext;
        for (var thick = -0.06; thick <= 0.06; thick += 0.03) {
          points.push(new THREE.Vector3(Math.cos(angle) * r + thick, fy, Math.sin(angle) * r + thick));
        }
      }
    }
    for (var y = -1.7; y <= -0.8; y += 0.015) {
      var t = (-0.8 - y) / 0.9;
      var r = 0.45 * (1 - t * 0.8);
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 22) {
        var flicker = Math.sin(a * 6 + y * 20) * 0.05;
        points.push(new THREE.Vector3(Math.cos(a) * (r + flicker), y, Math.sin(a) * (r + flicker)));
      }
    }
    return points;
  }

  // 5. "satellite" — Core & Solar Grid Arrays
  function generateSatellitePoints() {
    var points = [];
    for (var layer = 0.35; layer <= 1.0; layer += 0.13) {
      for (var y = -0.7; y <= 0.7; y += 0.025) {
        var r = 0.55 * layer;
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 24) {
          points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
        }
      }
    }
    for (var r = 0.05; r <= 0.75; r += 0.028) {
      var dy = 0.9 + (r * r) * 0.4;
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        points.push(new THREE.Vector3(Math.cos(a) * r, dy, Math.sin(a) * r));
      }
    }
    addLinePoints(points, new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(0, 1.35, 0), 40);

    [-1, 1].forEach(function(dir) {
      for (var px = 0.6; px <= 2.4; px += 0.035) {
        for (var py = -0.6; py <= 0.6; py += 0.035) {
          points.push(new THREE.Vector3(dir * px, py, 0));
          points.push(new THREE.Vector3(dir * px, py, 0.035));
        }
      }
    });
    return points;
  }

  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function formatShapePoints(rawPoints) {
    shuffleInPlace(rawPoints);
    var formatted = new Float32Array(TOTAL_PARTICLES * 3);
    for (var i = 0; i < TOTAL_PARTICLES; i++) {
      var src = rawPoints[i % rawPoints.length];
      var j = (i >= rawPoints.length) ? 0.012 : 0;
      formatted[i * 3]     = src.x + (Math.random() - 0.5) * j;
      formatted[i * 3 + 1] = src.y + (Math.random() - 0.5) * j;
      formatted[i * 3 + 2] = src.z + (Math.random() - 0.5) * j;
    }
    return formatted;
  }

  var shapes = [
    formatShapePoints(generateDairyPoints()),
    formatShapePoints(generateIcecreamPoints()),
    formatShapePoints(generateMomoPoints()),
    formatShapePoints(generateRocketPoints()),
    formatShapePoints(generateSatellitePoints())
  ];

  /*
    LAYOUTS — object travels; copy parks on the opposite side.
      fx / fy = object position as a fraction of visible half-width / half-height
      radius  = rough world radius, used for the cursor hover test
  */
  var layouts = [
    { fx:  0.60, fy:  0.02, s: 1.45, radius: 2.6, text: { left: '0%',   top: '50%', width: '46%' } },
    { fx:  0.02, fy:  0.34, s: 1.42, radius: 2.6, text: { left: '0%',   top: '82%', width: '42%' } },
    { fx: -0.62, fy:  0.44, s: 1.34, radius: 2.7, text: { left: '50%',  top: '78%', width: '48%' } },
    { fx:  0.58, fy: -0.44, s: 1.30, radius: 2.6, text: { left: '0%',   top: '22%', width: '46%' } },
    { fx: -0.58, fy:  0.02, s: 1.18, radius: 3.0, text: { left: '52%',  top: '50%', width: '46%' } }
  ];

  var currentShapeIndex = 0;

  var particleGeo = new THREE.BufferGeometry();
  var currentPositions = new Float32Array(TOTAL_PARTICLES * 3);
  var dispersedPositions = new Float32Array(TOTAL_PARTICLES * 3);
  var targetArray = new Float32Array(TOTAL_PARTICLES * 3);
  var particleColors = new Float32Array(TOTAL_PARTICLES * 3);

  /* WIDER PALETTE */
  var palette = [
    { c: new THREE.Color(0xe6781e), w: 0.20 },
    { c: new THREE.Color(0xffb15c), w: 0.09 },
    { c: new THREE.Color(0xf2f1ee), w: 0.12 },
    { c: new THREE.Color(0xd63b7f), w: 0.10 },
    { c: new THREE.Color(0xff6b9c), w: 0.06 },
    { c: new THREE.Color(0x3b72b8), w: 0.10 },
    { c: new THREE.Color(0x58c8e8), w: 0.07 },
    { c: new THREE.Color(0x7647a8), w: 0.09 },
    { c: new THREE.Color(0x2fb8a0), w: 0.06 },
    { c: new THREE.Color(0x7bd88f), w: 0.05 },
    { c: new THREE.Color(0xe2c04b), w: 0.03 },
    { c: new THREE.Color(0x4a4a50), w: 0.03 }
  ];

  function getWeightedColor() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < palette.length; i++) {
      acc += palette[i].w;
      if (r <= acc) return palette[i].c;
    }
    return palette[0].c;
  }

  function visibleHalfHeight() {
    return Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  }

  /* FULL-PAGE DISPERSION */
  function seedDispersedPositions() {
    var halfH = visibleHalfHeight();
    var halfW = halfH * camera.aspect;
    var spreadX = halfW * 2 * 1.25;
    var spreadY = halfH * 2 * 1.25;
    var spreadZ = 14;
    for (var i = 0; i < TOTAL_PARTICLES; i++) {
      dispersedPositions[i * 3]     = (Math.random() - 0.5) * spreadX;
      dispersedPositions[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
      dispersedPositions[i * 3 + 2] = (Math.random() - 0.5) * spreadZ;
    }
  }

  targetArray.set(shapes[0]);
  seedDispersedPositions();

  for (var i = 0; i < TOTAL_PARTICLES; i++) {
    currentPositions[i * 3]     = dispersedPositions[i * 3];
    currentPositions[i * 3 + 1] = dispersedPositions[i * 3 + 1];
    currentPositions[i * 3 + 2] = dispersedPositions[i * 3 + 2];

    var assignedCol = getWeightedColor();
    particleColors[i * 3]     = assignedCol.r;
    particleColors[i * 3 + 1] = assignedCol.g;
    particleColors[i * 3 + 2] = assignedCol.b;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

  var particleMat = new THREE.PointsMaterial({
    size: 0.095,
    map: createParticleTexture(),
    transparent: true,
    opacity: 0.88,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  var heroParticleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(heroParticleSystem);

  /* ---- visual state: base values tweened by the vanish effect,
          then multiplied per frame by hover and audio response ---- */
  var visual = { opacity: 0.88, size: 0.095 };
  var hoverMix = 0;          // 0 -> 1, eased toward hoverTarget
  var hoverTarget = 0;
  var audioBoost = 0;        // lifts slightly while music is playing
  window.__dccOrbAudio = function(on){ audioBoost = on ? 1 : 0; };

  function updateObjectPosition() {
    var isMobile = window.innerWidth <= 900;
    var L = layouts[currentShapeIndex];

    if (isMobile) {
      heroParticleSystem.position.set(0, 1.9, 0);
      heroParticleSystem.scale.setScalar(L.s * 0.72);
    } else {
      var halfH = visibleHalfHeight();
      var halfW = halfH * camera.aspect;
      var x = L.fx * Math.min(halfW - 1.8, 8.2);
      var y = L.fy * (halfH - 0.6);
      heroParticleSystem.position.set(x, y, 0);
      heroParticleSystem.scale.setScalar(L.s);
    }
  }

  /* HERO COPY MOVES TO THE OPPOSITE SIDE OF WHEREVER THE OBJECT LANDS */
  function updateHeroTextPosition(animate) {
    var heroContent = document.getElementById('hero-content');
    if (!heroContent) return;

    if (window.innerWidth <= 900) {
      gsap.set(heroContent, { clearProps: 'left,top,width' });
      return;
    }

    var t = layouts[currentShapeIndex].text;
    var props = { left: t.left, top: t.top, width: t.width };

    if (animate) {
      gsap.to(heroContent, Object.assign({ duration: 1.35, ease: 'power3.inOut' }, props));
    } else {
      gsap.set(heroContent, props);
    }
  }

  updateObjectPosition();
  updateHeroTextPosition(false);

  var morphState = { progress: 0, disperse: 1 };

  /* ================= CURSOR HOVER ON THE FORMED OBJECT ================= */
  var pointerNDC = new THREE.Vector2(-10, -10);
  var raycaster = new THREE.Raycaster();
  var hoverPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var hitWorld = new THREE.Vector3();
  var hitLocal = new THREE.Vector3();
  var hoverActive = false;
  var HOVER_RADIUS = 1.35;      // local-space reach of the cursor
  var HOVER_PUSH = 0.9;         // how hard particles are shoved aside

  window.addEventListener('pointermove', function(e){
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });
  window.addEventListener('pointerleave', function(){ pointerNDC.set(-10, -10); });

  function updateHoverState(){
    // only meaningful once the object has actually formed
    if (morphState.disperse > 0.42 || pointerNDC.x < -5) {
      hoverTarget = 0; hoverActive = false; return;
    }
    raycaster.setFromCamera(pointerNDC, camera);
    if (!raycaster.ray.intersectPlane(hoverPlane, hitWorld)) { hoverTarget = 0; hoverActive = false; return; }

    var L = layouts[currentShapeIndex];
    var reach = L.radius * heroParticleSystem.scale.x * 0.75;
    var inside = hitWorld.distanceTo(heroParticleSystem.position) < reach;

    hoverActive = inside;
    hoverTarget = inside ? 1 : 0;

    if (inside) {
      hitLocal.copy(hitWorld);
      heroParticleSystem.worldToLocal(hitLocal);  // account for the constant rotation
    }
  }

  /* ================= VANISH / RE-MATERIALISE ================= */
  function vanish() {
    gsap.killTweensOf(visual);
    gsap.to(visual, { opacity: 0.16, duration: 0.85, ease: 'power2.in' });
    gsap.to(visual, { size: 0.165, duration: 0.85, ease: 'power2.out' });   // blooms out as it dissolves
  }
  function materialise() {
    gsap.killTweensOf(visual);
    gsap.to(visual, { opacity: 0.88, duration: 1.4, ease: 'power2.out', delay: 0.12 });
    gsap.to(visual, { size: 0.095, duration: 1.6, ease: 'power3.out', delay: 0.12 });
  }

  function animateHeroTextOut() {
    var h1 = document.querySelector('.hero h1');
    var lede = document.querySelector('.hero p.lede');
    var ctas = document.querySelector('.hero-ctas');
    gsap.killTweensOf([h1, lede, ctas]);
    gsap.to([h1, lede, ctas], {
      opacity: 0, y: -12, filter: 'blur(6px)',
      duration: 0.55, stagger: 0.06, ease: 'power2.in'
    });
  }

  function animateHeroTextIn() {
    var h1 = document.querySelector('.hero h1');
    var lede = document.querySelector('.hero p.lede');
    var ctas = document.querySelector('.hero-ctas');

    gsap.killTweensOf([h1, lede, ctas]);
    gsap.fromTo([h1, lede, ctas],
      { opacity: 0, y: 18, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, stagger: 0.18, ease: "power2.out" }
    );
  }

  function cycleShape() {
    var nextIndex = (currentShapeIndex + 1) % shapes.length;
    var nextShape = shapes[nextIndex];

    animateHeroTextOut();
    vanish();

    gsap.to(morphState, {
      disperse: 1,
      duration: 1.2,
      ease: "power2.inOut",
      onComplete: function() {
        currentShapeIndex = nextIndex;
        targetArray.set(nextShape);

        updateObjectPosition();
        updateHeroTextPosition(true);
        animateHeroTextIn();
        materialise();

        gsap.to(morphState, {
          disperse: 0,
          duration: 1.8,
          ease: "back.out(1.2)",   // the jump-into-place you liked — kept as is
          onComplete: function() {
            gsap.delayedCall(2.2, cycleShape);
          }
        });
      }
    });
  }

  gsap.delayedCall(0.5, function() {
    animateHeroTextIn();
    gsap.to(morphState, {
      disperse: 0,
      duration: 2.0,
      ease: "power3.out",
      onComplete: function() {
        gsap.delayedCall(2.5, cycleShape);
      }
    });
  });

  var clock = new THREE.Clock();

  function renderHero() {
    if(heroPaused){
      heroLoopRunning = false;
      heroFrameId = null;
      return;
    }

    heroLoopRunning = true;
    heroFrameId = requestAnimationFrame(renderHero);

    var time = clock.getElapsedTime();

    updateHoverState();
    hoverMix += (hoverTarget - hoverMix) * 0.10;

    // rotation eases back while the cursor is inside, so the shape can be "held"
    heroParticleSystem.rotation.y = time * 0.18 - hoverMix * 0.35;
    heroParticleSystem.rotation.x = Math.sin(time * 0.12) * 0.08;
    starField.rotation.y = time * 0.02;

    // hover glow + gentle lift while music plays
    particleMat.opacity = Math.min(1, visual.opacity * (1 + hoverMix * 0.35 + audioBoost * 0.05));
    particleMat.size = visual.size * (1 + hoverMix * 0.55 + audioBoost * 0.04 +
                                      (hoverMix > 0.05 ? Math.sin(time * 6) * 0.05 : 0));

    var posAttr = particleGeo.attributes.position;
    var positions = posAttr.array;
    var dispFactor = morphState.disperse;

    var doHover = hoverMix > 0.02 && hoverActive;
    var hx = hitLocal.x, hy = hitLocal.y, hz = hitLocal.z;
    var R = HOVER_RADIUS, R2 = R * R;

    for (var i = 0; i < TOTAL_PARTICLES; i++) {
      var i3 = i * 3;

      var tx = targetArray[i3];
      var ty = targetArray[i3 + 1];
      var tz = targetArray[i3 + 2];

      if (doHover) {
        var ox = tx - hx, oy = ty - hy, oz = (tz - hz) * 0.5;
        var d2 = ox * ox + oy * oy + oz * oz;
        if (d2 < R2) {
          var d = Math.sqrt(d2) || 0.0001;
          var falloff = (1 - d / R);
          var f = falloff * falloff * HOVER_PUSH * hoverMix;
          var wob = 1 + Math.sin(time * 5 + d * 6) * 0.18;
          tx += (ox / d) * f * wob;
          ty += (oy / d) * f * wob;
          tz += (oz / d) * f * wob + falloff * 0.25 * hoverMix;
        }
      }

      var dx = dispersedPositions[i3] + Math.sin(time + i) * 0.45;
      var dy = dispersedPositions[i3 + 1] + Math.cos(time * 0.8 + i) * 0.45;
      var dz = dispersedPositions[i3 + 2];

      var finalX = THREE.MathUtils.lerp(tx, dx, dispFactor);
      var finalY = THREE.MathUtils.lerp(ty, dy, dispFactor);
      var finalZ = THREE.MathUtils.lerp(tz, dz, dispFactor);

      positions[i3] += (finalX - positions[i3]) * 0.08;
      positions[i3 + 1] += (finalY - positions[i3 + 1]) * 0.08;
      positions[i3 + 2] += (finalZ - positions[i3 + 2]) * 0.08;
    }

    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
  }

  renderHero();

  var resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      seedDispersedPositions();
      updateObjectPosition();
      updateHeroTextPosition(false);
    }, 120);
  });


  /* 2. SCROLL-TRIGGERED COUNTERS & CANVAS TRAILS */
  var metricsCanvas = document.getElementById('metrics-canvas');
  var mCtx = metricsCanvas.getContext('2d');
  var trailParticles = [];

  function resizeMetricsCanvas() {
    var rect = metricsCanvas.parentElement.getBoundingClientRect();
    metricsCanvas.width = rect.width;
    metricsCanvas.height = rect.height;
  }
  resizeMetricsCanvas();
  window.addEventListener('resize', resizeMetricsCanvas);

  function spawnTrail(x, y) {
    for (var i = 0; i < 3; i++) {
      trailParticles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.8 - 0.5,
        life: 1.0,
        color: Math.random() > 0.4 ? '230,120,30' : '242,241,238'
      });
    }
  }

  function renderTrails() {
    if(heroPaused){
      trailsLoopRunning = false;
      trailsFrameId = null;
      return;
    }

    trailsLoopRunning = true;
    mCtx.clearRect(0, 0, metricsCanvas.width, metricsCanvas.height);
    for (var i = trailParticles.length - 1; i >= 0; i--) {
      var p = trailParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) {
        trailParticles.splice(i, 1);
        continue;
      }
      mCtx.beginPath();
      mCtx.arc(p.x, p.y, 1.8 * p.life, 0, Math.PI * 2);
      mCtx.fillStyle = 'rgba(' + p.color + ',' + (p.life * 0.8) + ')';
      mCtx.fill();
    }
    trailsFrameId = requestAnimationFrame(renderTrails);
  }

  window.heroParticlesPause = function(){
    heroPaused = true;
    heroLoopRunning = false;
    trailsLoopRunning = false;
    if(heroFrameId){
      cancelAnimationFrame(heroFrameId);
      heroFrameId = null;
    }
    if(trailsFrameId){
      cancelAnimationFrame(trailsFrameId);
      trailsFrameId = null;
    }
    var heroContainer = document.getElementById('hero-webgl-container');
    if(heroContainer){ heroContainer.style.opacity = '0'; }
  };

  window.heroParticlesResume = function(){
    heroPaused = false;
    var heroContainer = document.getElementById('hero-webgl-container');
    if(heroContainer){ heroContainer.style.opacity = '1'; }
    if(!heroLoopRunning){ renderHero(); }
    if(!trailsLoopRunning){ renderTrails(); }
  };

  renderTrails();

  var countersAnimated = false;
  ScrollTrigger.create({
    trigger: ".proof",
    start: "top 80%",
    onEnter: function() {
      if (countersAnimated) return;
      countersAnimated = true;

      document.querySelectorAll('.metric').forEach(function(metricEl) {
        var valEl = metricEl.querySelector('.value');
        var targetVal = parseInt(valEl.getAttribute('data-value'), 10);
        var obj = { val: 0 };

        gsap.to(obj, {
          val: targetVal,
          duration: 2.2,
          ease: "power2.out",
          onUpdate: function() {
            valEl.textContent = Math.floor(obj.val);
            var rect = valEl.getBoundingClientRect();
            var parentRect = metricsCanvas.getBoundingClientRect();
            var cx = rect.left - parentRect.left + rect.width / 2;
            var cy = rect.top - parentRect.top + rect.height / 2;
            spawnTrail(cx, cy);
          },
          onComplete: function() {
            valEl.textContent = targetVal;
          }
        });
      });
    }
  });


  /* 3. FEATURE GRID SVG PARTICLE ICON RECONSTRUCTION */
  var featCanvases = document.querySelectorAll('.feat-canvas');

  featCanvases.forEach(function(canvas) {
    canvas.width = 50;
    canvas.height = 50;
    var ctx = canvas.getContext('2d');
    var featEl = canvas.closest('.feat');
    var svgIcon = featEl.querySelector('.icon');

    var iconType = featEl.getAttribute('data-icon-type');
    var targetPts = [];

    if (iconType === 'crate') {
      for (var x = 15; x <= 35; x += 1.5) {
        targetPts.push({ x: x, y: 15 });
        targetPts.push({ x: x, y: 35 });
      }
      for (var y = 15; y <= 35; y += 1.5) {
        targetPts.push({ x: 15, y: y });
        targetPts.push({ x: 35, y: y });
      }
    } else if (iconType === 'coin') {
      for (var a = 0; a < Math.PI * 2; a += Math.PI / 18) {
        targetPts.push({ x: 25 + Math.cos(a) * 11, y: 25 + Math.sin(a) * 11 });
      }
    } else {
      for (var x = 12; x <= 38; x += 1.5) targetPts.push({ x: x, y: 36 });
      for (var t = 0; t <= 1; t += 0.05) {
        targetPts.push({ x: 12 + t * 13, y: 24 - t * 10 });
        targetPts.push({ x: 25 + t * 13, y: 14 + t * 10 });
      }
    }

    var iconParticles = [];
    for (var i = 0; i < targetPts.length; i++) {
      iconParticles.push({
        x: Math.random() * 50,
        y: Math.random() * 50,
        tx: targetPts[i].x,
        ty: targetPts[i].y,
        size: 1.2 + Math.random() * 1.2
      });
    }

    var animatedIn = false;
    svgIcon.style.opacity = '0';
    svgIcon.style.transform = 'scale(0.8)';

    ScrollTrigger.create({
      trigger: featEl,
      start: "top 85%",
      onEnter: function() {
        if (animatedIn) return;
        animatedIn = true;

        var progressObj = { p: 0 };
        gsap.to(progressObj, {
          p: 1,
          duration: 1.4,
          ease: "power3.out",
          onUpdate: function() {
            ctx.clearRect(0, 0, 50, 50);
            var p = progressObj.p;
            for (var k = 0; k < iconParticles.length; k++) {
              var pt = iconParticles[k];
              var cx = THREE.MathUtils.lerp(pt.x, pt.tx, p);
              var cy = THREE.MathUtils.lerp(pt.y, pt.ty, p);
              ctx.beginPath();
              ctx.arc(cx, cy, pt.size, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(230, 120, 30, ' + (0.3 + p * 0.7) + ')';
              ctx.fill();
            }
          },
          onComplete: function() {
            gsap.to(svgIcon, { opacity: 1, scale: 1, duration: 0.4 });
            gsap.to(canvas, { opacity: 0, duration: 0.4 });
          }
        });
      }
    });
  });

})();