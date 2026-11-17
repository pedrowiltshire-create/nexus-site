/* Nexus – geotecnologia: efeitos de rolagem, globo 3D, tema e mapa de satélite */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var root = $('pg-root');

  /* ---------------- tema claro/escuro ---------------- */
  var themeBtn = $('pg-theme');
  function setTheme(t) {
    root.classList.toggle('pg-light', t === 'light');
    root.classList.toggle('pg-dark', t !== 'light');
    var lbl = t === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro';
    themeBtn.setAttribute('aria-label', lbl); themeBtn.title = lbl;
    try { localStorage.setItem('nexus-tema', t); } catch (e) {}
  }
  var saved = 'dark';
  try { var v = localStorage.getItem('nexus-tema'); if (v === 'light' || v === 'dark') saved = v; } catch (e) {}
  setTheme(saved);
  themeBtn.addEventListener('click', function () { setTheme(root.classList.contains('pg-light') ? 'dark' : 'light'); });

  /* ---------------- rolagem: título, planeta, menu, progresso, zoom ---------------- */
  var orb = $('pg-orb'), title = $('pg-title'), hero = $('home'), header = $('pg-header'), prog = $('pg-prog');
  var footer = document.querySelector('footer');
  var zoomEls = [].slice.call(document.querySelectorAll('[data-zoom]'));
  var sy = 0, px = 0, py = 0;
  function applyOrb() {
    if (orb) {
      var sc = 1 + Math.min(sy, 1100) * 0.00085;
      orb.style.transform = reduce ? 'none' : 'translate(' + (px * 18).toFixed(1) + 'px,' + (py * 12).toFixed(1) + 'px) scale(' + sc.toFixed(4) + ')';
      orb.style.opacity = String(Math.max(0, 1 - Math.max(0, sy - 520) / 680));
    }
    if (title) {
      title.style.transform = reduce ? 'none' : 'translate(' + (px * -10).toFixed(1) + 'px,' + (sy * 0.34 + py * -6).toFixed(1) + 'px)';
      title.style.opacity = String(Math.max(0, 1 - sy / 460));
      title.style.pointerEvents = sy > 380 ? 'none' : '';
    }
  }
  function applyFx() {
    var de = document.documentElement;
    sy = window.scrollY || de.scrollTop || 0;
    var max = de.scrollHeight - window.innerHeight;
    applyOrb();
    if (prog) prog.style.width = (max > 0 ? Math.min(100, sy / max * 100) : 0).toFixed(2) + '%';
    if (header) {
      header.classList.toggle('compact', sy > 40);
      var dockAt = hero ? hero.offsetHeight - 90 : 620;
      header.classList.toggle('dock', sy > dockAt);
      var away = false;
      if (footer) away = sy > dockAt && footer.getBoundingClientRect().top < window.innerHeight - 10;
      header.classList.toggle('away', away);
    }
    if (!reduce) zoomEls.forEach(function (el) {
      var b = el.getBoundingClientRect(), vh = window.innerHeight;
      if (b.bottom < -260 || b.top > vh + 260) return;
      var d = ((b.top + b.height / 2) - vh / 2) / vh; d = Math.max(0, Math.min(1, d));
      el.style.transform = 'scale(' + (1 - d * d * 0.13).toFixed(4) + ')';
    });
  }
  window.addEventListener('scroll', applyFx, { passive: true });
  window.addEventListener('resize', applyFx);
  window.addEventListener('mousemove', function (e) { px = e.clientX / window.innerWidth - 0.5; py = e.clientY / window.innerHeight - 0.5; applyOrb(); }, { passive: true });
  applyFx();

  /* ---------------- revelar ao rolar ---------------- */
  var rv = [].slice.call(document.querySelectorAll('[data-rv]'));
  function show(el, delay) {
    el.style.transitionDelay = (delay || 0) + 'ms';
    el.setAttribute('data-rv', 'in');
    setTimeout(function () { el.style.transitionDelay = ''; el.removeAttribute('data-rv'); }, 1500 + (delay || 0));
  }
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(function (el) { el.removeAttribute('data-rv'); });
  else {
    var io = new IntersectionObserver(function (ents) {
      var i = 0;
      ents.forEach(function (en) { if (!en.isIntersecting) return; show(en.target, (i++ % 6) * 80); io.unobserve(en.target); });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    rv.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- globo 3D (WebGL, foto Blue Marble da NASA) ---------------- */
  (function globe() {
    var cv = $('pg-globe'), fallback = $('pg-fallback');
    if (!cv) return;
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    var img = new Image();
    img.onload = function () {
      var N = Math.max(400, Math.min(2048, Math.round((cv.clientWidth || 1000) * Math.min(2, window.devicePixelRatio || 1))));
      cv.width = N; cv.height = N;
      var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
      var fs = [
        'precision highp float;',
        'uniform sampler2D tex;uniform vec2 res;uniform float lon;uniform float la0;uniform vec3 L;',
        'const float PI=3.14159265359;',
        'void main(){',
        ' vec2 q=(gl_FragCoord.xy/res)*2.-1.;',
        ' float rho=length(q);',
        ' float edge=clamp((1.-rho)*res.x*.5,0.,1.);',
        ' if(edge<=0.){gl_FragColor=vec4(0.);return;}',
        ' float Z=sqrt(max(0.,1.-rho*rho));vec3 n=vec3(q,Z);',
        ' float sl=sin(la0),cl=cos(la0);',
        ' float lat=asin(clamp(Z*sl+q.y*cl,-1.,1.));',
        ' float dl=atan(q.x,Z*cl-q.y*sl);',
        ' vec2 uv=vec2((lon+dl)/(2.*PI)+.5,.5-lat/PI);',
        ' vec3 c=pow(texture2D(tex,uv).rgb,vec3(2.2));',
        ' float ocean=smoothstep(.02,.10,c.b-max(c.r,c.g));',
        ' float dif=clamp(dot(n,L)*1.1+.05,0.,1.);',
        ' vec3 col=c*(.025+1.2*dif);',
        ' vec3 H=normalize(L+vec3(0.,0.,1.));',
        ' col+=vec3(.55,.7,.9)*pow(max(dot(n,H),0.),70.)*ocean*.35*dif;',
        ' float fr=pow(1.-Z,3.2)*clamp(q.y*1.4+.15,0.,1.);',
        ' col=mix(col,pow(vec3(.45,.68,1.),vec3(2.2)),clamp(fr*1.25,0.,1.));',
        ' col=pow(clamp(col,0.,1.),vec3(1./2.2));',
        ' gl_FragColor=vec4(col*edge,edge);',
        '}'].join('\n');
      function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
      var prog;
      try {
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        var tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); // falha se o arquivo for aberto direto do disco (file://)
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        var an = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      } catch (e) { return; }
      var Lv = [-0.12, 0.78, 0.42], ln = Math.hypot(Lv[0], Lv[1], Lv[2]);
      var U = { res: gl.getUniformLocation(prog, 'res'), lon: gl.getUniformLocation(prog, 'lon') };
      gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0);
      gl.uniform2f(U.res, N, N);
      gl.uniform1f(gl.getUniformLocation(prog, 'la0'), -50 * Math.PI / 180);
      gl.uniform3f(gl.getUniformLocation(prog, 'L'), Lv[0] / ln, Lv[1] / ln, Lv[2] / ln);
      gl.viewport(0, 0, N, N); gl.clearColor(0, 0, 0, 0);
      var t0 = performance.now(), lonCur = 0, last = null, ready = false;
      (function tick() {
        requestAnimationFrame(tick);
        var b = cv.getBoundingClientRect();
        if (b.bottom < -50 || b.top > window.innerHeight + 50) return;
        var t = (performance.now() - t0) / 1000;
        var target = -52 + sy * 0.12 + (reduce ? 0 : t * 1.2);
        if (last === null || reduce) lonCur = target; else lonCur += (target - lonCur) * 0.09;
        if (last !== null && Math.abs(lonCur - last) < 0.004) return;
        last = lonCur;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(U.lon, lonCur * Math.PI / 180);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!ready) { ready = true; cv.style.opacity = '1'; if (fallback) fallback.style.opacity = '0'; }
      })();
    };
    img.src = 'assets/terra-bluemarble.jpg';
  })();

  /* ---------------- mapa de satélite + voo cinematográfico + Street View ---------------- */
  // Opcional: com uma chave da API do Google Maps (Maps Embed API), o Street View usa a API oficial.
  var GOOGLE_MAPS_KEY = '';

  var PLACES = [
    { name: 'Maricá', kicker: 'Exemplo · Maricá, RJ', lat: -22.9187, lng: -42.8186, zoom: 14.2, main: true },
    { name: 'Rio de Janeiro', kicker: 'Praia de Copacabana', lat: -22.9711, lng: -43.1822, zoom: 15.2 },
    { name: 'São Paulo', kicker: 'Avenida Paulista', lat: -23.5614, lng: -46.6559, zoom: 15.4 },
    { name: 'Brasília', kicker: 'Esplanada dos Ministérios', lat: -15.7997, lng: -47.8645, zoom: 14.8 },
    { name: 'Belo Horizonte', kicker: 'Praça da Liberdade', lat: -19.9320, lng: -43.9380, zoom: 15.6 },
    { name: 'Salvador', kicker: 'Pelourinho', lat: -12.9714, lng: -38.5080, zoom: 15.8 },
    { name: 'Recife', kicker: 'Marco Zero', lat: -8.0631, lng: -34.8711, zoom: 15.6 },
    { name: 'Fortaleza', kicker: 'Avenida Beira-Mar', lat: -3.7253, lng: -38.4920, zoom: 15.2 },
    { name: 'Belém', kicker: 'Mercado Ver-o-Peso', lat: -1.4528, lng: -48.5040, zoom: 15.6 },
    { name: 'Manaus', kicker: 'Teatro Amazonas', lat: -3.1303, lng: -60.0234, zoom: 15.6 },
    { name: 'Curitiba', kicker: 'Jardim Botânico', lat: -25.4419, lng: -49.2389, zoom: 15.6 },
    { name: 'Porto Alegre', kicker: 'Orla do Guaíba', lat: -30.0340, lng: -51.2410, zoom: 15.2 }
  ];

  function fmt(v, pos, neg) { var a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '′ ' + (v < 0 ? neg : pos); }

  function initMap() {
    if (!window.maplibregl || !$('pg-map')) return;
    var mgl = window.maplibregl;
    var style = {
      version: 8,
      sources: {
        satlow: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 9 },
        sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagens: Esri, Maxar, Earthstar Geographics e comunidade GIS' },
        ref: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
        dem: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Relevo: Terrain Tiles (AWS / Mapzen)' }
      },
      layers: [
        { id: 'satlow', type: 'raster', source: 'satlow', paint: { 'raster-fade-duration': 0 } },
        { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 300 } },
        { id: 'ref', type: 'raster', source: 'ref', paint: { 'raster-opacity': 0.9 } }
      ]
    };
    var map = new mgl.Map({
      container: 'pg-map', style: style,
      center: [-50, -14], zoom: 2.7, pitch: 0, bearing: 0, maxPitch: 75,
      fadeDuration: 200,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'Use Ctrl + rolagem para dar zoom no mapa',
        'CooperativeGesturesHandler.MacHelpText': 'Use ⌘ + rolagem para dar zoom no mapa',
        'CooperativeGesturesHandler.MobileHelpText': 'Use dois dedos para mover o mapa'
      }
    });
    window.__nexusMap = map; // diagnóstico
    map.addControl(new mgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mgl.FullscreenControl(), 'top-right');
    var terrainOn = true, orbitOn = !reduce, current = null;

    map.on('style.load', function () {
      try { map.setProjection({ type: 'globe' }); } catch (e) {}
      try { map.setSky({ 'sky-color': '#0B1E3A', 'horizon-color': '#7CC3F5', 'fog-color': '#BFD9F2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 7, 1, 10, 0] }); } catch (e) {}
      // o relevo 3D só entra depois que a câmera chega ao local (evita "paredes" durante o voo)
    });

    // marcadores
    PLACES.forEach(function (p, i) {
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'pg-mk' + (p.main ? '' : ' sec');
      el.setAttribute('aria-label', 'Voar até ' + p.name);
      el.addEventListener('click', function (e) { e.stopPropagation(); fly(i); });
      new mgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });

    // lista de locais
    var list = $('pg-places');
    PLACES.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pg-place'; b.setAttribute('role', 'listitem'); b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="pg-dot"></span><span>' + p.name + '<small>' + p.kicker + '</small></span>';
      b.addEventListener('click', function () { fly(i); });
      b.addEventListener('mouseenter', function () { warm(p); });
      b.addEventListener('focus', function () { warm(p); });
      list.appendChild(b);
    });


    // baixa antes as imagens (satélite, nomes e relevo) em volta do destino, em vários níveis de zoom
    var warmed = {};
    function tileXY(lng, lat, z) {
      var n = Math.pow(2, z), x = Math.floor((lng + 180) / 360 * n);
      var r = lat * Math.PI / 180, y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
      return [x, y];
    }
    function warm(p) {
      if (warmed[p.name]) return Promise.resolve(); 
      var urls = [], zmax = Math.min(18, Math.ceil(p.zoom + 0.5));
      for (var z = Math.max(5, zmax - 5); z <= zmax; z++) {
        var c = tileXY(p.lng, p.lat, z), R = z >= zmax - 1 ? 3 : 2;
        for (var dx = -R; dx <= R; dx++) for (var dy = -R; dy <= R; dy++) {
          var x = c[0] + dx, y = c[1] + dy;
          urls.push('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x);
          if (z >= zmax - 2) urls.push('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/' + z + '/' + y + '/' + x);
          if (z <= 14 && z >= zmax - 3) urls.push('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + x + '/' + y + '.png');
        }
      }
      warmed[p.name] = true;
      return Promise.all(urls.map(function (u) { return new Promise(function (ok) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = im.onerror = ok; im.src = u; }); }));
    }
    function withTimeout(pr, ms) { return Promise.race([pr, new Promise(function (ok) { setTimeout(ok, ms); })]); }
    function terrainOnNow() { if (!terrainOn) return; try { if (!map.getTerrain || !map.getTerrain()) map.setTerrain({ source: 'dem', exaggeration: 1.35 }); } catch (e) {} }
    var token = 0; // cada voo/interação gera um novo "token"; animações antigas param sozinhas
    function fly(i) {
      var p = PLACES[i]; current = p;
      token++; var my = token;
      [].forEach.call(list.children, function (c, k) { c.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      map.stop();
      try { map.setTerrain(null); } catch (e) {}
      $('pg-pc-kicker').textContent = p.kicker;
      $('pg-pc-name').textContent = p.name;
      $('pg-pc-coord').textContent = fmt(p.lat, 'N', 'S') + ' · ' + fmt(p.lng, 'L', 'O');
      $('pg-gmaps').href = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + p.lat + ',' + p.lng;
      var card = $('pg-placecard'); card.hidden = true; void card.offsetWidth; card.hidden = false;
      var bearing = (Math.random() * 90) - 45;
      // espera até 1,2 s pelas imagens do destino (normalmente bem menos) e então voa
      withTimeout(warm(p), 1200).then(function () {
        if (my !== token) return;
        // 1º: voo amplo, quase de cima, até perto do local
        map.flyTo({ center: [p.lng, p.lat], zoom: p.zoom - 1.2, pitch: 30, bearing: bearing * 0.5, speed: 0.7, curve: 1.6, essential: true });
        map.once('moveend', function () {
          if (my !== token) return;
          // 2º: quando o local já está carregado, mergulha inclinando a câmera e liga o relevo 3D
          var go = function () {
            if (my !== token) return;
            map.easeTo({ zoom: p.zoom, pitch: 64, bearing: bearing, duration: 2600, easing: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, essential: true });
            map.once('moveend', function () { if (my === token) setTimeout(function () { startOrbit(my); }, 300); });
          };
          // liga o relevo ainda com a câmera quase reta e espera ele carregar antes de inclinar
          terrainOnNow();
          var done = false; var f = function () { if (!done) { done = true; go(); } };
          map.once('idle', f); setTimeout(f, 1800);
        });
      });
    }

    // câmera girando devagar ao redor do local depois do voo
    function startOrbit(my) {
      if (!orbitOn || my !== token || !current) return;
      map.easeTo({ bearing: map.getBearing() + 30, duration: 12000, easing: function (t) { return t; }, essential: true });
      map.once('moveend', function () { if (my === token) startOrbit(my); });
    }
    function interrupt() { token++; try { if (terrainOn && map.getTerrain && map.getTerrain()) map.setTerrain({ source: 'dem', exaggeration: 1.35 }); } catch (e) {} }
    map.on('movestart', function (e) { if (e && e.originalEvent) interrupt(); });
    ['mousedown', 'touchstart', 'wheel'].forEach(function (ev) { map.getCanvas().addEventListener(ev, interrupt, { passive: true }); });
    map.getContainer().addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.maplibregl-ctrl')) interrupt(); }, true);

    // camadas
    [].forEach.call(document.querySelectorAll('.pg-switch'), function (sw) {
      sw.addEventListener('click', function () {
        var on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        var k = sw.getAttribute('data-layer');
        if (k === 'ref') map.setLayoutProperty('ref', 'visibility', on ? 'visible' : 'none');
        if (k === 'terrain') { terrainOn = on; if (on) terrainOnNow(); else { try { map.setTerrain(null); } catch (e) {} } }
        if (k === 'orbit') { orbitOn = on; token++; if (on) startOrbit(token); else map.stop(); }
      });
    });
    if (reduce) { var ob = document.querySelector('.pg-switch[data-layer="orbit"]'); if (ob) ob.setAttribute('aria-checked', 'false'); }

    // Street View
    var sv = $('pg-sv'), ifr = $('pg-sv-iframe'), lastFocus = null;
    function openSV() {
      if (!current) return;
      var p = current;
      ifr.src = GOOGLE_MAPS_KEY
        ? 'https://www.google.com/maps/embed/v1/streetview?key=' + encodeURIComponent(GOOGLE_MAPS_KEY) + '&location=' + p.lat + ',' + p.lng + '&fov=80'
        : 'https://maps.google.com/maps?layer=c&cbll=' + p.lat + ',' + p.lng + '&cbp=11,0,0,0,0&output=svembed';
      $('pg-sv-title').textContent = 'Street View · ' + p.name;
      lastFocus = document.activeElement;
      sv.hidden = false;
      sv.querySelector('button[data-close]').focus();
    }
    function closeSV() { sv.hidden = true; ifr.src = 'about:blank'; if (lastFocus) lastFocus.focus(); }
    $('pg-sv-open').addEventListener('click', openSV);
    [].forEach.call(sv.querySelectorAll('[data-close]'), function (el) { el.addEventListener('click', closeSV); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sv.hidden) closeSV(); });

    // ao entrar na tela pela primeira vez, voa até a sede
    if ('IntersectionObserver' in window) {
      var first = new IntersectionObserver(function (ents) {
        if (ents.some(function (e) { return e.isIntersecting; })) { first.disconnect(); setTimeout(function () { fly(0); }, 600); }
      }, { threshold: 0.45 });
      first.observe($('pg-map'));
    }
  }
  if (document.readyState === 'complete') initMap(); else window.addEventListener('load', initMap);
})();
