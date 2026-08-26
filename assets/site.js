/* Sleepyland site.js — 自動產生：常駐 canvas 動畫 + 卡片互動 + 無縫換頁 + BGM */
(function(){

    (function(){
        const canvas = document.getElementById('sky');
        const ctx = canvas.getContext('2d');
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const moonEl = document.querySelector('.moon');
        // 月亮隨機模糊 0~2px（兩個不同頻率 sin 疊出平滑擬隨機），保留黃色光暈
        function updateMoonBlur(t){
            if (!moonEl) return;
            let b = 1 + Math.sin(t * 0.5) * 0.6 + Math.sin(t * 0.23 + 1.3) * 0.45;
            b = Math.max(0, Math.min(2, b));
            moonEl.style.filter = 'drop-shadow(0 0 34px rgba(255,244,190,0.55)) blur(' + b.toFixed(2) + 'px)';
        }
        let W = 0, H = 0, DPR = 1;
        let stars = [], meteors = [], clouds = [], nebulaLayer = null, starSprite = null;

        function hexA(hex, a){
            const n = parseInt(hex.slice(1), 16);
            return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
        }
        // 一顆「模糊發光星」預繪成 sprite：之後只縮放/改透明度貼上，省掉每幀 filter/漸層
        function makeStarSprite(){
            const S = 46, c = S / 2;
            const oc = document.createElement('canvas'); oc.width = S; oc.height = S;
            const x = oc.getContext('2d');
            const g = x.createRadialGradient(c, c, 0, c, c, c);
            g.addColorStop(0, 'rgba(212,226,255,0.5)');
            g.addColorStop(0.5, 'rgba(212,226,255,0.12)');
            g.addColorStop(1, 'rgba(212,226,255,0)');
            x.fillStyle = g; x.beginPath(); x.arc(c, c, c, 0, Math.PI*2); x.fill();
            x.filter = 'blur(1.1px)';
            x.fillStyle = 'rgba(255,255,255,0.95)';
            x.beginPath();
            const pts = 8, R = c * 0.42, inner = R * 0.34;
            for (let i = 0; i < pts*2; i++){
                const rr = (i%2===0) ? R : inner;
                const a = i * Math.PI / pts - Math.PI/2;
                const px = c + Math.cos(a)*rr, py = c + Math.sin(a)*rr;
                i===0 ? x.moveTo(px,py) : x.lineTo(px,py);
            }
            x.closePath(); x.fill(); x.filter = 'none';
            return oc;
        }
        // 深紫星雲：預繪成一張離屏，之後每幀只 drawImage（不再每幀重算 6 個大漸層）
        function buildNebula(){
            const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
            const x = oc.getContext('2d');
            const cols = ['#3A1D6E', '#2A1458', '#4A2170', '#1E1246'];
            for (let i = 0; i < 6; i++){
                const cx = Math.random()*W, cy = Math.random()*H*0.9, R = (0.25+Math.random()*0.35)*Math.max(W,H);
                const op = 0.06 + Math.random()*0.16, col = cols[Math.floor(Math.random()*cols.length)];
                const g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
                g.addColorStop(0, hexA(col, op)); g.addColorStop(0.55, hexA(col, op*0.4)); g.addColorStop(1, hexA(col, 0));
                x.fillStyle = g; x.fillRect(cx-R, cy-R, R*2, R*2);
            }
            return oc;
        }

        // ---- 夜色雲朵 sprite：偏藍紫、非純白；離屏預繪，足夠內距避免邊緣被裁成直線 ----
        function makeCloudSprite(scale){
            const cw = 300 * scale, ch = 150 * scale;
            const pad = 90 * scale;
            const W0 = Math.round(cw + pad * 2), H0 = Math.round(ch + pad * 2);
            const oc = document.createElement('canvas');
            oc.width = W0; oc.height = H0;
            const x = oc.getContext('2d');
            const cy = pad + ch * 0.55;
            const puffs = [];
            const n = 6;
            for (let i = 0; i < n; i++){
                const f = i / (n - 1);
                const px = pad + cw * (0.10 + 0.80 * f) + (Math.random()*2-1) * cw * 0.03;
                const py = cy - Math.abs(f - 0.5) * ch * 0.16 + (Math.random()*2-1) * ch * 0.04;
                const r  = ch * (0.30 + Math.random() * 0.14);
                puffs.push([px, py, r]);
            }
            for (let i = 0; i < 3; i++){
                const px = pad + cw * (0.28 + 0.44 * Math.random());
                const py = cy - ch * (0.22 + Math.random() * 0.16);
                const r  = ch * (0.24 + Math.random() * 0.13);
                puffs.push([px, py, r]);
            }
            x.filter = 'blur(' + (scale * 2.2) + 'px)';
            for (const [px, py, r] of puffs){
                const g = x.createRadialGradient(px, py - r * 0.18, r * 0.15, px, py, r);
                // 夜色雲：微涼的藍紫白，非純白
                g.addColorStop(0, 'rgba(202,210,242,0.86)');
                g.addColorStop(0.52, 'rgba(158,166,212,0.50)');
                g.addColorStop(0.82, 'rgba(150,158,205,0.18)');
                g.addColorStop(1, 'rgba(150,158,205,0)');
                x.fillStyle = g;
                x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
            }
            x.filter = 'none';
            x.globalCompositeOperation = 'source-atop';
            // 下腹：深紫夜影
            const belly = x.createLinearGradient(0, cy - ch * 0.12, 0, cy + ch * 0.55);
            belly.addColorStop(0, 'rgba(26,14,58,0)');
            belly.addColorStop(1, 'rgba(14,7,36,0.50)');
            x.fillStyle = belly; x.fillRect(0, 0, W0, H0);
            // 上緣：淡藍月光高光
            const top = x.createLinearGradient(0, pad * 0.4, 0, cy);
            top.addColorStop(0, 'rgba(190,205,255,0.26)');
            top.addColorStop(1, 'rgba(190,205,255,0)');
            x.fillStyle = top; x.fillRect(0, 0, W0, H0);
            x.globalCompositeOperation = 'source-over';
            return oc;
        }

        function rebuild(){
            DPR = Math.min(window.devicePixelRatio || 1, 2);
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = W * DPR; canvas.height = H * DPR;
            canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

            // 星雲（預繪一張離屏）、星星 sprite（預繪一次）
            starSprite = starSprite || makeStarSprite();
            nebulaLayer = buildNebula();

            // 閃爍星星（改用 sprite，之後只縮放/改透明度貼上）
            const starCount = Math.round(40 * Math.sqrt((W * H) / (430 * 932)));
            stars = Array.from({length: starCount}, () => ({
                x: Math.random() * W,
                y: Math.random() * H * 0.62,
                phase: Math.random() * Math.PI * 2,
                speed: 0.7 + Math.random() * 1.4,
                size: 3 + Math.random() * 5           // sprite 半徑（px）
            }));

            // 流星
            meteors = Array.from({length: 4}, () => {
                const th = (25 + Math.random() * 15) * Math.PI / 180;
                return { sx: 0.45 + Math.random()*0.6, sy: -0.05 + Math.random()*0.4,
                         dx: -Math.cos(th), dy: Math.sin(th),
                         len: 0.30 + Math.random()*0.22, period: 7 + Math.random()*8,
                         phase: Math.random(), size: 0.8 + Math.random()*0.8 };
            });

            // 夜色雲朵
            const cloudN = Math.max(4, Math.round(5 * Math.sqrt(W / 900)));
            clouds = [];
            for (let i = 0; i < cloudN; i++){
                const depth = Math.random();
                const scale = (0.85 + depth * 1.25) * Math.max(0.75, W / 1050);   // 更大
                const sprite = makeCloudSprite(scale);
                clouds.push({
                    sprite, hw: sprite.width / 2,
                    y: H * (0.78 + Math.random() * 0.20),                           // 壓低到畫面下方
                    x: Math.random() * (W + sprite.width) - sprite.width / 2,
                    speed: 6 + depth * 15,
                    bob: Math.random() * Math.PI * 2,
                    opacity: 0.38 + depth * 0.32                                    // 濃度收斂一點
                });
            }
        }

        function drawStars(t){
            for (const s of stars){
                const tw = (Math.sin(t * s.speed + s.phase) + 1) / 2;
                const sz = s.size * (0.7 + 0.6 * tw);
                ctx.globalAlpha = 0.22 + 0.6 * tw;
                ctx.drawImage(starSprite, s.x - sz, s.y - sz, sz * 2, sz * 2);
            }
            ctx.globalAlpha = 1;
        }

        function drawMeteors(t){
            const minD = Math.min(W, H), vis = 0.09;
            for (const m of meteors){
                let u = ((t / m.period + m.phase) % 1 + 1) % 1;
                if (u >= vis) continue;
                const p = u / vis, env = Math.sin(p * Math.PI);
                const travel = p * m.len * minD;
                const hx = m.sx * W + m.dx * travel, hy = m.sy * H + m.dy * travel;
                const tail = 0.11 * minD * m.size * (0.6 + 0.4 * env);
                const tx = hx - m.dx * tail, ty = hy - m.dy * tail;
                const grad = ctx.createLinearGradient(tx, ty, hx, hy);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,' + (0.9 * env) + ')');
                ctx.strokeStyle = grad; ctx.lineWidth = 1.4 * m.size; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,' + env + ')';
                ctx.beginPath(); ctx.arc(hx, hy, 1.5 * m.size, 0, Math.PI * 2); ctx.fill();
            }
        }

        function drawClouds(t){
            for (const c of clouds){
                const span = W + c.sprite.width;
                const x = (((c.x + c.speed * t) % span) + span) % span - c.sprite.width / 2;
                const y = c.y + Math.sin(t * 0.25 + c.bob) * 10;
                ctx.globalAlpha = c.opacity;
                ctx.drawImage(c.sprite, x - c.hw, y - c.sprite.height / 2);
            }
            ctx.globalAlpha = 1;
        }

        // 淡色文字（英/開源標題、版權）：雲飄到底下時切深色
        let dimTargets = [];
        function refreshTargets(){ dimTargets = Array.from(document.querySelectorAll('.lang-title, .footer > span')).map(function(el){ return { el: el, rect: el.getBoundingClientRect() }; }); }
        function checkClouds(t){
            if (!dimTargets.length) return;
            for (const dt of dimTargets){
                const el = dt.el, r = dt.rect;
                let lit = false;
                for (const c of clouds){
                    const span = W + c.sprite.width;
                    const cx = (((c.x + c.speed * t) % span) + span) % span - c.sprite.width / 2;
                    const cy = c.y + Math.sin(t * 0.25 + c.bob) * 10;
                    const hw = c.sprite.width * 0.34, hh = c.sprite.height * 0.28;
                    if (cx + hw > r.left && cx - hw < r.right && cy + hh > r.top && cy - hh < r.bottom){ lit = true; break; }
                }
                el.classList.toggle('on-cloud', lit);
            }
        }

        let fc = 0;
        function frame(now){
            const t = now / 1000;
            ctx.clearRect(0, 0, W, H);
            if (nebulaLayer) ctx.drawImage(nebulaLayer, 0, 0, W, H);
            drawStars(t);
            drawMeteors(t);
            drawClouds(t);
            if ((fc++ % 8) === 0) checkClouds(t);   // 每 8 幀偵測一次，省效能
            if ((fc % 5) === 0) updateMoonBlur(t);  // 月亮模糊平滑更新
            if (!reduce) raf = requestAnimationFrame(frame);
        }

        let raf = null;
        function start(){ if (raf) cancelAnimationFrame(raf); rebuild(); refreshTargets(); if (reduce){ frame(0); } else { raf = requestAnimationFrame(frame); } }

        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(start, 180); });
        window.__skyRefresh = refreshTargets;
        start();
    })();
    
})();


/* ============ 卡片互動（可重綁）＋ 微型無縫換頁 router ＋ 常駐 BGM ============ */
(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- 換頁淡入淡出樣式 --- */
  var st = document.createElement('style');
  st.textContent = '#swup{transition:opacity .16s ease} #swup.swup-fade{opacity:0}';
  document.head.appendChild(st);

  /* --- 卡片：邊框柔光跟游標；首頁(data-home)再加 2.5D 傾斜 --- */
  var tiltOn = false, rect = null;
  function bindCard(){
    var card = document.getElementById('swup');
    if(!card || card.__bound) return; card.__bound = true;
    function refreshRect(){ rect = card.getBoundingClientRect(); }
    window.addEventListener('resize', refreshRect);
    window.addEventListener('scroll', refreshRect, {passive:true});
    card.addEventListener('pointerenter', refreshRect);
    card.addEventListener('pointermove', function(e){
      if(!rect) refreshRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      card.style.setProperty('--mx', mx + 'px');
      card.style.setProperty('--my', my + 'px');
      if(tiltOn && !reduce){
        var rotX = (my/rect.height - 0.5) * 8;
        var rotY = (0.5 - mx/rect.width) * 8;
        card.style.transform = 'perspective(1100px) rotateX('+rotX.toFixed(2)+'deg) rotateY('+rotY.toFixed(2)+'deg)';
      }
    });
    card.addEventListener('pointerleave', function(){ if(tiltOn) card.style.transform=''; });
  }

  /* --- scrolltop（.cbody 每次換頁都是新元素，需重綁）--- */
  function bindScrollTop(){
    var cb = document.querySelector('#swup .cbody'), bt = document.querySelector('#swup .scrolltop');
    if(!cb || !bt) return;
    if(cb.__st) return; cb.__st = true;
    cb.addEventListener('scroll', function(){ bt.classList.toggle('show', cb.scrollTop>200); }, {passive:true});
    bt.addEventListener('click', function(){ cb.scrollTo({top:0, behavior:'smooth'}); });
  }

  /* --- 每次換頁後重新初始化卡片相關 --- */
  function initCard(){
    var card = document.getElementById('swup');
    tiltOn = !!(card && card.hasAttribute('data-home'));
    if(!tiltOn && card) card.style.transform = '';
    bindScrollTop();
    if(window.__skyRefresh){ try{ window.__skyRefresh(); }catch(e){} }
  }
  window.__initCard = initCard;

  /* --- 換頁後重新執行「頁面專屬」inline script（FAQ/表單），跳過 src 與共用 --- */
  function runPageScripts(doc){
    var list = doc.querySelectorAll('script:not([src])');
    for(var i=0;i<list.length;i++){
      var t = list[i].textContent || '';
      if(t.indexOf("getElementById('sky')")>-1) continue;   // 保險：不重跑 canvas
      if(!t.trim()) continue;
      var el = document.createElement('script'); el.textContent = t;
      document.body.appendChild(el); el.remove();
    }
  }

  /* --- 微型 router --- */
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  var busy = false;
  async function navigate(url, push){
    if(busy){ location.href = url; return; }
    busy = true;
    try{
      var res = await fetch(url, {headers:{'X-Requested-With':'swup'}, credentials:'same-origin'});
      if(!res.ok) throw new Error('http');
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var next = doc.getElementById('swup');
      var cur = document.getElementById('swup');
      if(!next || !cur) throw new Error('no-container');
      cur.classList.add('swup-fade');
      await wait(reduce ? 0 : 150);
      cur.innerHTML = next.innerHTML;
      // 連同該頁專屬 <style> 一起換（每頁 CSS 不同，否則跨頁注入的內容會缺樣式破版）
      var ncss = doc.getElementById('pagecss'), ccss = document.getElementById('pagecss');
      if(ncss && ccss && ccss.textContent !== ncss.textContent) ccss.textContent = ncss.textContent;
      if(next.hasAttribute('data-home')) cur.setAttribute('data-home',''); else cur.removeAttribute('data-home');
      if(doc.title) document.title = doc.title;
      if(push) history.pushState({url:url}, '', url);
      window.scrollTo(0,0);
      initCard();
      runPageScripts(doc);
      cur.classList.remove('swup-fade');
      busy = false;
    }catch(e){
      busy = false;
      location.href = url;   // 任何錯誤 → 正常整頁跳轉（永不卡死）
    }
  }

  function samePage(u){ return u.pathname===location.pathname && u.search===location.search; }
  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a');
    if(!a) return;
    var href = a.getAttribute('href');
    if(!href || a.target==='_blank' || a.hasAttribute('download')) return;
    if(/^(mailto:|tel:|#)/.test(href)) return;
    var u;
    try{ u = new URL(href, location.href); }catch(_){ return; }
    if(u.origin !== location.origin) return;
    if(!/\.html$/.test(u.pathname)) return;               // 只接管站內 .html
    if(samePage(u) && u.hash) return;                     // 同頁錨點交給瀏覽器
    e.preventDefault();
    if(samePage(u)) return;
    navigate(u.href, true);
  });
  window.addEventListener('popstate', function(){ navigate(location.href, false); });

  /* --- 常駐 BGM 播放器 --- */
  function initBGM(){
    var audio = document.getElementById('bgm-audio');
    var btn = document.getElementById('bgm-btn');
    if(!audio || !btn) return;
    function setUI(playing){
      btn.classList.toggle('playing', playing);
      btn.setAttribute('aria-label', playing ? '暫停背景音樂' : '播放背景音樂');
      btn.setAttribute('title', playing ? '暫停背景音樂' : '播放背景音樂');
    }
    function play(){
      var p = audio.play();
      if(p && p.then){ p.then(function(){ setUI(true); sessionStorage.setItem('bgm','on'); })
                        .catch(function(){ setUI(false); }); }
    }
    function pause(){ audio.pause(); setUI(false); sessionStorage.setItem('bgm','off'); }
    btn.addEventListener('click', function(){ audio.paused ? play() : pause(); });
    audio.addEventListener('play', function(){ setUI(true); });
    audio.addEventListener('pause', function(){ setUI(false); });
    // 曾經開過 → 嘗試自動接續（可能被瀏覽器擋，擋了就維持暫停待使用者點）
    if(sessionStorage.getItem('bgm')==='on'){ play(); }
    setUI(!audio.paused);
  }

  function boot(){ bindCard(); initCard(); initBGM(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
