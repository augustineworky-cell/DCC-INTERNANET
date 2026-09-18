(function(){
  var container = document.getElementById('tab-theme-canvas');
  var appView = document.getElementById('app-view');
  if(!container || !appView || !window.THREE){ return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var width = window.innerWidth;
  var height = window.innerHeight;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 10;
  var renderer = null;
  var points = null;
  var strands = null;
  var animationFrame = null;
  var running = false;
  var lastTime = 0;
  var resizeTimer = null;
  var currentTable = null;
  var state = { speed:0.22, spread:1, opacity:0.14 };
  var targetColor = new THREE.Color('#3b72b8');

  var TABLE_THEMES = {
    attendance: { color:'#54c9a4' },
    fms_systems: { color:'#3b72b8' },
    ims: { color:'#e6781e' },
    mis: { color:'#8d74e8' },
    crm: { color:'#ff6b9c' },
    delegation: { color:'#55cfe3' },
    human_resource: { color:'#e6b85c' }
  };

  var particleCount = 1800;
  var positions = new Float32Array(particleCount * 3);
  var velocities = new Float32Array(particleCount * 3);
  var linePositions = new Float32Array(particleCount * 6);
  var geometry = new THREE.BufferGeometry();
  var lineGeometry = new THREE.BufferGeometry();

  function createParticleTexture(){
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var context = canvas.getContext('2d');
    var gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.65)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  function resetParticle(index){
    var i = index * 3;
    positions[i] = (Math.random() - 0.5) * 12;
    positions[i + 1] = (Math.random() - 0.5) * 8;
    positions[i + 2] = (Math.random() - 0.5) * 8;
    velocities[i] = (Math.random() - 0.5) * 0.012;
    velocities[i + 1] = (Math.random() - 0.5) * 0.012;
    velocities[i + 2] = (Math.random() - 0.5) * 0.008;
  }

  function buildScene(){
    for(var i = 0; i < particleCount; i++){
      resetParticle(i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    var texture = createParticleTexture();
    var material = new THREE.PointsMaterial({
      color:targetColor,
      size:0.09,
      map:texture,
      transparent:true,
      opacity:state.opacity,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });
    var lineMaterial = new THREE.LineBasicMaterial({
      color:targetColor,
      transparent:true,
      opacity:state.opacity * 0.65,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });

    points = new THREE.Points(geometry, material);
    strands = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(points);
    scene.add(strands);
  }

  function isDashboardVisible(){
    return document.visibilityState === 'visible' && appView.style.display !== 'none';
  }

  function renderFrame(time){
    animationFrame = null;
    if(!running || !isDashboardVisible()){
      running = false;
      return;
    }

    var elapsed = Math.min((time - lastTime) / 16.67, 3);
    lastTime = time;
    var t = time * 0.00035;
    var speed = state.speed * elapsed;
    var trail = 0.09 + state.speed * 0.26;

    for(var i = 0; i < particleCount; i++){
      var p = i * 3;
      var x = positions[p];
      var y = positions[p + 1];
      var z = positions[p + 2];
      var curlX = Math.sin(y * 0.72 + t + z * 0.24) - Math.cos(z * 0.58 - t * 0.7);
      var curlY = Math.sin(z * 0.64 - t * 0.8 + x * 0.18) - Math.cos(x * 0.42 + t);
      var curlZ = Math.sin(x * 0.38 + y * 0.22 + t * 0.6) - Math.cos(y * 0.5 - t);

      velocities[p] = velocities[p] * 0.985 + curlX * 0.00018 * state.spread;
      velocities[p + 1] = velocities[p + 1] * 0.985 + curlY * 0.00018 * state.spread;
      velocities[p + 2] = velocities[p + 2] * 0.985 + curlZ * 0.00012 * state.spread;
      positions[p] += velocities[p] * speed;
      positions[p + 1] += velocities[p + 1] * speed;
      positions[p + 2] += velocities[p + 2] * speed;

      if(Math.abs(positions[p]) > 7 || Math.abs(positions[p + 1]) > 5 || Math.abs(positions[p + 2]) > 5){
        resetParticle(i);
      }

      linePositions[i * 6] = positions[p];
      linePositions[i * 6 + 1] = positions[p + 1];
      linePositions[i * 6 + 2] = positions[p + 2];
      linePositions[i * 6 + 3] = positions[p] - velocities[p] * trail;
      linePositions[i * 6 + 4] = positions[p + 1] - velocities[p + 1] * trail;
      linePositions[i * 6 + 5] = positions[p + 2] - velocities[p + 2] * trail;
    }

    geometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(renderFrame);
  }

  function startRendering(){
    if(reduceMotion || running || !isDashboardVisible()){ return; }
    running = true;
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(renderFrame);
  }

  function stopRendering(){
    running = false;
    if(animationFrame){
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function setStaticTheme(color){
    container.style.background = 'radial-gradient(circle at 50% 45%, ' + color + '22, transparent 68%)';
  }

  function tabThemeOnSwitch(table){
    var theme = TABLE_THEMES[table];
    if(!theme || table === currentTable){
      container.style.opacity = reduceMotion ? '0.7' : '1';
      if(reduceMotion){
        stopRendering();
      }else if(isDashboardVisible()){
        startRendering();
      }
      return;
    }

    currentTable = table;
    container.style.opacity = reduceMotion ? '0.7' : '1';
    targetColor.set(theme.color);
    setStaticTheme(theme.color);

    if(reduceMotion){
      stopRendering();
      return;
    }

    startRendering();
    var burst = { speed:0.22, spread:1, opacity:0.14 };
    gsap.to(burst, {
      speed:1.8,
      spread:3.2,
      opacity:0.34,
      duration:0.55,
      ease:'power2.out',
      onUpdate:function(){
        state.speed = burst.speed;
        state.spread = burst.spread;
        state.opacity = burst.opacity;
        if(points){ points.material.color.lerp(targetColor, 0.12); points.material.opacity = burst.opacity; }
        if(strands){ strands.material.color.lerp(targetColor, 0.12); strands.material.opacity = burst.opacity * 0.65; }
      },
      onComplete:function(){
        gsap.to(state, {
          speed:0.22,
          spread:1,
          opacity:0.14,
          duration:1.1,
          ease:'power2.out',
          onUpdate:function(){
            if(points){ points.material.opacity = state.opacity; }
            if(strands){ strands.material.opacity = state.opacity * 0.65; }
          }
        });
      }
    });
  }

  function tabThemeOnHome(){
    stopRendering();
    container.style.opacity = '0';
  }

  function resize(){
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }

  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  buildScene();
  container.style.opacity = '0';

  window.tabThemeOnSwitch = tabThemeOnSwitch;
  window.tabThemeOnHome = tabThemeOnHome;
  document.addEventListener('visibilitychange', function(){
    if(isDashboardVisible()){ startRendering(); } else { stopRendering(); }
  });
  window.addEventListener('resize', function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  if(reduceMotion){
    container.style.opacity = '0.7';
  }

  var initialId = location.hash.replace('#', '');
  var initialTab = window.DCC_TABS && window.DCC_TABS.filter(function(tab){ return tab.id === initialId; })[0];
  if(initialTab){
    container.style.opacity = reduceMotion ? '0.7' : '1';
    tabThemeOnSwitch(initialTab.table);
  }else{
    tabThemeOnHome();
  }
})();
