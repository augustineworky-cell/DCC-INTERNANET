(function(){
  var STORE_KEY = 'dcc_music_v1';

  var fab       = document.getElementById('music-fab');
  var panel     = document.getElementById('music-panel');
  var listEl    = document.getElementById('track-list');
  var toggleBtn = document.getElementById('music-toggle');
  var toggleLbl = document.getElementById('toggle-label');
  var toggleIcn = document.getElementById('toggle-icon');
  var volEl     = document.getElementById('volume');
  var urlEl     = document.getElementById('music-url');
  var addBtn    = document.getElementById('music-add');
  var noteEl    = document.getElementById('music-note');

  var ICON_ON  = '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>';
  var ICON_OFF = '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>';
  var NOTE_DEFAULT = 'Plays only in your own browser tab — no one else hears this.';
  var NOTE_BLOCKED = 'Your browser blocked autoplay. Click anywhere on the page to start it.';

  var state = {
    enabled: true,          // ON by default — starts automatically when the page opens
    volume: 55,
    activeId: 'default',
    tracks: [ { id:'default', name:'Default Track', type:'pad' } ]
  };

  /* ---------- persistence (safe if storage is unavailable) ---------- */
  function load(){
    try{
      var raw = localStorage.getItem(STORE_KEY);
      if(!raw) return;
      var saved = JSON.parse(raw);
      if(typeof saved.enabled === 'boolean') state.enabled = saved.enabled;
      if(typeof saved.volume === 'number') state.volume = saved.volume;
      if(Array.isArray(saved.tracks)){
        state.tracks = [ { id:'default', name:'Default Track', type:'pad' } ]
          .concat(saved.tracks.filter(function(t){ return t && t.id !== 'default'; }));
      }
      if(saved.activeId && state.tracks.some(function(t){return t.id===saved.activeId;})) state.activeId = saved.activeId;
    }catch(e){}
  }
  function save(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify({
        enabled: state.enabled, volume: state.volume, activeId: state.activeId,
        tracks: state.tracks.filter(function(t){ return t.id !== 'default'; })
      }));
    }catch(e){}
  }

  /* ---------- engine A: generated ambient pad (the Default Track) ---------- */
  var ac = null, pad = null;
  function buildPad(){
    if(pad) return pad;
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ac = ac || new AC();
    var out = ac.createGain(); out.gain.value = 0;
    var filt = ac.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=780; filt.Q.value=0.6;
    filt.connect(out); out.connect(ac.destination);

    var freqs = [110, 164.81, 220, 277.18, 329.63];
    var oscs = freqs.map(function(f, i){
      var o = ac.createOscillator(); o.type = i%2 ? 'sine' : 'triangle'; o.frequency.value = f;
      var g = ac.createGain(); g.gain.value = 0.10 / (i*0.5 + 1);
      // slow breathing so it never feels like a flat drone
      var lfo = ac.createOscillator(); lfo.frequency.value = 0.045 + i*0.013;
      var lg = ac.createGain(); lg.gain.value = g.gain.value * 0.75;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(filt); o.start();
      return o;
    });
    pad = { out: out, oscs: oscs };
    return pad;
  }
  function padPlay(v){
    var p = buildPad(); if(!p) return Promise.reject();
    return (ac.state === 'suspended' ? ac.resume() : Promise.resolve()).then(function(){
      p.out.gain.cancelScheduledValues(ac.currentTime);
      p.out.gain.setTargetAtTime(v * 0.30, ac.currentTime, 1.2);
    });
  }
  function padStop(){
    if(!pad || !ac) return;
    pad.out.gain.cancelScheduledValues(ac.currentTime);
    pad.out.gain.setTargetAtTime(0, ac.currentTime, 0.5);
  }

  /* ---------- engine B: direct audio file ---------- */
  var el = null;
  function elPlay(url, v){
    if(!el){ el = new Audio(); el.loop = true; el.crossOrigin = 'anonymous'; }
    if(el.src !== url){ el.src = url; }
    el.volume = v;
    return el.play();
  }
  function elStop(){ if(el){ el.pause(); } }

  /* ---------- engine C: YouTube ---------- */
  var yt = null, ytReady = false, ytLoading = false, ytQueue = [], ytPendingId = null;
  function ytId(url){
    var m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function ytLoad(cb){
    if(window.YT && window.YT.Player){ cb(); return; }
    ytQueue.push(cb);
    if(ytLoading) return;
    ytLoading = true;
    window.onYouTubeIframeAPIReady = function(){
      ytQueue.forEach(function(f){ f(); }); ytQueue = [];
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
  function ytPlay(vid, v){
    ytPendingId = vid;
    ytLoad(function(){
      if(!yt){
        yt = new YT.Player('yt-host', {
          height:'1', width:'1', videoId: vid,
          playerVars:{ autoplay:1, controls:0, loop:1, playlist:vid, playsinline:1 },
          events:{
            onReady: function(e){
              ytReady = true;
              e.target.setVolume(Math.round(v*100));
              e.target.playVideo();
            },
            onStateChange: function(e){ if(e.data === YT.PlayerState.ENDED){ e.target.playVideo(); } }
          }
        });
      } else if(ytReady){
        if(yt.getVideoData && yt.getVideoData().video_id !== vid){ yt.loadVideoById(vid); }
        yt.setVolume(Math.round(v*100));
        yt.playVideo();
      }
    });
  }
  function ytStop(){ if(yt && ytReady && yt.pauseVideo) yt.pauseVideo(); }

  /* ---------- orchestration ---------- */
  function activeTrack(){
    for(var i=0;i<state.tracks.length;i++){ if(state.tracks[i].id === state.activeId) return state.tracks[i]; }
    return state.tracks[0];
  }
  function stopAll(){ padStop(); elStop(); ytStop(); setPlayingUI(false); }

  function setPlayingUI(on){
    fab.classList.toggle('playing', on);
    if(window.__dccOrbAudio) window.__dccOrbAudio(on);
  }

  function applyVolume(){
    var v = state.volume / 100;
    volEl.style.background = 'linear-gradient(to right,#6fb4f0 0%,#6fb4f0 ' + state.volume +
      '%,rgba(255,255,255,0.14) ' + state.volume + '%,rgba(255,255,255,0.14) 100%)';
    if(el) el.volume = v;
    if(yt && ytReady && yt.setVolume) yt.setVolume(Math.round(v*100));
    if(pad && ac && state.enabled) pad.out.gain.setTargetAtTime(v*0.30, ac.currentTime, 0.3);
  }

  var armed = false;
  function armFirstGesture(){
    if(armed) return;
    armed = true;
    noteEl.textContent = NOTE_BLOCKED;
    noteEl.classList.add('warn');
    var go = function(){
      document.removeEventListener('pointerdown', go);
      document.removeEventListener('keydown', go);
      document.removeEventListener('scroll', go);
      armed = false;
      noteEl.textContent = NOTE_DEFAULT;
      noteEl.classList.remove('warn');
      if(state.enabled) play();
    };
    document.addEventListener('pointerdown', go, { once:true });
    document.addEventListener('keydown', go, { once:true });
    document.addEventListener('scroll', go, { once:true, passive:true });
  }

  function play(){
    var t = activeTrack();
    var v = state.volume / 100;
    padStop(); elStop(); ytStop();

    var p;
    if(t.type === 'pad')       p = padPlay(v);
    else if(t.type === 'file') p = elPlay(t.url, v);
    else                       { ytPlay(t.vid, v); p = Promise.resolve(); }

    Promise.resolve(p).then(function(){ setPlayingUI(true); })
      .catch(function(){ setPlayingUI(false); armFirstGesture(); });
  }

  function setEnabled(on){
    state.enabled = on;
    toggleLbl.textContent = on ? 'On' : 'Off';
    toggleBtn.classList.toggle('on', on);
    toggleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggleIcn.innerHTML = on ? ICON_ON : ICON_OFF;
    if(on) play(); else stopAll();
    save();
  }

  function renderList(){
    listEl.innerHTML = '';
    state.tracks.forEach(function(t){
      var row = document.createElement('div');
      row.className = 'track' + (t.id === state.activeId ? ' active' : '');
      row.setAttribute('role','button');
      row.setAttribute('tabindex','0');

      row.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>' +
        '<span class="tname"></span>';
      row.querySelector('.tname').textContent = t.name;

      if(t.id !== 'default'){
        var kill = document.createElement('button');
        kill.className = 'kill'; kill.type = 'button';
        kill.setAttribute('aria-label','Remove ' + t.name);
        kill.textContent = '\u00D7';
        kill.addEventListener('click', function(ev){
          ev.stopPropagation();
          state.tracks = state.tracks.filter(function(x){ return x.id !== t.id; });
          if(state.activeId === t.id){ state.activeId = 'default'; if(state.enabled) play(); }
          save(); renderList();
        });
        row.appendChild(kill);
      }

      var pick = function(){
        state.activeId = t.id;
        renderList(); save();
        if(state.enabled) play();
      };
      row.addEventListener('click', pick);
      row.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pick(); } });

      listEl.appendChild(row);
    });
  }

  function addTrack(){
    var url = urlEl.value.trim();
    if(!url) return;
    var vid = ytId(url);
    var t;
    if(vid){
      t = { id:'t'+Date.now(), name:'YouTube · ' + vid, type:'yt', vid:vid, url:url };
    } else if(/^https?:\/\//i.test(url)){
      var nm = url.split('/').pop().split('?')[0] || 'Audio link';
      t = { id:'t'+Date.now(), name: decodeURIComponent(nm).slice(0,38), type:'file', url:url };
    } else {
      noteEl.textContent = 'That does not look like a link. Paste a full YouTube or .mp3 URL.';
      noteEl.classList.add('warn');
      setTimeout(function(){ noteEl.textContent = NOTE_DEFAULT; noteEl.classList.remove('warn'); }, 3200);
      return;
    }
    state.tracks.push(t);
    state.activeId = t.id;
    urlEl.value = '';
    save(); renderList();
    if(state.enabled) play();
  }

  /* ---------- wiring ---------- */
  fab.addEventListener('click', function(){
    var open = panel.classList.toggle('open');
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function(e){
    if(!panel.classList.contains('open')) return;
    if(panel.contains(e.target) || fab.contains(e.target)) return;
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded','false');
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ panel.classList.remove('open'); fab.setAttribute('aria-expanded','false'); }
  });

  toggleBtn.addEventListener('click', function(){ setEnabled(!state.enabled); });
  volEl.addEventListener('input', function(){ state.volume = parseInt(volEl.value,10); applyVolume(); });
  volEl.addEventListener('change', save);
  addBtn.addEventListener('click', addTrack);
  urlEl.addEventListener('keydown', function(e){ if(e.key === 'Enter') addTrack(); });

  load();
  volEl.value = state.volume;
  renderList();
  applyVolume();

  toggleLbl.textContent = state.enabled ? 'On' : 'Off';
  toggleBtn.classList.toggle('on', state.enabled);
  toggleBtn.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
  toggleIcn.innerHTML = state.enabled ? ICON_ON : ICON_OFF;

  // auto-start on open; falls back to the first click if the browser blocks it
  if(state.enabled){ play(); }
})();