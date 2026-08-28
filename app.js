    /* ================= Color conversions ================= */
    const clamp01=(v)=>Math.min(1,Math.max(0,v)), D=Math.PI/180, CMAX=0.4;
    const toLin=(c)=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
    const toGam=(c)=>c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;
    const hexToLin=(hex)=>{const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255].map(v=>toLin(v/255));};
    const linToHex=(lin)=>'#'+lin.map(v=>Math.round(clamp01(toGam(v))*255).toString(16).padStart(2,'0')).join('');
    // "<srcColor> at <alpha>" as a translucent CSS background (browser composites it over --bg in sRGB —
    // exactly the naive-opacity method). Keeps the DOM readable: shows the referenced color + transparency.
    const rgbaStr=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgb(${n>>16&255} ${n>>8&255} ${n&255} / ${(a*100).toFixed(1)}%)`;};
    const lumOf=([r,g,b])=>0.2126*r+0.7152*g+0.0722*b;
    const contrast=(a,b)=>{const hi=Math.max(a,b)+0.05,lo=Math.min(a,b)+0.05;return hi/lo;};
    const linToOklab=([r,g,b])=>{const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),
      m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
      return[0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,
             0.0259040371*l+0.7827717662*m-0.808675766*s];};
    const oklabToLin=([L,a,b])=>{const l=(L+0.3963377774*a+0.2158037573*b)**3,
      m=(L-0.1055613458*a-0.0638541728*b)**3,s=(L-0.0894841775*a-1.291485548*b)**3;
      return[4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,
             -0.0041960863*l-0.7034186147*m+1.707614701*s];};
    const oklchToLin=([L,C,h])=>oklabToLin([L,C*Math.cos(h*D),C*Math.sin(h*D)]);
    const linToOklch=(lin)=>{const[L,a,b]=linToOklab(lin);return[L,Math.hypot(a,b),(Math.atan2(b,a)/D+360)%360];};
    const deltaEOK=(l1,l2)=>{const a=linToOklab(l1),b=linToOklab(l2);return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);};
    const lerpHue=(h0,h1,f)=>{let d=((h1-h0)%360+540)%360-180;return h0+d*f;};
    const inGamut=(lin)=>lin.every(v=>v>=-0.001&&v<=1.001);
    function gamutClamp(L,C,h){ let lin=oklchToLin([L,C,h]); if(inGamut(lin)) return lin.map(clamp01);
      let lo=0,hi=C; for(let k=0;k<22;k++){const m=(lo+hi)/2; inGamut(oklchToLin([L,m,h]))?lo=m:hi=m;}
      return oklchToLin([L,lo,h]).map(clamp01); }

    /* ================= Scale ramp + anchors ================= */
    const STOPS=33, Llo=0.03, Lhi=0.985;
    // A scale whose peak chroma is below this (% of CMAX) is treated as neutral/monochrome:
    // there's no hue to preserve, so its dynamic source is pinned to the pure white/black end
    // (extremity e=1) — a clean scrim rather than a faded mid-gray. Authoring-time property.
    const NEUTRAL_C=2;
    const isNeutralScale=(scale)=>scale.stops.every(s=>s.c<NEUTRAL_C);
    const byL=(stops)=>[...stops].sort((a,b)=>a.L-b.L);
    function hcAt(stops,L){ const ss=byL(stops),n=ss.length;
      if(L<=ss[0].L) return {h:ss[0].h,c:ss[0].c};
      if(L>=ss[n-1].L) return {h:ss[n-1].h,c:ss[n-1].c};
      let i=0; while(ss[i+1].L<L) i++; const f=(L-ss[i].L)/(ss[i+1].L-ss[i].L);
      return {h:lerpHue(ss[i].h,ss[i+1].h,f), c:ss[i].c+(ss[i+1].c-ss[i].c)*f}; }
    const stopColorHex=(st)=>linToHex(gamutClamp(st.L, st.c/100*CMAX, st.h));
    function buildRamp(stops){ const out=[];
      for(let i=0;i<STOPS;i++){ const L=Llo+(Lhi-Llo)*i/(STOPS-1); const {h,c}=hcAt(stops,L);
        const lin=gamutClamp(L,c/100*CMAX,h); out.push({L,lin,lum:lumOf(lin)}); }
      out.sort((a,b)=>a.lum-b.lum); out.forEach(s=>s.hex=linToHex(s.lin)); return out; }
    // anchors: pure black + interior samples + pure white (shared by tool + export)
    function rampAnchors(ramp){ const n=ramp.length, anc=[{lum:0,lin:[0,0,0]}];
      [4,9,14,19,24,28].forEach(i=>{const c=ramp[Math.min(n-1,i)]; anc.push({lum:c.lum,lin:c.lin.slice()});});
      anc.push({lum:1,lin:[1,1,1]});
      const A=[]; anc.sort((a,b)=>a.lum-b.lum).forEach(a=>{if(!A.length||a.lum-A[A.length-1].lum>1e-4)A.push(a);}); return A; }
    function readAnchors(A,L){ L=clamp01(L); const v=[0,0,0];
      for(let ch=0;ch<3;ch++){ let s=0; for(let i=0;i<A.length-1;i++){ const sl=(A[i+1].lin[ch]-A[i].lin[ch])/((A[i+1].lum-A[i].lum)||1);
        s+=sl*(Math.min(Math.max(L,A[i].lum),A[i+1].lum)-A[i].lum);} v[ch]=s; } return v; }
    function lumToFrac(ramp,lum){ const n=ramp.length, Lc=Math.min(ramp[n-1].lum,Math.max(ramp[0].lum,lum));
      let i=0; while(i<n-2 && ramp[i+1].lum<Lc) i++; const f=(Lc-ramp[i].lum)/((ramp[i+1].lum-ramp[i].lum)||1); return (i+f)/(n-1); }

    /* ================= Generation (tool + export share this math) ================= */
    // side: 1 = darken (color darker than bg), 0 = lighten. auto crosses at WCAG's 0.1791.
    function sideDark(Lbg){ return settings.side==='dark'?1 : settings.side==='light'?0 : (Lbg>0.1791?1:0); }
    function genColors(scale, bg, T, data, sideOverride){
      const A=data.anchors, bgLin=hexToLin(bg), Lbg=lumOf(bgLin);
      const dark = sideOverride!=null ? sideOverride : sideDark(Lbg);
      const Lov=clamp01(dark ? (Lbg+0.05)/T-0.05 : T*(Lbg+0.05)-0.05);
      // Neutral scales pin the source to the pure white/black end (e=1); no chroma to preserve.
      const e=data.neutral ? 1 : clamp01(settings.extOffset + settings.extSteep*(T-1)/11);
      const Lend=1-dark;
      const Lsrc=clamp01(Lov + e*(Lend-Lov));
      const srcLin=readAnchors(A,Lsrc);
      const dn = dark ? Math.min(Lsrc-Lbg,-0.0001) : Math.max(Lsrc-Lbg,0.0001);
      const alpha=clamp01((Lov-Lbg)/dn);
      const dynLin=bgLin.map((c,k)=>alpha*srcLin[k]+(1-alpha)*c);
      const opqLin=readAnchors(A,Lov);
      const bgGam=bgLin.map(toGam), srcGam=srcLin.map(toGam);
      // Naive-opacity comparison composites in GAMMA space. Colorful sources sit mid-range where gamma≈
      // linear, so we keep the honest reuse of Dynamic's (linear) alpha — its small "miss" is the point.
      // Neutral sources are pinned to pure black/white (gamma extremes), where that reuse is wildly off,
      // so there we solve the opacity whose gamma composite actually hits the target luminance (Lov).
      let alphaT=alpha;
      if(data.neutral){ let lo=0,hi=1; for(let k=0;k<30;k++){ const m=(lo+hi)/2;
          const lum=lumOf(bgGam.map((c,j)=>toLin(m*srcGam[j]+(1-m)*c)));  // monotonic in m
          (dark ? lum>Lov : lum<Lov) ? lo=m : hi=m; }
        alphaT=(lo+hi)/2; }
      const transLin=bgGam.map((c,k)=>toLin(alphaT*srcGam[k]+(1-alphaT)*c));
      return { Lov, Lsrc, dark, alpha,
        dynamic:{lin:dynLin,hex:linToHex(dynLin),meas:contrast(lumOf(dynLin),Lbg)},
        opaque:{lin:opqLin,hex:linToHex(opqLin),meas:contrast(lumOf(opqLin),Lbg)},
        transparent:{lin:transLin,hex:linToHex(transLin),meas:contrast(lumOf(transLin),Lbg), srcHex:linToHex(srcLin), alpha:alphaT},
        dE: deltaEOK(dynLin,opqLin) };
    }
    // cache ramp/anchors per scale (rebuilt when stops change)
    function scaleData(scale){ const ramp=buildRamp(scale.stops); return {ramp, anchors:rampAnchors(ramp), neutral:isNeutralScale(scale),
      gradient:'linear-gradient(90deg,'+ramp.map((c,i)=>`${c.hex} ${(i/(ramp.length-1)*100).toFixed(1)}%`).join(',')+')'}; }

    /* ================= Defaults =================
       Single source of truth for what loads on a fresh page. Plain data only —
       edit these to change the app's starting content; ids are assigned at load.
         · background — the base surface color (the Background input).
         · scales     — hue(°)/chroma(% of max)/lightness(0–1) key stops, interpolated across lightness.
         · contrasts  — target WCAG ratios (auto-sorted, exported as --contrast-100, -200, …).
         · surfaces   — the base (from `background`) plus surface TYPES. Each type has a tint
                        `source` ('base' color, or a scale name for a hue), a `reference`
                        ('parent' = the surface it sits on, 'base' = the root — for overlays),
                        and a target `contrast` vs that reference (lighter by default; forceDark flips). */
    const DEFAULTS = {
      background: '#ffffff',
      // OKLCh (L 0–1, h °, c % of CMAX) converted from source sRGB hex (shown in comments).
      scales: [
        { name:'silver',     stops:[ {L:0, h:0, c:0} ] },   // #000000
        { name:'magenta',    stops:[ {L:0.6603, h:7.8, c:59.2}, {L:0.3981, h:10.6, c:39.8} ] },   // #ff3377 #870032
        { name:'red',        stops:[ {L:0.675, h:30.1, c:53.3}, {L:0.5779, h:30.4, c:51.1}, {L:0.3001, h:31.5, c:25.5} ] },   // #ff513d #d83220 #561107
        { name:'cinnamon',   stops:[ {L:0.5781, h:46.1, c:28.6}, {L:0.7733, h:50.7, c:22.4}, {L:0.3155, h:40.7, c:22} ] },   // #b0623b #e4a581 #551e07
        { name:'orange',     stops:[ {L:0.7736, h:65.1, c:43.4}, {L:0.7319, h:53, c:46.5}, {L:0.49, h:42.3, c:36.7} ] },   // #ff9a00 #ff8000 #a13b00
        { name:'brown',      stops:[ {L:0.8034, h:76.3, c:21}, {L:0.4893, h:76.5, c:16.9}, {L:0.3895, h:74.5, c:16.8} ] },   // #deb881 #765b32 #5a3f16
        { name:'yellow',     stops:[ {L:0.8681, h:94.1, c:44.5}, {L:0.6102, h:73.5, c:32.4} ] },   // #fad000 #b17500
        { name:'chartreuse', stops:[ {L:0.9265, h:116.7, c:32}, {L:0.8658, h:121.2, c:52.1}, {L:0.3564, h:119.8, c:21.1} ] },   // #e1f28c #bfe600 #374200
        { name:'celery',     stops:[ {L:0.8417, h:135.2, c:55}, {L:0.2761, h:135.2, c:20.2} ] },   // #86e93f #143000
        { name:'green',      stops:[ {L:0.7335, h:154.2, c:44.5}, {L:0.3528, h:165.7, c:18.4}, {L:0.9011, h:156.6, c:20} ] },   // #1ec873 #004732 #b3efc9
        { name:'seafoam',    stops:[ {L:0.9058, h:172.2, c:16.7}, {L:0.7764, h:172.9, c:36.8}, {L:0.3571, h:182.3, c:16} ] },   // #b3efdb #11d4ad #00473f
        { name:'turquoise',  stops:[ {L:0.9116, h:196.1, c:15.1}, {L:0.7495, h:205.4, c:31.6}, {L:0.3425, h:205.2, c:14.6} ] },   // #b3efef #11c4d4 #004147
        { name:'cyan',       stops:[ {L:0.9013, h:226.4, c:14.3}, {L:0.7081, h:245.8, c:40.7}, {L:0.4404, h:233.6, c:22.9} ] },   // #b7e7fc #31a8ff #005a7d
        { name:'blue',       stops:[ {L:0.7893, h:258.6, c:25.6}, {L:0.5335, h:266.7, c:59.7}, {L:0.3224, h:265.9, c:38.9}, {L:0.2409, h:268.7, c:21.8} ] },   // #92bcfc #2f56f4 #0e2581 #0f1a48
        { name:'indigo',     stops:[ {L:0.743, h:278.4, c:33.5}, {L:0.5186, h:284, c:62.7}, {L:0.3135, h:282.2, c:46.7} ] },   // #99a2ff #6339ef #2e008a
        { name:'purple',     stops:[ {L:0.4844, h:300, c:61.7}, {L:0.2799, h:299, c:37.6} ] },   // #7915d1 #360066
        { name:'fuchsia',    stops:[ {L:0.7243, h:322.1, c:61.9}, {L:0.6114, h:321.9, c:58.3}, {L:0.3176, h:319.5, c:38.2} ] },   // #ea61ff #c040d4 #510061
        { name:'pink',       stops:[ {L:0.7274, h:343.2, c:55}, {L:0.6254, h:347.5, c:57.8}, {L:0.3245, h:350.4, c:33.8} ] },   // #ff61ca #e232a1 #61003d
        { name:'wireframe',  stops:[ {L:0.5521, h:264.1, c:34.4} ] },   // #486ec2
      ],
      contrasts: [1.06, 1.15, 1.32, 1.6, 2, 2.6, 3.22, 3.95, 4.79, 6.29, 7.9, 10, 12.3, 14.8, 17, 19.5],
      surfaces: [
        { name:'bg', base:true },
        { name:'raised',  source:'base', reference:'parent', contrast:1.1,  forceDark:false, expanded:false },
        { name:'overlay', source:'base', reference:'base',   contrast:1.6,  forceDark:false, expanded:false },
        { name:'info',    source:'blue', reference:'parent', contrast:1.15, forceDark:false, expanded:false },
        { name:'error',   source:'red',  reference:'parent', contrast:1.15, forceDark:false, expanded:false },
      ],
      // Extremity curve (global source-picking): how extreme the faded source is per contrast.
      extOffset: 0.36,   // base offset toward the light/dark end (0–1)
      extSteep: -1,      // how offset scales with contrast (−1…1)
    };

    /* ================= State ================= */
    const background=()=>els.bg.value;
    let nextStopId=100, nextScaleId=1, nextContrastId=1, nextSurfaceId=1;
    // Hydrate the editable live state from DEFAULTS, stamping unique ids as we go.
    let scales=DEFAULTS.scales.map(sc=>({ id:nextScaleId++, name:sc.name,
      stops:sc.stops.map(st=>({ id:nextStopId++, L:st.L, h:st.h, c:st.c })) }));
    let contrasts=DEFAULTS.contrasts.map(v=>({ id:nextContrastId++, value:v }));
    let surfaces=DEFAULTS.surfaces.map(s=> s.base
      ? { id:nextSurfaceId++, name:s.name, base:true }
      : { id:nextSurfaceId++, name:s.name, source:s.source||'base', reference:s.reference||'parent',
          contrast:s.contrast, forceDark:!!s.forceDark, expanded:!!s.expanded, previewRole:s.previewRole||'auto',
          showInPreview:s.showInPreview!==false });
    let settings={ side:'auto', extOffset:DEFAULTS.extOffset, extSteep:DEFAULTS.extSteep, guardThreshold:0.10 };
    let ui={ tab:'contrast', mainTab:'ramps', selectedScaleId:scales[0].id, selectedStopId:null, previewScaleId:scales[0].id,
             activeContrastId:contrasts[0].id, rampSurfaceId:surfaces[0].id, dragging:null, exportOpen:false,
             nestDepth:2, showMeta:false };
    // Preview role: how a surface appears in the Contextual-evaluation tree. Auto-derives from its
    // config (base-relative → once; parent+base tint → nests in itself; parent+scale tint → applied
    // on each context), overridable per surface.
    const derivedRole=(surf)=> surf.reference==='base' ? 'once' : (surf.source==='base' ? 'nest' : 'applied');
    const roleOf=(surf)=> surf.base ? 'base' : (!surf.previewRole||surf.previewRole==='auto' ? derivedRole(surf) : surf.previewRole);
    ui.selectedStopId = byL(scales[0].stops)[byL(scales[0].stops).length-1].id;

    const sortContrasts=()=>[...contrasts].sort((a,b)=>a.value-b.value);
    const contrastName=(c)=>{ const i=sortContrasts().findIndex(x=>x.id===c.id); return `--contrast-${(i+1)*100}`; };
    const getScale=(id)=>scales.find(s=>s.id===id);
    const getSel=()=>getScale(ui.selectedScaleId)||scales[0];
    const getSelStop=()=>{ const s=getSel(); return s.stops.find(t=>t.id===ui.selectedStopId)||s.stops[0]; };
    const activeContrast=()=>contrasts.find(c=>c.id===ui.activeContrastId)||sortContrasts()[0];
    const sanitize=(s)=>(s||'').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'')||'color';
    // Surface color: a target contrast vs a REFERENCE (its parent surface, or the base for
    // overlays), tinted from a SOURCE (the reference color itself, or a scale for a hue).
    // Lighter by default; swaps darker when the light side caps (or forceDark). Works in LINEAR
    // (not through rounded hex) so it matches the exact-chaining exported CSS.
    const surfaceGoLight=(surf,Lp)=>!surf.forceDark && surf.contrast<=1.05/(Lp+0.05);
    function deriveSurfaceLin(surf, refLin){                 // base-color tint: retint refLin, keep hue
      const C=surf.contrast, Lp=lumOf(refLin);
      if(surfaceGoLight(surf,Lp)){                            // lighten toward the hue's BRIGHT form (not white)
        const maxc=Math.max(refLin[0],refLin[1],refLin[2],1e-6);
        const Lt=C*(Lp+0.05)-0.05, a=clamp01((Lt-Lp)/Math.max(Lp/maxc-Lp,1e-6));
        return refLin.map(k=>clamp01(k + a*(k/maxc - k)));
      }
      const Lt=(Lp+0.05)/C-0.05, f=Lt/Math.max(Lp,1e-6);     // darken toward black (scale channels)
      return refLin.map(k=>clamp01(f*k));
    }
    // Resolve a surface's color given the linear color of the surface it is nested inside.
    function surfaceLin(surf, parentLin){
      if(surf.base) return hexToLin(background());
      const refLin = surf.reference==='base' ? hexToLin(background()) : parentLin;
      if(surf.source==='base') return deriveSurfaceLin(surf, refLin);
      const scale = scales.find(s=>s.name===surf.source);     // scale tint: the scale's dynamic color at C over ref
      if(!scale) return deriveSurfaceLin(surf, refLin);        // dangling scale name → fall back to base tint
      const dark = surfaceGoLight(surf, lumOf(refLin)) ? 0 : 1;
      return genColors(scale, linToHex(refLin), surf.contrast, scaleData(scale), dark).dynamic.lin;
    }
    // Representative color for lists/pickers: the surface evaluated directly on the base.
    const surfaceColor=(surf)=>linToHex(surfaceLin(surf, hexToLin(background())));
    const getSurface=(id)=>surfaces.find(s=>s.id===id)||surfaces[0];

    /* ================= Elements ================= */
    const els={}; ['bg','bgVal','tabs','tabContrast','tabScales','tabSurfaces','contrastList','addContrast',
      'side','eOffset','eOffsetVal','eSteep','eSteepVal','scaleList','addScale','scaleEditor',
      'surfaceList','addSurface','rampSurface',
      'exportBtn','exportOut','stage','maintabs','mtabRamps','mtabEval','preview','palette','detail','tOpaque','tTransparent','tValues','tOpacity']
      .forEach(id=>els[id]=document.getElementById(id));
    els.bg.value = DEFAULTS.background;   // JSON drives the initial Background (not the HTML value)

    /* ================= Left panel: tabs ================= */
    [...els.tabs.children].forEach(b=>b.onclick=()=>{ ui.tab=b.dataset.tab; syncTabs(); rebuildScaleList(); rebuildScaleEditor(); refresh(); });
    function syncTabs(){
      [...els.tabs.children].forEach(b=>b.setAttribute('aria-pressed', b.dataset.tab===ui.tab));
      els.tabContrast.hidden = ui.tab!=='contrast';
      els.tabScales.hidden   = ui.tab!=='scales';
      els.tabSurfaces.hidden = ui.tab!=='surfaces';
    }

    /* ---- Main area: its own tabs (independent of the left panel) ---- */
    [...els.maintabs.children].forEach(b=>b.onclick=()=>{ ui.mainTab=b.dataset.mtab; syncMainTabs(); refresh(); });
    function syncMainTabs(){
      [...els.maintabs.children].forEach(b=>b.setAttribute('aria-pressed', b.dataset.mtab===ui.mainTab));
      els.mtabRamps.hidden = ui.mainTab!=='ramps';
      els.mtabEval.hidden  = ui.mainTab!=='eval';   // the detail section lives inside the eval tab
    }

    /* ================= Contrast swatches ================= */
    function rebuildContrastList(){
      const sorted=sortContrasts();
      els.contrastList.innerHTML='';
      sorted.forEach(c=>{
        const row=document.createElement('div'); row.className='crow'+(c.id===ui.activeContrastId?' active':''); row.dataset.id=c.id;
        row.innerHTML=`<div class="crow-top"><span class="clabel"></span>
          <span class="cval">${c.value.toFixed(2)}</span>
          <button class="mini del" title="Delete">✕</button></div>
          <input type="range" min="1" max="21" step="0.01" value="${c.value}">`;
        const slider=row.querySelector('input');
        slider.oninput=()=>{ c.value=parseFloat(slider.value); ui.activeContrastId=c.id;
          row.querySelector('.cval').textContent=c.value.toFixed(2); markActiveRow(); refresh(); };
        slider.onchange=()=>{ rebuildContrastList(); refresh(); };
        slider.onpointerdown=()=>{ ui.activeContrastId=c.id; markActiveRow(); refresh(); };
        row.querySelector('.del').onclick=()=>{ if(contrasts.length<=1) return;
          contrasts=contrasts.filter(x=>x.id!==c.id);
          if(ui.activeContrastId===c.id) ui.activeContrastId=sortContrasts()[0].id;
          rebuildContrastList(); refresh(); };
        els.contrastList.appendChild(row);
      });
      updateContrastLabels();
      [...els.contrastList.querySelectorAll('.del')].forEach(b=>b.disabled=contrasts.length<=1);
    }
    function updateContrastLabels(){ sortContrasts().forEach((c,i)=>{
      const row=els.contrastList.querySelector(`.crow[data-id="${c.id}"]`);
      if(row) row.querySelector('.clabel').textContent=`--contrast-${(i+1)*100}`; }); }
    function markActiveRow(){ [...els.contrastList.children].forEach(r=>r.classList.toggle('active', +r.dataset.id===ui.activeContrastId)); }
    els.addContrast.onclick=()=>{ const c={id:nextContrastId++, value:4.5}; contrasts.push(c); ui.activeContrastId=c.id;
      rebuildContrastList(); refresh(); };

    /* ================= Global settings ================= */
    els.side.onchange=()=>{ settings.side=els.side.value; refresh(); };
    els.eOffset.oninput=()=>{ settings.extOffset=parseFloat(els.eOffset.value); els.eOffsetVal.textContent=settings.extOffset.toFixed(2); refresh(); };
    els.eSteep.oninput =()=>{ settings.extSteep=parseFloat(els.eSteep.value);
      els.eSteepVal.textContent=(settings.extSteep>=0?'+':'−')+Math.abs(settings.extSteep).toFixed(2); refresh(); };

    /* ================= Surfaces ================= */
    function rebuildSurfaceList(){
      els.surfaceList.innerHTML='';
      surfaces.forEach(surf=>{
        const col=surfaceColor(surf);
        const row=document.createElement('div'); row.className='surfrow'; row.dataset.id=surf.id;
        const srcOpts=`<option value="base"${surf.source==='base'?' selected':''}>Base color</option>`
          + scales.map(s=>`<option value="${s.name}"${surf.source===s.name?' selected':''}>--${s.name}</option>`).join('');
        row.innerHTML=`<div class="schip" style="background:${col}"></div>
          <input type="text" class="sfname" value="${surf.name}" spellcheck="false" autocomplete="off">
          ${surf.base ? `<span class="sfbase">base</span>`
            : `<button class="mini del" title="Delete">✕</button>
               <label class="sfctl sfsrc">Tint <select class="sfSrc">${srcOpts}</select></label>
               <label class="sfctl sfref">vs <select class="sfRef"><option value="parent"${surf.reference==='parent'?' selected':''}>parent</option><option value="base"${surf.reference==='base'?' selected':''}>base</option></select></label>
               <label class="sfctl sfref">preview <select class="sfRole">
                 <option value="auto"${(surf.previewRole||'auto')==='auto'?' selected':''}>auto (${derivedRole(surf)})</option>
                 <option value="nest"${surf.previewRole==='nest'?' selected':''}>nests in itself</option>
                 <option value="applied"${surf.previewRole==='applied'?' selected':''}>applied on each</option>
                 <option value="once"${surf.previewRole==='once'?' selected':''}>once on base</option>
                 <option value="hidden"${surf.previewRole==='hidden'?' selected':''}>hidden</option></select></label>
               <label class="sfctl">Contrast <input type="range" class="sfC" min="1" max="${surf.expanded?12:3}" step="0.01" value="${surf.contrast}"><span class="sfCval">${surf.contrast.toFixed(2)}:1</span></label>
               <label class="sfforce"><input type="checkbox" class="sfP"${surf.showInPreview!==false?' checked':''}> show in preview</label>
               <label class="sfforce"><input type="checkbox" class="sfF"${surf.forceDark?' checked':''}> force darker</label>
               <label class="sfforce sfexp"><input type="checkbox" class="sfX"${surf.expanded?' checked':''}> expanded contrast range</label>`}`;
        const name=row.querySelector('.sfname');
        name.oninput=()=>{ surf.name=name.value; refresh(); };
        name.onchange=()=>{ surf.name=sanitize(name.value); name.value=surf.name; rebuildSurfaceList(); rebuildRampPicker(); refresh(); };
        if(!surf.base){
          const cI=row.querySelector('.sfC'), cV=row.querySelector('.sfCval'), fI=row.querySelector('.sfF'), xI=row.querySelector('.sfX');
          row.querySelector('.sfSrc').onchange=e=>{ surf.source=e.target.value; rebuildSurfaceList(); refresh(); };
          row.querySelector('.sfRef').onchange=e=>{ surf.reference=e.target.value; rebuildSurfaceList(); refresh(); };
          row.querySelector('.sfRole').onchange=e=>{ surf.previewRole=e.target.value; refresh(); };
          row.querySelector('.sfP').onchange=e=>{ surf.showInPreview=e.target.checked; refresh(); };
          cI.oninput=()=>{ surf.contrast=parseFloat(cI.value); cV.textContent=surf.contrast.toFixed(2)+':1'; refresh(); };
          fI.onchange=()=>{ surf.forceDark=fI.checked; refresh(); };
          xI.onchange=()=>{ surf.expanded=xI.checked; cI.max=surf.expanded?12:3;
            if(!surf.expanded && surf.contrast>3){ surf.contrast=3; cI.value=3; cV.textContent='3.00:1'; } refresh(); };
          row.querySelector('.del').onclick=()=>{ surfaces=surfaces.filter(s=>s.id!==surf.id);
            if(ui.rampSurfaceId===surf.id) ui.rampSurfaceId=surfaces[0].id;
            rebuildSurfaceList(); rebuildRampPicker(); refresh(); };
        }
        els.surfaceList.appendChild(row);
      });
    }
    els.addSurface.onclick=()=>{ const s={id:nextSurfaceId++, name:sanitize('surface-'+surfaces.length),
        source:'base', reference:'parent', contrast:1.2, forceDark:false, expanded:false, previewRole:'auto', showInPreview:true};
      surfaces.push(s); rebuildSurfaceList(); rebuildRampPicker(); refresh(); };
    function rebuildRampPicker(){ els.rampSurface.innerHTML=surfaces.map(s=>
      `<option value="${s.id}"${s.id===ui.rampSurfaceId?' selected':''}>--${s.name}</option>`).join(''); }
    els.rampSurface.onchange=()=>{ ui.rampSurfaceId=+els.rampSurface.value; refresh(); };
    function refreshSurfaceChips(){ surfaces.forEach(surf=>{ const row=els.surfaceList.querySelector(`.surfrow[data-id="${surf.id}"]`);
      if(row) row.querySelector('.schip').style.background=surfaceColor(surf); }); }

    /* ================= Color scales list ================= */
    function rebuildScaleList(){
      els.scaleList.innerHTML='';
      scales.forEach(sc=>{
        const d=scaleData(sc);
        const row=document.createElement('div'); row.className='srow'+(sc.id===ui.selectedScaleId?' sel':'');
        row.innerHTML=`<div class="sbar" style="background:${d.gradient}"></div>
          <span class="sname">--${sc.name}</span>
          <button class="mini del" title="Delete / grayscale">✕</button>`;
        row.querySelector('.sbar').onclick=()=>selectScale(sc.id);
        row.querySelector('.sname').onclick=()=>selectScale(sc.id);
        row.querySelector('.del').onclick=()=>deleteScale(sc.id);
        els.scaleList.appendChild(row);
      });
    }
    function selectScale(id){ ui.selectedScaleId=id; ui.previewScaleId=id; const s=getScale(id); // sync eval view to the edited scale
      const bl=byL(s.stops); ui.selectedStopId=bl[bl.length-1].id; rebuildScaleList(); rebuildScaleEditor(); refresh(); }
    els.addScale.onclick=()=>{ // start empty: a single grayscale stop (chroma 0), user adds hue/chroma
      const s={id:nextScaleId++, name:sanitize('color'+(scales.length+1)),
        stops:[{id:nextStopId++, L:0.5, h:0, c:0}] };
      scales.push(s); selectScale(s.id); };
    function deleteScale(id){
      if(scales.length>1){ scales=scales.filter(s=>s.id!==id);
        if(ui.selectedScaleId===id) ui.selectedScaleId=scales[0].id;
        if(ui.previewScaleId===id) ui.previewScaleId=scales[0].id;
        const bl=byL(getSel().stops); ui.selectedStopId=bl[bl.length-1].id;
      } else { // last scale → reset to a single default gray stop (name kept)
        scales[0].stops=[{id:nextStopId++, L:0.5, h:0, c:0}]; ui.selectedStopId=scales[0].stops[0].id;
      }
      rebuildScaleList(); rebuildScaleEditor(); refresh();
    }

    /* ================= Selected-scale editor (gradient + stops) ================= */
    function rebuildScaleEditor(){
      if(ui.tab!=='scales'){ els.scaleEditor.innerHTML=''; return; }
      const sc=getSel(), st=getSelStop();
      els.scaleEditor.innerHTML=`
        <hr>
        <div class="field"><label for="scaleName">Color name <span class="val" id="scaleNameVal">--${sc.name}</span></label>
          <input type="text" id="scaleName" value="${sc.name}" spellcheck="false" autocomplete="off"></div>
        <label class="editlabel">Hue &amp; chroma across lightness</label>
        <p class="gradhint">Drag a stop to move it; click to edit; double-click the bar to add.</p>
        <div class="grad" id="grad"><div class="bar" id="gradBar"></div></div>
        <div class="stopEditor">
          <div class="field"><label for="stopColor">Stop color <span class="val hint">sRGB picker</span></label>
            <input type="color" id="stopColor"></div>
          <div class="field"><label>Stop hue <span class="val" id="sHueVal"></span></label>
            <input type="range" id="sHue" min="0" max="360" step="1"></div>
          <div class="field"><label>Stop chroma <span class="val" id="sChromaVal"></span></label>
            <input type="range" id="sChroma" min="0" max="100" step="1"></div>
          <div class="field"><label>Stop lightness <span class="val" id="sLightVal"></span></label>
            <input type="range" id="sLight" min="2" max="99" step="1"></div>
          <div class="row"><button id="addStop">+ Add stop</button><button id="delStop">− Delete stop</button></div>
        </div>`;
      const grad=els.scaleEditor.querySelector('#grad');
      const sHue=els.scaleEditor.querySelector('#sHue'), sChroma=els.scaleEditor.querySelector('#sChroma'), sLight=els.scaleEditor.querySelector('#sLight');
      const stopColor=els.scaleEditor.querySelector('#stopColor');
      const hueVal=els.scaleEditor.querySelector('#sHueVal'), chromaVal=els.scaleEditor.querySelector('#sChromaVal'), lightVal=els.scaleEditor.querySelector('#sLightVal');
      // The picker + the three sliders + their labels are all views of one stop state.
      // syncInputs pushes the stop's state to every control (used on select/drag/picker);
      // the per-slider handlers below only touch the label + picker they don't own, so
      // dragging a slider never resets the control the user is actively holding.
      const syncInputs=()=>{ const s=getSelStop();
        sHue.value=Math.round(s.h); sChroma.value=Math.round(s.c); sLight.value=Math.round(s.L*100);
        hueVal.textContent=Math.round(s.h)+'°'; chromaVal.textContent=Math.round(s.c)+'%'; lightVal.textContent=Math.round(s.L*100)+'%';
        stopColor.value=stopColorHex(s); };
      syncInputs();
      const nameInput=els.scaleEditor.querySelector('#scaleName'), nameVal=els.scaleEditor.querySelector('#scaleNameVal');
      nameInput.oninput=()=>{ getSel().name=nameInput.value; nameVal.textContent='--'+nameInput.value; rebuildScaleList(); refresh(); };
      nameInput.onchange=()=>{ const s=sanitize(nameInput.value); getSel().name=s; nameInput.value=s; nameVal.textContent='--'+s; rebuildScaleList(); refresh(); };
      sHue.oninput=()=>{ const s=getSelStop(); s.h=+sHue.value; hueVal.textContent=Math.round(s.h)+'°'; stopColor.value=stopColorHex(s); scheduleRefresh(); };
      sChroma.oninput=()=>{ const s=getSelStop(); s.c=+sChroma.value; chromaVal.textContent=Math.round(s.c)+'%'; stopColor.value=stopColorHex(s); scheduleRefresh(); };
      sLight.oninput=()=>{ const s=getSelStop(); s.L=clamp01(+sLight.value/100); lightVal.textContent=Math.round(s.L*100)+'%'; stopColor.value=stopColorHex(s); scheduleRefresh(); };
      // sRGB picker -> OKLCh: convert the picked color and drive the sliders from it.
      stopColor.oninput=()=>{ const s=getSelStop(); const [L,C,h]=linToOklch(hexToLin(stopColor.value));
        s.L=clamp01(L); s.c=clamp01(C/CMAX)*100; if(C>1e-4) s.h=(h%360+360)%360; // keep hue for grays (chroma≈0 → hue undefined)
        sHue.value=Math.round(s.h); sChroma.value=Math.round(s.c); sLight.value=Math.round(s.L*100);
        hueVal.textContent=Math.round(s.h)+'°'; chromaVal.textContent=Math.round(s.c)+'%'; lightVal.textContent=Math.round(s.L*100)+'%';
        scheduleRefresh(); };
      els.scaleEditor.querySelector('#addStop').onclick=()=>{ const sc=getSel();
        const pts=[Llo,...byL(sc.stops).map(s=>s.L),Lhi]; let gap=-1,at=0.5;
        for(let i=0;i<pts.length-1;i++){const g=pts[i+1]-pts[i]; if(g>gap){gap=g; at=(pts[i]+pts[i+1])/2;}}
        const {h,c}=hcAt(sc.stops,at); const s={id:nextStopId++,L:at,h:Math.round(h),c:Math.round(c)};
        sc.stops.push(s); ui.selectedStopId=s.id; rebuildScaleEditor(); refresh(); };
      els.scaleEditor.querySelector('#delStop').onclick=()=>{ const sc=getSel(); if(sc.stops.length<=1) return;
        sc.stops=sc.stops.filter(s=>s.id!==ui.selectedStopId); ui.selectedStopId=byL(sc.stops)[0].id; rebuildScaleEditor(); refresh(); };
      els.scaleEditor.querySelector('#delStop').disabled=getSel().stops.length<=1;
      // gradient drag/add
      const Lfromx=(cx)=>{const r=grad.getBoundingClientRect(); return clamp01(Llo+(Lhi-Llo)*Math.min(1,Math.max(0,(cx-r.left)/r.width)));};
      grad.addEventListener('dblclick',ev=>{ const sc=getSel(); const L=Lfromx(ev.clientX); const {h,c}=hcAt(sc.stops,L);
        const s={id:nextStopId++,L,h:Math.round(h),c:Math.round(c)}; sc.stops.push(s); ui.selectedStopId=s.id; rebuildScaleEditor(); refresh(); });
      grad._Lfromx=Lfromx; // used by window pointermove
      refreshEditorVisuals();
    }
    // update gradient bar + handles in the editor (no structural rebuild)
    function refreshEditorVisuals(){
      const grad=els.scaleEditor.querySelector('#grad'); if(!grad) return;
      const sc=getSel(), d=scaleData(sc);
      grad.querySelector('.bar').style.background=d.gradient;
      grad.querySelectorAll('.handle').forEach(h=>h.remove());
      byL(sc.stops).forEach(st=>{ const h=document.createElement('div'); h.className='handle'+(st.id===ui.selectedStopId?' sel':'');
        h.style.left=((st.L-Llo)/(Lhi-Llo)*100)+'%';
        const dot=document.createElement('div'); dot.className='dot'; dot.style.background=stopColorHex(st); h.appendChild(dot);
        h.addEventListener('pointerdown',e=>{e.preventDefault(); ui.selectedStopId=st.id; ui.dragging=st.id;
          const c=st, q=(id)=>els.scaleEditor.querySelector(id);
          // sync stop sliders + labels + color picker to the newly selected stop
          const sHue=q('#sHue'); if(sHue) sHue.value=Math.round(c.h);
          const sC=q('#sChroma'); if(sC) sC.value=Math.round(c.c);
          const sL=q('#sLight'); if(sL) sL.value=Math.round(c.L*100);
          const hv=q('#sHueVal'); if(hv) hv.textContent=Math.round(c.h)+'°';
          const cv=q('#sChromaVal'); if(cv) cv.textContent=Math.round(c.c)+'%';
          const lv=q('#sLightVal'); if(lv) lv.textContent=Math.round(c.L*100)+'%';
          const col=q('#stopColor'); if(col) col.value=stopColorHex(c);
          refresh(); });
        grad.appendChild(h); });
    }
    window.addEventListener('pointermove',e=>{ if(ui.dragging==null) return;
      const grad=els.scaleEditor.querySelector('#grad'); if(!grad||!grad._Lfromx) return;
      const st=getSel().stops.find(s=>s.id===ui.dragging); if(st){ st.L=grad._Lfromx(e.clientX);
        const sL=els.scaleEditor.querySelector('#sLight'); if(sL) sL.value=Math.round(st.L*100);
        const sLV=els.scaleEditor.querySelector('#sLightVal'); if(sLV) sLV.textContent=Math.round(st.L*100)+'%';
        const col=els.scaleEditor.querySelector('#stopColor'); if(col) col.value=stopColorHex(st);
        scheduleRefresh(); } });
    window.addEventListener('pointerup',()=>{ ui.dragging=null; });

    // Coalesce high-frequency edits (sliders / color picker / stop drag) to at most one
    // full re-render (palette + preview + CSS re-inject) per animation frame — keeps the
    // controls responsive instead of firing the heavy refresh on every input event.
    let _rafPending=false;
    function scheduleRefresh(){ if(_rafPending) return; _rafPending=true;
      requestAnimationFrame(()=>{ _rafPending=false; refresh(); }); }

    /* ================= Main: toolbar toggles ================= */
    els.tOpaque.onchange=()=>refresh();
    els.tTransparent.onchange=()=>refresh();
    els.tValues.onchange=()=>refresh();
    els.tOpacity.onchange=()=>refresh();

    /* ================= Main: palette grid ================= */
    function renderPalette(){
      const surf=getSurface(ui.rampSurfaceId), bgCol=surfaceColor(surf);
      els.palette.style.background=bgCol;
      const cs=sortContrasts();
      let html='';
      scales.forEach(sc=>{
        const d=scaleData(sc);
        const rows=[['dynamic','Dynamic']];
        if(els.tOpaque.checked) rows.push(['opaque','Opaque']);
        if(els.tTransparent.checked) rows.push(['transparent','Transparent']);
        html+=`<div class="palgroup"><div class="palname">--${sc.name}</div><div class="palrows">`;
        rows.forEach(([key,label])=>{
          html+=`<div class="palrow"><span class="pallabel">${label}</span><div class="palcells">`;
          cs.forEach((c,i)=>{ const g=genColors(sc,bgCol,c.value,d); const cell=g[key];
            const val=els.tValues.checked?`<span class="palval">${cell.meas.toFixed(2)}</span>`:'';
            const tok=`--contrast-${(i+1)*100}`;
            if(key==='dynamic'){
              // Dogfood: the swatch color is generated by the exported CSS function (not a hardcoded hex).
              html+=`<div class="palcell ${sc.name} tint-bg" style="--bg:${bgCol}; --contrast: var(${tok}); --sw: var(--tint)" title="${tok} (${c.value}:1) · &lt;div class=&quot;${sc.name} tint-bg&quot; style=&quot;--contrast: var(${tok})&quot;&gt;">${val}</div>`;
            } else if(key==='transparent'){
              // Naive CSS-opacity method: render the intelligently-picked SOURCE color at its alpha
              // (translucent background composited over --bg), so the DOM shows what's referenced + its transparency.
              const op=els.tOpacity.checked?`<span class="palop">${(cell.alpha*100).toFixed(1)}%</span>`:'';
              html+=`<div class="palcell" style="background:${rgbaStr(cell.srcHex,cell.alpha)};--sw:${cell.hex}" title="${tok} (${c.value}:1 target) · transparent: ${cell.srcHex} @ ${(cell.alpha*100).toFixed(1)}% over --bg → ${cell.meas.toFixed(2)}:1">${val}${op}</div>`;
            } else {
              // Opaque comparison (old way) — a solid computed color, not part of the exported API.
              html+=`<div class="palcell" style="background:${cell.hex};--sw:${cell.hex}" title="${tok} (${c.value}:1 target) · ${key} → ${cell.hex} · ${cell.meas.toFixed(2)}:1">${val}</div>`;
            } });
          html+=`</div></div>`;
        });
        html+=`</div><div class="palcontrasts">`;
        cs.forEach((c,i)=>{ html+=`<span>--contrast-${(i+1)*100}</span>`; });
        html+=`</div></div>`;
      });
      els.palette.innerHTML=html;
    }

    /* ================= Main: preview — usage-shaped surface tree ================= */
    function renderPreview(){
      if(els.mtabEval.hidden) return;                 // only build when the eval tab is visible
      const c=activeContrast(); const sc=getScale(ui.previewScaleId)||scales[0]; ui.previewScaleId=sc.id;
      const d=scaleData(sc);
      const sOpts=scales.map(s=>`<option value="${s.id}"${s.id===sc.id?' selected':''}>--${s.name}</option>`).join('');
      const cs=sortContrasts();
      const cOpts=cs.map((x,i)=>`<option value="${x.id}"${x.id===c.id?' selected':''}>--contrast-${(i+1)*100} · ${x.value.toFixed(2)}:1</option>`).join('');
      const badge=(m)=>`<span class="badge ${Math.abs(m-c.value)<0.25?'ok':'warn'}">${m.toFixed(2)}:1</span>`;
      const tok=contrastNameById(c.id);
      const nonBase=surfaces.filter(s=>!s.base && s.showInPreview!==false);
      const appliedS=nonBase.filter(s=>roleOf(s)==='applied');
      const onceS=nonBase.filter(s=>roleOf(s)==='once');
      const nestS=nonBase.filter(s=>roleOf(s)==='nest');
      const refTag=(surf)=>surf.base?'':`<span class="spref">${surf.contrast}:1 vs ${surf.reference} · ${surf.source==='base'?'base tint':'--'+surf.source}</span>`;
      // a single generated-color swatch (dogfoods the injected .<scale> CSS over this surface's --bg)
      const sample=()=>`<div class="cs-card">
          <div class="cs-fill ${sc.name} tint-bg"></div>
          <div class="cs-cap">Generated color</div>
        </div>`;
      // optional Dynamic/Opaque/Transparent detail (hidden unless toggled)
      const meta=(bgCol)=>{ if(!ui.showMeta) return ''; const g=genColors(sc,bgCol,c.value,d);
        return `<div class="compare">
            <div class="cell primary"><div class="chip ${sc.name} tint-bg"></div><div class="cap">Dyn<br>${badge(g.dynamic.meas)}</div></div>
            <div class="cell"><div class="chip" style="background:${g.opaque.hex}"></div><div class="cap">Opq<br>${badge(g.opaque.meas)}</div></div>
            <div class="cell"><div class="chip" style="background:${g.transparent.srcHex};opacity:${g.transparent.alpha.toFixed(3)}"></div><div class="cap">CSS α<br>${badge(g.transparent.meas)}</div></div>
          </div>`; };
      const leaf=(surf, parentLin)=>{ const lin=surfaceLin(surf,parentLin), bg=linToHex(lin);
        return `<div class="ctx leaf" style="background:${bg};--bg:${bg}; --contrast: var(${tok})">
            <div class="ctx-label">--${surf.name} ${refTag(surf)}</div>${sample()}${meta(bg)}</div>`; };
      // recursive context: base + a single nest surface's chain
      const context=(surf, parentLin, depthLeft, isBase, nestSurf)=>{
        const lin=surfaceLin(surf, parentLin), bg=linToHex(lin);
        const applied=appliedS.map(a=>leaf(a, lin)).join('');
        const once=isBase ? onceS.map(o=>leaf(o, lin)).join('') : '';
        const nested=(nestSurf && depthLeft>0) ? context(nestSurf, lin, depthLeft-1, false, nestSurf) : '';
        return `<div class="ctx" style="background:${bg};--bg:${bg}; --contrast: var(${tok})">
            <div class="ctx-label">--${surf.name} ${isBase?'':refTag(surf)}</div>
            <div class="ctx-body"><div class="ctx-self">${sample()}${meta(bg)}</div>${applied}${once}${nested}</div>
          </div>`; };
      const base=surfaces[0];
      const trees = nestS.length
        ? nestS.map(n=>context(base, null, ui.nestDepth, true, n)).join('')
        : context(base, null, 0, true, null);
      els.preview.innerHTML=`
        <div class="pvhead">
          <label>Color scale <select id="previewPick">${sOpts}</select></label>
          <label>Contrast swatch <select id="previewC">${cOpts}</select></label>
          <label>Nest depth <input type="range" id="nestDepth" min="1" max="4" step="1" value="${ui.nestDepth}"><span class="val">${ui.nestDepth}</span></label>
          <label><input type="checkbox" id="showMeta"${ui.showMeta?' checked':''}> Method detail</label>
        </div>
        <div class="pvtrees">${trees}</div>`;
      els.preview.querySelector('#previewPick').onchange=e=>{ ui.previewScaleId=+e.target.value; refresh(); };
      els.preview.querySelector('#previewC').onchange=e=>{ ui.activeContrastId=+e.target.value; refresh(); };
      els.preview.querySelector('#nestDepth').oninput=e=>{ ui.nestDepth=+e.target.value; refresh(); };
      els.preview.querySelector('#showMeta').onchange=e=>{ ui.showMeta=e.target.checked; refresh(); };
    }
    const contrastNameById=(id)=>{ const i=sortContrasts().findIndex(x=>x.id===id); return `--contrast-${(i+1)*100}`; };

    /* ================= Right: detail panel (all scales, markers) ================= */
    function renderDetail(){
      if(els.mtabEval.hidden) return;
      const c=activeContrast();
      let html=`<div class="dhead">Where the color comes from — ${contrastNameById(c.id)} = ${c.value.toFixed(2)}:1</div>
        <p class="hint">▾ intended (opaque pick) · ▲ source (faded to make Dynamic).</p>
        <div class="dscales">`;
      scales.forEach(sc=>{ const d=scaleData(sc); const g=genColors(sc,background(),c.value,d);
        html+=`<div class="dscale"><div class="dname">--${sc.name}</div>
          <div class="dgrad" style="background:${d.gradient}">
            <span class="dmark intended" style="left:${(clamp01(lumToFrac(d.ramp,g.Lov))*100).toFixed(1)}%">▾ intended</span>
            <span class="dmark source" style="left:${(clamp01(lumToFrac(d.ramp,g.Lsrc))*100).toFixed(1)}%">▲ source</span>
          </div>
          <div class="dmeta"><span>Dynamic ${g.dynamic.meas.toFixed(2)}:1</span><span class="${g.dE>settings.guardThreshold?'warn':'ok'}">ΔE ${g.dE.toFixed(3)}</span></div>
        </div>`; });
      html+=`</div>`;
      els.detail.innerHTML=html;
    }

    /* ================= Export ================= */
    els.exportBtn.onclick=()=>{ ui.exportOpen=!ui.exportOpen; els.exportOut.hidden=!ui.exportOpen; refresh(); };
    const f6=v=>v.toFixed(6);
    function chanExpr(A,ch,vn){ const t=[];
      for(let i=0;i<A.length-1;i++){ const sl=(A[i+1].lin[ch]-A[i].lin[ch])/((A[i+1].lum-A[i].lum)||1);
        t.push(`${f6(sl)} * (clamp(${f6(A[i].lum)}, var(${vn}), ${f6(A[i+1].lum)}) - ${f6(A[i].lum)})`); }
      return t.join('\n             + '); }
    function sideExpr(){ return settings.side==='dark'?'1'
      : settings.side==='light'?'0'
      : 'clamp(0, 1, (var(--_luma) - 0.1791) * 100000)'; }
    // Shared "fade a scale source over a reference color to hit a contrast" block (pure CSS, linear
    // light). Used by both scale classes and scale-sourced surfaces. cExpr = the contrast; darkExpr
    // = which side (1 = darker); off/st = extremity curve; ref = reference color var; out = output prop.
    function dynamicTintDecls({A, off, st, cExpr, darkExpr, ref, out}){
      return `  --_c: ${cExpr};
  --_luma: (0.2126*r + 0.7152*g + 0.0722*b);
  --_dark: ${darkExpr};
  --_lov: clamp(0, calc(var(--_dark) * ((var(--_luma) + 0.05) / var(--_c) - 0.05)
            + (1 - var(--_dark)) * (var(--_c) * (var(--_luma) + 0.05) - 0.05)), 1);
  --_ext: clamp(0, calc(${off} + ${st} * (var(--_c) - 1) / 11), 1);
  --_lend: calc(1 - var(--_dark));
  --_lsrc: clamp(0, calc(var(--_lov) + var(--_ext) * (var(--_lend) - var(--_lov))), 1);
  --_dn: calc(var(--_dark) * min(var(--_lsrc) - var(--_luma), -0.0001)
            + (1 - var(--_dark)) * max(var(--_lsrc) - var(--_luma), 0.0001));
  --_a: clamp(0, calc((var(--_lov) - var(--_luma)) / var(--_dn)), 1);
  ${out}: color(from ${ref} srgb-linear
    calc(var(--_a) * (${chanExpr(A,0,'--_lsrc')}) + (1 - var(--_a)) * r)
    calc(var(--_a) * (${chanExpr(A,1,'--_lsrc')}) + (1 - var(--_a)) * g)
    calc(var(--_a) * (${chanExpr(A,2,'--_lsrc')}) + (1 - var(--_a)) * b));`;
    }
    // Base-color surface tint: retint the reference color itself — lighten toward its hue's BRIGHT
    // form (not white) so tint survives, or darken toward black — to hit contrast C. Pure CSS.
    function baseTintDecls({C, force, ref, out}){
      const gl = force ? '0' : `(1 - clamp(0, 1, (${C} - 1.05/(var(--_luma) + 0.05)) * 100000))`;  // go-light; tie → lighter
      const lite=(k)=>`(${k} + var(--_al) * (${k}/var(--_maxc) - ${k}))`;   // toward bright hue
      const dark=(k)=>`(var(--_f) * ${k})`;                                  // toward black
      const ch=(k)=>`calc(var(--_gl) * ${lite(k)} + (1 - var(--_gl)) * ${dark(k)})`;
      return `  --_luma: (0.2126*r + 0.7152*g + 0.0722*b);
  --_maxc: max(r, max(g, b));
  --_al: clamp(0, calc(((${C} * (var(--_luma) + 0.05) - 0.05) - var(--_luma))
            / max(var(--_luma)/var(--_maxc) - var(--_luma), 0.000001)), 1);
  --_f: calc(((var(--_luma) + 0.05)/${C} - 0.05) / max(var(--_luma), 0.000001));
  --_gl: ${gl};
  ${out}: color(from ${ref} srgb-linear
    ${ch('r')}
    ${ch('g')}
    ${ch('b')});`;
    }
    function scaleFn(sc){ const d=scaleData(sc), A=d.anchors;
      // Neutral scale → bake e=1 (offset 1, steepness 0): pure white/black source, exported as pure CSS.
      const off=(d.neutral?1:settings.extOffset).toFixed(3), st=(d.neutral?0:settings.extSteep).toFixed(3);
      const ramp=d.ramp, n=ramp.length;
      const pal=[50,100,200,300,400,500,600,700,800,900,950].map((nm,i)=>{const idx=Math.round((10-i)*(n-1)/10);
        return `  --${sc.name}-${nm}: ${ramp[idx].hex.toUpperCase()};`; }).join('\n');
      return `/* ---- scale "${sc.name}" ---- reference ramp (display only) */
:root {
${pal}
}
/* Dynamic function: fade a scale source over --bg to hit --contrast (linear light). */
.${sc.name} {
${dynamicTintDecls({A, off, st, cExpr:'var(--contrast, var(--level-aa))', darkExpr:sideExpr(), ref:'var(--bg)', out:'--tint'})}
  --on-bg: contrast-color(var(--bg));
}`; }
    // Surfaces export: one class per surface TYPE. Each computes a background at its target
    // contrast vs a reference (parent = inherited --bg; base = root --surface-base), tinted from
    // a source (base color, or a scale). Parent-relative types pass their surface down via
    // `.s-content` (two-element wrapper, to avoid the --bg self-reference cycle); base-relative
    // overlays set --bg on themselves (single element — no cycle, they read --surface-base).
    function surfacesBlock(){
      const bgHex=background().toUpperCase();
      const blocks=[`:root {\n  --bg: ${bgHex};\n  --surface-base: ${bgHex};\n}`];
      surfaces.forEach(surf=>{
        if(surf.base) return;
        const C=(+surf.contrast).toFixed(3);
        const ref = surf.reference==='base' ? 'var(--surface-base)' : 'var(--bg)';
        const scale = surf.source!=='base' && scales.find(s=>s.name===surf.source);
        let decls, srcNote;
        if(scale){ const d=scaleData(scale);
          const off=(d.neutral?1:settings.extOffset).toFixed(3), st=(d.neutral?0:settings.extSteep).toFixed(3);
          const darkExpr = surf.forceDark ? '1' : `clamp(0, 1, (${C} - 1.05/(var(--_luma) + 0.05)) * 100000)`;
          decls=dynamicTintDecls({A:d.anchors, off, st, cExpr:C, darkExpr, ref, out:'--_surf'});
          srcNote=`scale "${surf.source}"`;
        } else {
          decls=baseTintDecls({C, force:surf.forceDark, ref, out:'--_surf'});
          srcNote='base color';
        }
        const publish = surf.reference==='base'
          ? `  background: var(--_surf); --bg: var(--_surf);`   // overlay: sets its own subtree's --bg
          : `  background: var(--_surf);`;                       // parent-relative: .s-content passes it down
        blocks.push(`/* --${surf.name} · ${surf.contrast}:1 vs ${surf.reference}, tint: ${srcNote} */\n.surface-${surf.name} {\n${decls}\n${publish}\n}`);
      });
      blocks.push(`/* Wrapper for parent-relative surfaces: place content inside so the new surface flows down. */\n.s-content { --bg: var(--_surf); }`);
      return `/* ---- Surfaces · tint × reference × contrast (all logic lives in the CSS).
 * Parent-relative:  <div class="surface-raised"><div class="s-content">…</div></div>
 * Base overlay:     <div class="surface-overlay">…</div>
 * Nest surfaces to compound (a surface inside a surface stacks relative to it). */
${blocks.join('\n')}`;
    }
    function buildLibrary(){
      const cs=sortContrasts();
      const ctoks=cs.map((c,i)=>`  --contrast-${(i+1)*100}: ${c.value};`).join('\n');
      const sideTxt=settings.side;
      const fns=scales.map(scaleFn).join('\n\n');
      const first=scales[0].name;
      const exSurf=(surfaces.find(s=>!s.base&&s.reference!=='base')||{name:'raised'}).name;
      return `/* ============================================================================
 * Dynamic color system — generated CSS
 * ----------------------------------------------------------------------------
 * Surfaces set --bg for their subtree; paint text/fills with a scale class + contrast:
 *   <div class="surface-${exSurf}"><div class="s-content">
 *     <span class="${first} tint-fg" style="--contrast: var(--contrast-200)">…</span>
 *   </div></div>
 * The CSS picks the color from the scale at that contrast, at paint time (linear
 * blend; contrast side = ${sideTxt}). Optical mode is intentionally absent — it can't
 * be a pure-CSS function. ============================================================ */

${surfacesBlock()}

/* ---- Contrast swatches (target ratios) ---- */
:root {
${ctoks}
  --level-ui: 3; --level-aa: 4.5; --level-aaa: 7;
}

${fns}

/* ---- Apply --- */
.tint-fg { color: var(--tint); }
.tint-bg { background: var(--tint); }
`;
    }

    /* ================= Refresh (visual outputs, no structural rebuilds) ================= */
    // Live copy of the exported CSS, injected into the page so the tool's own swatches
    // are generated by the real CSS API (not hardcoded hex) — true dogfooding.
    const genStyle=document.createElement('style'); document.head.appendChild(genStyle);

    function refresh(){
      els.bgVal.textContent=background().toUpperCase();
      const lib=buildLibrary(); genStyle.textContent=lib;
      updateContrastLabels(); markActiveRow();
      refreshEditorVisuals(); refreshSurfaceChips(); els.rampSurface.value=ui.rampSurfaceId;
      renderPalette();
      renderPreview();
      renderDetail();
      els.exportBtn.textContent = ui.exportOpen ? 'Hide CSS ▴' : 'Show CSS ▾';
      if(ui.exportOpen) els.exportOut.value=lib;
    }

    /* ================= Init ================= */
    els.bg.oninput=refresh;
    els.side.value=settings.side;
    els.eOffset.value=settings.extOffset;   // JSON drives the slider positions (not the HTML values)
    els.eSteep.value=settings.extSteep;
    els.eOffsetVal.textContent=settings.extOffset.toFixed(2);
    els.eSteepVal.textContent=(settings.extSteep>=0?'+':'−')+Math.abs(settings.extSteep).toFixed(2);
    syncTabs(); syncMainTabs(); rebuildContrastList(); rebuildScaleList(); rebuildScaleEditor();
    rebuildSurfaceList(); rebuildRampPicker(); refresh();
