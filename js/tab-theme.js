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
  var animationFrame = null;
  var running = false;
  var lastTime = 0;
  var resizeTimer = null;
  var currentTable = null;
  var state = { speed:0.22, spread:1, opacity:0.42 };
  var targetColor = new THREE.Color('#3b72b8');

  var TABLE_THEMES = {
    home: { color:'#d8c7a1' },
    attendance: { color:'#54c9a4' },
    fms_systems: { color:'#3b72b8' },
    ims: { color:'#e6781e' },
    mis: { color:'#8d74e8' },
    crm: { color:'#ff6b9c' },
    delegation: { color:'#55cfe3' },
    human_resource: { color:'#e6b85c' }
  };

  var ribbonCount = 15;
  var segmentCount = 28;
  var ribbonRadius = 0.032;
  var ribbonOpacityScale = 0.55;
  var ribbons = [];

  function createRibbonColor(index){
    var color = targetColor.clone();
    color.offsetHSL((index - ribbonCount / 2) * 0.012, 0.04, (index % 3) * 0.035);
    return color;
  }

  function ribbonPoints(ribbon, time){
    var points = [];
    var amplitude = 0.7 + state.spread * 0.24;
    var drift = time * state.speed * 0.32;

    for(var i = 0; i < segmentCount; i++){
      var u = i / (segmentCount - 1);
      var x = (u - 0.5) * 15;
      var phase = ribbon.phase;
      var y = Math.sin(u * 6.1 + phase + drift) * amplitude;
      y += Math.sin(u * 3.1 - drift * 0.8 + phase * 0.6) * 0.8;
      y += Math.cos(u * 12.5 + phase * 1.4 + drift * 0.35) * 0.16;
      var z = -1.4 + Math.sin(u * 4.4 + phase + drift * 0.5) * 1.55;
      z += Math.cos(u * 9.2 + phase) * 0.3;
      x += Math.sin(u * 2.8 + phase + drift * 0.45) * 0.7;
      points.push(new THREE.Vector3(x, y + ribbon.lift, z));
    }

    return points;
  }

  function buildRibbon(ribbon, time){
    var curve = new THREE.CatmullRomCurve3(ribbonPoints(ribbon, time));
    var geometry = new THREE.TubeGeometry(curve, segmentCount - 2, ribbonRadius, 3, false);
    if(ribbon.mesh){
      ribbon.mesh.geometry.dispose();
      ribbon.mesh.geometry = geometry;
    }else{
      var material = new THREE.MeshBasicMaterial({
        color:createRibbonColor(ribbon.index),
        transparent:true,
        opacity:state.opacity * ribbonOpacityScale,
        depthWrite:false,
        blending:THREE.AdditiveBlending
      });
      ribbon.mesh = new THREE.Mesh(geometry, material);
      scene.add(ribbon.mesh);
    }
  }

  function buildScene(){
    for(var i = 0; i < ribbonCount; i++){
      var ribbon = {
        index:i,
        phase:(i / ribbonCount) * Math.PI * 2,
        lift:(i - ribbonCount / 2) * 0.055,
        mesh:null
      };
      ribbons.push(ribbon);
      buildRibbon(ribbon, 0);
    }
  }

  function updateRibbonColors(){
    ribbons.forEach(function(ribbon){
      var color = createRibbonColor(ribbon.index);
      ribbon.mesh.material.color.copy(color);
      ribbon.mesh.material.opacity = state.opacity * ribbonOpacityScale;
    });
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
    var flowTime = time * 0.001 * (0.7 + state.speed) * elapsed;

    ribbons.forEach(function(ribbon){
      ribbon.mesh.position.x = Math.sin(flowTime * 0.7 + ribbon.phase) * 0.8;
      ribbon.mesh.position.y = Math.cos(flowTime * 0.55 + ribbon.phase) * 0.16;
      ribbon.mesh.rotation.z = Math.sin(flowTime * 0.32 + ribbon.phase) * 0.08;
      ribbon.mesh.rotation.y = Math.cos(flowTime * 0.28 + ribbon.phase) * 0.06;
      ribbon.mesh.scale.y = 0.9 + state.spread * 0.08;
      ribbon.mesh.material.opacity = state.opacity * ribbonOpacityScale;
    });

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
    container.style.background = 'radial-gradient(circle at 50% 45%, ' + color + '33, transparent 68%)';
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
    updateRibbonColors();

    if(reduceMotion){
      stopRendering();
      return;
    }

    startRendering();
    var burst = { speed:0.22, spread:1, opacity:0.42 };
    gsap.to(burst, {
      speed:1.8,
      spread:3.2,
      opacity:0.72,
      duration:0.55,
      ease:'power2.out',
      onUpdate:function(){
        state.speed = burst.speed;
        state.spread = burst.spread;
        state.opacity = burst.opacity;
        ribbons.forEach(function(ribbon){ ribbon.mesh.material.opacity = burst.opacity * ribbonOpacityScale; });
      },
      onComplete:function(){
        gsap.to(state, {
          speed:0.22,
          spread:1,
          opacity:0.42,
          duration:1.1,
          ease:'power2.out',
          onUpdate:function(){
            ribbons.forEach(function(ribbon){ ribbon.mesh.material.opacity = state.opacity * ribbonOpacityScale; });
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
    if(isDashboardVisible()){ startRendering(); }else{ stopRendering(); }
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
