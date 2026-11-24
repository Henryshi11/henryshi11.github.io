/* 5-Depth-Layer Living 360-Degree Fantasy World (Fixed Southeast World Sun: +141°):
   - Living Shader Animations (Zero Bloat):
     * 3-layer drifting & rising painterly cumulus clouds + closer sunlit valley mist ribbons
     * Ultra-Detailed Ornate Twin White Rings repositioned NW (-54°), cleanly separated from SW Waterfall Gorge (-147°)
     * Wide (~40°) multi-layered Western Mountain & Rolling Green Hill Transition bridging Rings <-> Waterfall Gorge
     * Eastern Snow Sanctuary (+96°) with animated pulsing & flowing cyan portal light & ice falls
     * Seamless 5-layer depth occlusion from ultra-far snow peaks down to the 3D meadow */
(function (root) {
  'use strict';
  const radians=Math.PI/180;
  const clamp=value=>Math.min(1,Math.max(0,value));
  const mix=(a,b,t)=>a+(b-a)*t;
  function smoothStep(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}

  const farContour=[.20,.32,.18,.28,.44,.34,.24,.19,.36,.28,.41,.31,.19,.32,.24,.36,.20];
  function profile(values,t){
    const x=clamp(t)*(values.length-1),index=Math.min(values.length-2,Math.floor(x)),f=x-index;
    return mix(values[index],values[index+1],f*f*(3-2*f));
  }
  function grid(T,width,height,vertex,material,name,scene,painted,renderOrder=0){
    const columns=width+1,count=columns*(height+1),pos=new Float32Array(count*3);
    const uv=painted?new Float32Array(count*2):null,color=painted?null:new Float32Array(count*3),indices=[];
    for(let j=0;j<=height;j++)for(let i=0;i<=width;i++){
      const k=j*columns+i,u=i/width,v=j/height;
      vertex(u,v,pos,k*3,color);
      if(uv){uv[2*k]=u;uv[2*k+1]=v;}
      if(i<width&&j<height){const b=k+columns;indices.push(k,k+1,b,k+1,b+1,b);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
    if(uv)g.setAttribute('uv',new T.BufferAttribute(uv,2));
    if(color)g.setAttribute('color',new T.BufferAttribute(color,3));
    g.setIndex(indices);g.computeBoundingSphere();
    const m=new T.Mesh(g,material);m.name=name;m.renderOrder=renderOrder;scene.add(m);
    return m;
  }

  function makeVistaMat(T,texture,shaderBody,cacheKey,alphaTest=.012,timeUniform=null){
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
    const mat=new T.MeshBasicMaterial({
      map:texture,side:T.DoubleSide,fog:false,toneMapped:false,
      transparent:true,depthWrite:false,alphaTest
    });
    mat.blending=T.CustomBlending;
    mat.blendSrc=T.SrcAlphaFactor;mat.blendDst=T.OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha=T.ZeroFactor;mat.blendDstAlpha=T.OneFactor;
    mat.onBeforeCompile=shader=>{
      if(timeUniform)shader.uniforms.uVistaTime=timeUniform;
      if(timeUniform){
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
          '#include <common>\nuniform float uVistaTime;');
      }
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n'+shaderBody);
    };
    mat.customProgramCacheKey=()=>cacheKey;
    return mat;
  }

  function placeCurvedVista(T,scene,texture,cfg,timeUniform=null){
    const mat=makeVistaMat(T,texture,cfg.shader,cfg.key,cfg.alphaTest??.012,timeUniform);
    const arc=cfg.arcDeg*radians,center=cfg.az*radians;
    const cols=cfg.cols||60,rows=cfg.rows||20;
    const mesh=grid(T,cols,rows,(u,v,p,k)=>{
      const az=center+(u-.5)*arc;
      // Optional 3D depth relief brings lower foreground viaducts/foothills closer for genuine motion parallax!
      const relief=(cfg.parallax||0)*(1-smoothStep(.06,.52,v));
      const depth=cfg.r-Math.sin(u*Math.PI)*(cfg.bulge||120)-relief;
      p[k]=(cfg.ox||0)+Math.sin(az)*depth;
      p[k+1]=cfg.yMin+v*cfg.height;
      p[k+2]=(cfg.oz||0)-Math.cos(az)*depth;
    },mat,cfg.name,scene,true,cfg.order);
    if(cfg.flipX){
      const uvAttr=mesh.geometry.attributes.uv;
      for(let i=0;i<uvAttr.count;i++)uvAttr.setX(i,1-uvAttr.getX(i));
      uvAttr.needsUpdate=true;
    }
    return mesh;
  }

  function placeRingStrip(T,scene,texture,cfg){
    texture.wrapS=T.RepeatWrapping;texture.wrapT=T.ClampToEdgeWrapping;
    const mat=makeVistaMat(T,texture,cfg.shader,cfg.key,.012);
    const cols=160,rows=12,pos=[],uv=[],idx=[];
    for(let j=0;j<=rows;j++){
      const v=j/rows;
      for(let i=0;i<=cols;i++){
        const u=i/cols,a=u*Math.PI*2;
        const r=cfg.r+Math.sin(a*3+.7)*(cfg.wobble||100);
        const h=cfg.height*(cfg.heightMod?cfg.heightMod(a):1);
        pos.push(-120+Math.sin(a)*r,cfg.yMin+v*h,-40-Math.cos(a)*r);
        uv.push(u*(cfg.repeat||3),v);
        if(i<cols&&j<rows){const p0=j*(cols+1)+i,p1=p0+cols+1;idx.push(p0,p0+1,p1,p0+1,p1+1,p1);}
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();
    const m=new T.Mesh(g,mat);m.name=cfg.name;m.renderOrder=cfg.order;scene.add(m);
    return m;
  }

  // Living cloud & rising mist shader: gently drifts sideways & billows upward with organic internal vapor curl!
  function placeLivingCloud(T,scene,cloudTex,timeUniform,cfg){
    const mat=new T.ShaderMaterial({
      uniforms:{
        uMap:{value:cloudTex},
        uTime:timeUniform,
        uAlpha:{value:cfg.alpha},
        uDrift:{value:cfg.drift||.008},
        uRise:{value:cfg.rise||.018},
        uSeed:{value:cfg.seed||1.0},
        uTint:{value:new T.Color(cfg.tint||0xffffff)}
      },
      transparent:true,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false,
      blending:T.CustomBlending,
      blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
      blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
      vertexShader:`
        uniform float uTime,uDrift,uRise,uSeed;
        varying vec2 vUv;
        void main(){
          vUv=uv;
          vec3 p=position;
          // Subtle living swell & buoyant thermal rise so the cloud breathes in 3D space
          float swell=sin(uTime*.32+uSeed+uv.x*4.5)*24.0;
          float riseWave=sin(uTime*.22+uSeed*1.7+uv.y*3.0)*18.0*uv.y;
          p.y+=riseWave+swell*.45;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader:`
        uniform sampler2D uMap;
        uniform float uTime,uAlpha,uDrift,uRise,uSeed;
        uniform vec3 uTint;
        varying vec2 vUv;
        void main(){
          vec2 uv=vUv;
          // Gentle internal vapor drift & upward thermal curling inside the cloud silhouette
          float w1=sin(uv.y*7.5-uTime*uRise*9.0+uSeed);
          float w2=cos(uv.x*6.2-uTime*uDrift*12.0+uSeed*1.9);
          vec2 sampleUv=vec2(
            clamp(uv.x+w1*.014+sin(uTime*uDrift*4.0+uSeed)*.022, .002, .998),
            clamp(uv.y+w2*.016, .002, .998)
          );
          vec4 c=texture2D(uMap,sampleUv);
          // Secondary rising mist lobe for alive billowing cloud edges
          vec2 uv2=vec2(clamp(uv.x-.035*sin(uTime*uDrift*5.5+uSeed),.002,.998),clamp(uv.y-.025*fract(uTime*uRise+uSeed*.1),.002,.998));
          vec4 c2=texture2D(uMap,uv2);
          float a=max(c.a,c2.a*.62)*uAlpha;
          a*=smoothstep(.01,.10,min(uv.x,1.-uv.x))*smoothstep(.0,.10,uv.y);
          if(a<.01)discard;
          vec3 rgb=mix(c.rgb,c2.rgb,.32)*uTint;
          // Radiant HDR sunlit upper cloud crown + rich cobalt-shaded cloud belly
          float crown=smoothstep(.38,.92,uv.y);
          rgb=mix(rgb*vec3(.78,.86,1.02),vec3(1.15,1.14,1.10),.28*crown);
          gl_FragColor=vec4(rgb,a);
          #include <colorspace_fragment>
        }`
    });
    const arc=cfg.arcDeg*radians,center=cfg.az*radians;
    const m=grid(T,28,12,(u,v,p,k)=>{
      const az=center+(u-.5)*arc;
      const depth=cfg.r-Math.sin(u*Math.PI)*70;
      p[k]=Math.sin(az)*depth;
      p[k+1]=cfg.yMin+v*cfg.height;
      p[k+2]=-Math.cos(az)*depth;
    },mat,cfg.name,scene,true,cfg.order);
    if(cfg.flipX){
      const uvAttr=m.geometry.attributes.uv;
      for(let i=0;i<uvAttr.count;i++)uvAttr.setX(i,1-uvAttr.getX(i));
      uvAttr.needsUpdate=true;
    }
    return m;
  }

  // Lightweight animated rising valley-mist veil (pure shader, zero textures!)
  function placeRisingMistVeil(T,scene,timeUniform,cfg){
    const mat=new T.ShaderMaterial({
      uniforms:{uTime:timeUniform,uAlpha:{value:cfg.alpha},uSeed:{value:cfg.seed}},
      transparent:true,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false,
      blending:T.CustomBlending,
      blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
      blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform float uTime,uAlpha,uSeed;
        varying vec2 vUv;
        float mh(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
        float mn(vec2 p){
          vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mh(i),mh(i+vec2(1.,0.)),f.x),mix(mh(i+vec2(0.,1.)),mh(i+1.),f.x),f.y);
        }
        void main(){
          float u=vUv.x,v=vUv.y;
          // Vapor wisps gently drifting sideways and rising upward!
          float n1=mn(vec2(u*6.5-uTime*.045+uSeed, v*3.2-uTime*.085));
          float n2=mn(vec2(u*14.0+uTime*.032+uSeed*2.1, v*6.0-uTime*.14));
          float n3=mn(vec2(u*24.0-uTime*.02, v*10.0-uTime*.19));
          float vapor=smoothstep(.32,.82,n1*.55+n2*.32+n3*.13);
          float env=smoothstep(.0,.18,min(u,1.-u))*smoothstep(.0,.22,v)*(1.-smoothstep(.45,1.0,v));
          float a=vapor*env*uAlpha;
          if(a<.008)discard;
          vec3 col=mix(vec3(.24,.50,.95),vec3(1.02,1.02,1.0),smoothstep(.18,.88,v));
          gl_FragColor=vec4(col,a);
          #include <colorspace_fragment>
        }`
    });
    const arc=cfg.arcDeg*radians,center=cfg.az*radians;
    return grid(T,32,10,(u,v,p,k)=>{
      const az=center+(u-.5)*arc;
      const depth=cfg.r-Math.sin(u*Math.PI)*60;
      p[k]=Math.sin(az)*depth;
      p[k+1]=cfg.yMin+v*cfg.height;
      p[k+2]=-Math.cos(az)*depth;
    },mat,cfg.name,scene,true,cfg.order);
  }

  function loadTex(T,url){
    return new Promise(resolve=>{
      new T.TextureLoader().load(url,t=>resolve(t),undefined,()=>resolve(null));
    });
  }

  function loadAllLayeredVistas(T,scene){
    const weather=root.RideWeather?.uniforms(T);
    const timeU=weather?weather.uWeatherTime:{value:0};
    return Promise.all([
      loadTex(T,'art/vista-snow-sanctuary.png'),
      loadTex(T,'art/vista-twin-rings-ornate.png'),
      loadTex(T,'art/vista-snow-range-t04.png'),
      loadTex(T,'art/vista-cloud-bank.png'),
      loadTex(T,'art/eastern-snow.webp'),
      loadTex(T,'art/strip-1-far-snow.png'),
      loadTex(T,'art/strip-3-falls-ridge.png'),
      loadTex(T,'art/strip-4-white-ruins.png'),
      loadTex(T,'art/strip-5-plateau-cliffs.png'),
      loadTex(T,'art/strip-6-green-valley.png'),
      loadTex(T,'art/trans-clouds.png'),
      loadTex(T,'art/trans-snow-peaks.png'),
      loadTex(T,'art/trans-blue-mountains.png'),
      loadTex(T,'art/trans-hills-cliff.png'),
      loadTex(T,'art/trans-green-mid.png'),
      loadTex(T,'art/trans-green-near.png')
    ]).then(([
      snowSanctuary,ornateRings,snowT04,cloudBank,farPeak,
      strip1Snow,strip3Falls,strip4Ruins,strip5Cliffs,strip6Valley,
      transClouds,transSnowPeaks,transBlueMtns,transHillsCliff,transGreenMid,transGreenNear
    ])=>{
      // =========================================================================
      // LAYER 1 (r≈5300-5800, order -10..-8): ULTRA-FAR 360° SNOW PEAKS & LIVING HIGH CLOUDS
      // =========================================================================
      if(strip1Snow){
        placeRingStrip(T,scene,strip1Snow,{
          name:'Layer 1 — 360° Ultra-far snow mountain skyline',r:5780,yMin:-120,height:740,repeat:3,wobble:140,order:-10,
          key:'layer1-far-snow-ring-v2',
          heightMod:a=>1-.22*Math.exp(-Math.pow(Math.sin((a-10.5*radians)*.5)/.18,2)),
          shader:`
            float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            diffuseColor.rgb=mix(vec3(.045,.16,.78),vec3(1.12,1.11,1.08),smoothstep(.08,.72,lum));
            vec3 skyScatter=mix(vec3(.24,.50,.95),vec3(.08,.26,.88),smoothstep(.08,.82,vMapUv.y));
            float air=.22+.28*(1.-smoothstep(.08,.78,vMapUv.y));
            diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
            diffuseColor.a*=smoothstep(.01,.10,vMapUv.y)*.92;`
        });
      }
      if(cloudBank){
        const highClouds=[
          {az:-14,arcDeg:32,r:5460,yMin:340,height:760,flipX:false,alpha:.78,drift:.010,rise:.022,seed:1.2},
          {az:38,arcDeg:34,r:5500,yMin:410,height:860,flipX:true,alpha:.82,drift:.009,rise:.019,seed:2.5},
          {az:80,arcDeg:32,r:5520,yMin:520,height:840,flipX:false,alpha:.76,drift:.011,rise:.024,seed:3.8},
          {az:138,arcDeg:38,r:5550,yMin:440,height:920,flipX:true,alpha:.86,drift:.008,rise:.020,seed:5.1},
          {az:-88,arcDeg:34,r:5480,yMin:420,height:820,flipX:true,alpha:.78,drift:.010,rise:.021,seed:6.4},
          {az:-122,arcDeg:32,r:5450,yMin:460,height:840,flipX:false,alpha:.82,drift:.011,rise:.025,seed:7.7},
          {az:176,arcDeg:34,r:5520,yMin:380,height:820,flipX:true,alpha:.82,drift:.009,rise:.018,seed:9.0}
        ];
        for(const cl of highClouds)placeLivingCloud(T,scene,cloudBank,timeU,{...cl,order:-9,name:'Living high cumulus cloud'});
      }
      // Airy scattered upper-sky anime cumulus drifts from the new transition sheet
      if(transClouds){
        const skyDrifts=[
          {az:-54,arcDeg:54,r:5280,yMin:980,height:740,flipX:false,alpha:.82,drift:.012,rise:.018,seed:31.2},
          {az:-106,arcDeg:54,r:5260,yMin:840,height:720,flipX:true,alpha:.84,drift:.013,rise:.020,seed:32.7},
          {az:16,arcDeg:50,r:5300,yMin:1020,height:720,flipX:false,alpha:.74,drift:.011,rise:.017,seed:34.1},
          {az:152,arcDeg:52,r:5300,yMin:900,height:740,flipX:true,alpha:.78,drift:.010,rise:.019,seed:35.8}
        ];
        for(const sd of skyDrifts)placeLivingCloud(T,scene,transClouds,timeU,{...sd,order:-9,name:'Living scattered high sky clouds'});
      }
      // Crisp cobalt-blue snow-capped alpine peaks across the wide Western transition & NW saddle
      if(transSnowPeaks){
        for(const sp of [
          {az:-98,arcDeg:58,r:5280,yMin:15,height:540,flipX:true,air:.15,key:'tsp-west-gap-v2'},
          {az:-28,arcDeg:46,r:5320,yMin:10,height:450,flipX:false,air:.17,key:'tsp-nw-saddle-v2'},
          {az:162,arcDeg:54,r:5300,yMin:10,height:490,flipX:false,air:.16,key:'tsp-south-v2'}
        ]){
          placeCurvedVista(T,scene,transSnowPeaks,{
            name:'Layer 1B — Crisp far cobalt snow peaks',az:sp.az,arcDeg:sp.arcDeg,r:sp.r,yMin:sp.yMin,height:sp.height,
            bulge:130,flipX:sp.flipX,order:-8,key:sp.key,cols:44,rows:10,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb=mix(vec3(.035,.12,.72),vec3(1.18,1.16,1.10),smoothstep(.07,.70,lum));
              vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.065,.23,.87),smoothstep(.08,.78,vMapUv.y));
              float air=${sp.air.toFixed(2)}+.20*(1.-smoothstep(.08,.74,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
              diffuseColor.a*=smoothstep(.008,.10,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.10,vMapUv.y);`
          });
        }
      }

      // =========================================================================
      // LAYER 2 (r≈4020-5250, order -8..-5): CORE WONDERS WITH LIVING SHADERS & AAA CONTRAST!
      // =========================================================================
      // 2A. EAST (+96°): Snow Mountain Sanctuary with ANIMATED PULSING & FLOWING CYAN PORTAL LIGHT!
      if(farPeak){
        const mat=makeVistaMat(T,farPeak,`
          float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=mix(vec3(.035,.12,.72),vec3(1.16,1.14,1.09),smoothstep(.08,.72,lum));
          vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.065,.23,.87),smoothstep(.10,.76,vMapUv.y));
          float air=.16+.22*(1.-smoothstep(.10,.70,vMapUv.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
          diffuseColor.a*=smoothstep(.005,.07,min(vMapUv.x,1.-vMapUv.x));`,
          'far-alpine-back-crest-v2',.015);
        const angle=120*radians,sa=Math.sin(angle),ca=Math.cos(angle);
        const w=5600,h=w*farPeak.image.height/farPeak.image.width*1.08,r=5250;
        const m=grid(T,56,28,(u,v,p,k)=>{
          const depth=r+v*240-160,persp=depth/r,tang=(u-.5)*w*persp;
          p[k]=sa*depth+ca*tang;p[k+1]=(-860+v*h)*persp;p[k+2]=-ca*depth+sa*tang;
        },mat,'Far towering glacier peak behind sanctuary',scene,true,-8);
        const uv=m.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));uv.needsUpdate=true;
      }
      if(snowT04){
        for(const w of [
          {az:56,arcDeg:44,r:4760,yMin:-50,height:720,flipX:false,air:.15,order:-7,key:'t04-ne-v2'},
          {az:132,arcDeg:48,r:4680,yMin:-45,height:790,flipX:true,air:.14,order:-7,key:'t04-se-v2'}
        ]){
          placeCurvedVista(T,scene,snowT04,{
            name:'T04 Snow mountain range extension',az:w.az,arcDeg:w.arcDeg,r:w.r,yMin:w.yMin,height:w.height,
            bulge:120,flipX:w.flipX,order:w.order,key:w.key,cols:40,rows:12,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb=mix(vec3(.032,.11,.70),vec3(1.18,1.16,1.10),smoothstep(.08,.72,lum));
              vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.06,.22,.86),smoothstep(.10,.76,vMapUv.y));
              float air=${w.air.toFixed(2)}+.18*(1.-smoothstep(.10,.72,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
              diffuseColor.a*=smoothstep(.005,.09,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.10,vMapUv.y);`
          });
        }
      }
      if(snowSanctuary){
        placeCurvedVista(T,scene,snowSanctuary,{
          name:'Grand Eastern Snow Sanctuary',az:96,arcDeg:66,r:4180,yMin:-165,height:2180,bulge:210,parallax:520,order:-5,
          key:'new-snow-sanctuary-aaa',
          shader:`
            float footFade=smoothstep(.005,.10,vMapUv.y);
            float sideFade=smoothstep(.004,.07,min(vMapUv.x,1.-vMapUv.x));
            float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            // Exaggerated White-City-matched contrast: deep royal cobalt shadows + blazing HDR sunlit spires!
            float stoneMask=1.-smoothstep(.05,.24,diffuseColor.g-max(diffuseColor.r,diffuseColor.b*.82));
            vec3 sculpted=mix(vec3(.028,.095,.64),vec3(1.25,1.22,1.14),smoothstep(.06,.68,lum));
            diffuseColor.rgb=mix(diffuseColor.rgb,sculpted,stoneMask*.52);
            diffuseColor.rgb+=vec3(.16,.15,.10)*smoothstep(.62,.96,lum)*stoneMask;
            // Detect the glowing cyan portal & ice falls inside the sanctuary arch and animate HDR aurora/water light!
            float portalBox=smoothstep(.60,.64,vMapUv.x)*(1.-smoothstep(.81,.86,vMapUv.x))
              *smoothstep(.30,.36,vMapUv.y)*(1.-smoothstep(.73,.79,vMapUv.y));
            float cyanChroma=smoothstep(.08,.36,diffuseColor.b-diffuseColor.r)*smoothstep(.22,.78,diffuseColor.g);
            float glowMask=portalBox*cyanChroma;
            if(glowMask>.01){
              float flow1=.5+.5*sin(vMapUv.y*58.+uVistaTime*4.2+sin(vMapUv.x*42.)*1.6);
              float flow2=.5+.5*sin(vMapUv.y*96.+uVistaTime*6.8-vMapUv.x*35.);
              float pulse=.78+.22*sin(uVistaTime*1.85);
              float shimmer=(flow1*.62+flow2*.38)*pulse;
              vec3 aura=mix(vec3(.08,.68,1.05),vec3(.95,1.18,1.25),shimmer);
              diffuseColor.rgb=mix(diffuseColor.rgb,aura,.58*glowMask)+vec3(.18,.42,.55)*shimmer*glowMask;
            }
            vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.055,.21,.86),smoothstep(.12,.75,vMapUv.y));
            float air=.02+.13*(1.-smoothstep(.10,.62,vMapUv.y));
            diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
            diffuseColor.a*=footFade*sideFade;`
        },timeU);
      }

      // 2B. NORTHWEST-WEST (-54°): BRAND-NEW ULTRA-DETAILED ORNATE TWIN WHITE RINGS (with 3D depth parallax & AAA contrast!)
      if(ornateRings){
        placeCurvedVista(T,scene,ornateRings,{
          name:'Ornate Colossal Twin White Rings',az:-54,arcDeg:43,r:4620,yMin:-255,height:2060,bulge:160,parallax:560,flipX:false,order:-6,
          key:'ornate-twin-rings-aaa',
          shader:`
            float footFade=smoothstep(.003,.065,vMapUv.y);
            float sideFade=smoothstep(.003,.045,min(vMapUv.x,1.-vMapUv.x));
            float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            // Preserve all carved gothic filigree & clocktower detail while aligning shadows to royal cobalt!
            float terraceGreen=smoothstep(.04,.18,diffuseColor.g-max(diffuseColor.r,diffuseColor.b*.90));
            vec3 cobaltSculpt=mix(vec3(.018,.068,.48),vec3(1.14,1.12,1.06),smoothstep(.04,.86,lum));
            vec3 col=mix(diffuseColor.rgb*vec3(1.03,1.03,1.02),cobaltSculpt,(1.-terraceGreen)*.44);
            float rimGleam=smoothstep(.76,.98,lum)*smoothstep(.22,.58,vMapUv.y)*(.76+.24*sin(uVistaTime*.70+vMapUv.x*5.2));
            col+=vec3(.12,.11,.07)*rimGleam*(1.-terraceGreen);
            vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.055,.21,.86),smoothstep(.10,.72,vMapUv.y));
            float air=.025+.13*(1.-smoothstep(.08,.56,vMapUv.y));
            diffuseColor.rgb=mix(col,skyScatter,air);
            diffuseColor.a*=footFade*sideFade;`
        },timeU);
      }

      // =========================================================================
      // LAYER 3 (r≈3150-4200, order -5..-3): MID-HORIZON MOUNTAINS, CLIFFS & LIVING CLOUDS!
      // =========================================================================
      // Living mid-layer clouds framing the Ornate Twin Rings, Western Mountain Valley, Snow Sanctuary, and White City
      if(cloudBank){
        const midClouds=[
          // Graceful sunlit clouds flanking the moved Ornate Twin Rings (-54°)
          {az:-75,arcDeg:24,r:4120,yMin:240,height:420,flipX:false,alpha:.74,drift:.013,rise:.024,seed:11.4,order:-5},
          {az:-31,arcDeg:22,r:4080,yMin:280,height:400,flipX:true,alpha:.72,drift:.012,rise:.022,seed:12.8,order:-5},
          // Soft cloud drifts hovering over the wide Western Mountain Transition (-115°..-76°)
          {az:-104,arcDeg:28,r:3780,yMin:210,height:440,flipX:true,alpha:.76,drift:.014,rise:.026,seed:15.2,order:-4},
          {az:-120,arcDeg:22,r:3580,yMin:90,height:340,flipX:false,alpha:.64,drift:.015,rise:.030,seed:16.8,order:-4},
          // Living glacial clouds drifting across the snowy flanks of the Eastern Snow Sanctuary
          {az:78,arcDeg:24,r:3820,yMin:340,height:440,flipX:false,alpha:.74,drift:.013,rise:.026,seed:18.3,order:-4},
          {az:114,arcDeg:26,r:3860,yMin:410,height:460,flipX:true,alpha:.76,drift:.012,rise:.024,seed:19.6,order:-4},
          // Soft sunlit cloud behind the White City's left spire flank
          {az:-10,arcDeg:22,r:3750,yMin:260,height:410,flipX:true,alpha:.64,drift:.011,rise:.022,seed:21.0,order:-4}
        ];
        for(const mc of midClouds)placeLivingCloud(T,scene,cloudBank,timeU,{...mc,name:'Living mid-level landmark cloud'});
      }

      // Soft misty blue mid-distance mountain range (NEW trans-blue-mountains.png) unifying the wide Western gap & 360° horizon
      if(transBlueMtns){
        for(const b of [
          {az:-96,arcDeg:58,r:4150,yMin:-45,height:420,flipX:true,key:'tbm-west-gap-v2'},
          {az:-32,arcDeg:48,r:4080,yMin:-55,height:370,flipX:false,key:'tbm-nw-saddle-v2'},
          {az:50,arcDeg:48,r:4100,yMin:-55,height:380,flipX:false,key:'tbm-ne-v2'},
          {az:144,arcDeg:50,r:4120,yMin:-50,height:390,flipX:false,key:'tbm-se-v2'}
        ]){
          placeCurvedVista(T,scene,transBlueMtns,{
            name:'Layer 3A — Misty blue mid-distance mountain range',az:b.az,arcDeg:b.arcDeg,r:b.r,yMin:b.yMin,height:b.height,
            bulge:115,flipX:b.flipX,order:-5,key:b.key,cols:44,rows:10,
            shader:`
              vec3 skyScatter=mix(vec3(.21,.46,.93),vec3(.06,.22,.86),smoothstep(.08,.76,vMapUv.y));
              float air=.08+.20*(1.-smoothstep(.08,.74,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.94,.98,1.08),skyScatter,air);
              diffuseColor.a*=smoothstep(.01,.11,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y);`
          });
        }
      }

      // Rolling green-blue ridges & misty cliff plateau (NEW trans-hills-cliff.png)
      if(transHillsCliff){
        for(const b of [
          {az:-102,arcDeg:52,r:3580,yMin:-85,height:375,flipX:true,key:'thc-wsw-bridge-v2'},
          {az:164,arcDeg:48,r:3560,yMin:-85,height:350,flipX:false,key:'thc-sse-v2'}
        ]){
          placeCurvedVista(T,scene,transHillsCliff,{
            name:'Layer 3B — Green-blue ridge & misty cliff plateau',az:b.az,arcDeg:b.arcDeg,r:b.r,yMin:b.yMin,height:b.height,
            bulge:100,flipX:b.flipX,order:-4,key:b.key,cols:44,rows:10,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              // Warm sunlit crests toward 3D golden-lime grass, deepen shadows toward royal cobalt
              diffuseColor.rgb*=mix(vec3(.65,.80,1.08),vec3(1.22,1.18,.78),smoothstep(.10,.46,lum));
              vec3 skyScatter=mix(vec3(.20,.45,.90),vec3(.07,.24,.85),smoothstep(.08,.75,vMapUv.y));
              float air=.08+.18*(1.-smoothstep(.08,.74,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
              diffuseColor.a*=smoothstep(.01,.11,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y);`
          });
        }
      }

      // Delicate distant white viaduct ruins tucked across the Twin Rings & Western hills
      if(strip4Ruins){
        for(const b of [
          {az:-42,arcDeg:46,r:3420,yMin:-100,height:295,flipX:false,key:'s4-nw-rings-v2'},
          {az:-84,arcDeg:42,r:3460,yMin:-105,height:285,flipX:true,key:'s4-west-link-v2'},
          {az:176,arcDeg:46,r:3460,yMin:-105,height:315,flipX:false,key:'s4-south-v2'}
        ]){
          placeCurvedVista(T,scene,strip4Ruins,{
            name:'Layer 3C — Distant white viaduct ruins and hills',az:b.az,arcDeg:b.arcDeg,r:b.r,yMin:b.yMin,height:b.height,
            bulge:95,flipX:b.flipX,order:-4,key:b.key,cols:44,rows:10,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb*=mix(vec3(.70,.82,1.06),vec3(1.18,1.16,.96),smoothstep(.14,.62,lum));
              vec3 skyScatter=mix(vec3(.20,.45,.90),vec3(.07,.24,.85),smoothstep(.10,.76,vMapUv.y));
              float air=.08+.18*(1.-smoothstep(.10,.76,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
              diffuseColor.a*=smoothstep(.01,.12,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y);`
          });
        }
      }
      if(strip3Falls){
        placeCurvedVista(T,scene,strip3Falls,{
          name:'Layer 3D — Subtle distant cascade green ridge',az:-114,arcDeg:38,r:3340,yMin:-95,height:315,bulge:90,flipX:true,order:-4,
          key:'s3-falls-west-link-v2',cols:40,rows:10,
          shader:`
            float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            diffuseColor.rgb*=mix(vec3(.65,.80,1.06),vec3(1.20,1.16,.80),smoothstep(.10,.50,lum));
            vec3 skyScatter=mix(vec3(.20,.45,.89),vec3(.07,.24,.84),smoothstep(.08,.74,vMapUv.y));
            float air=.09+.17*(1.-smoothstep(.08,.74,vMapUv.y));
            diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
            diffuseColor.a*=smoothstep(.01,.12,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y);`
        });
      }
      if(strip5Cliffs){
        placeCurvedVista(T,scene,strip5Cliffs,{
          name:'Layer 3E — Cloud-wrapped southern plateau cliffs',az:-176,arcDeg:44,r:3360,yMin:-95,height:345,bulge:95,flipX:false,order:-4,
          key:'s5-cliffs-sw-link-v2',cols:44,rows:10,
          shader:`
            float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            diffuseColor.rgb*=mix(vec3(.68,.80,1.06),vec3(1.20,1.16,.82),smoothstep(.10,.52,lum));
            vec3 skyScatter=mix(vec3(.20,.45,.90),vec3(.07,.24,.84),smoothstep(.08,.74,vMapUv.y));
            float air=.10+.18*(1.-smoothstep(.08,.74,vMapUv.y));
            diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,air);
            diffuseColor.a*=smoothstep(.01,.12,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y);`
        });
      }

      // =========================================================================
      // LAYER 4 (r≈2250-3160, order -3..-2): 3D-MATCHED GOLDEN-LIME & EMERALD HILLS + MIST!
      // =========================================================================
      if(transGreenMid){
        for(const b of [
          {az:-62,arcDeg:44,r:3140,yMin:-95,height:300,flipX:false,key:'tgm-rings-foot-v2'},
          {az:-98,arcDeg:44,r:3160,yMin:-95,height:300,flipX:true,key:'tgm-west-mid-v2'},
          {az:38,arcDeg:42,r:3150,yMin:-100,height:285,flipX:false,key:'tgm-ne-mid-v2'}
        ]){
          placeCurvedVista(T,scene,transGreenMid,{
            name:'Layer 4A — Mid-foreground rolling green hills',az:b.az,arcDeg:b.arcDeg,r:b.r,yMin:b.yMin,height:b.height,
            bulge:85,flipX:b.flipX,order:-3,key:b.key,cols:40,rows:10,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              // Bridge 2D green hills directly to 3D meadow's golden-chartreuse highlights & deep emerald shadows!
              diffuseColor.rgb*=mix(vec3(.55,.76,.96),vec3(1.26,1.20,.68),smoothstep(.08,.44,lum));
              float air=.06+.14*(1.-smoothstep(.08,.74,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.42,.84),air);
              diffuseColor.a*=smoothstep(.01,.12,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y);`
          });
        }
      }
      if(strip6Valley){
        for(const b of [
          {az:-80,arcDeg:54,r:3050,yMin:-115,height:265,flipX:true,key:'s6-west-valley-v2'},
          {az:12,arcDeg:56,r:3060,yMin:-120,height:255,flipX:false,key:'s6-north-valley-v2'},
          {az:156,arcDeg:52,r:3060,yMin:-115,height:260,flipX:false,key:'s6-se-valley-v2'}
        ]){
          placeCurvedVista(T,scene,strip6Valley,{
            name:'Layer 4B — Shimmering green river valley',az:b.az,arcDeg:b.arcDeg,r:b.r,yMin:b.yMin,height:b.height,
            bulge:80,flipX:b.flipX,order:-3,key:b.key,cols:44,rows:10,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb*=mix(vec3(.58,.78,.96),vec3(1.22,1.18,.74),smoothstep(.08,.48,lum));
              float air=.05+.13*(1.-smoothstep(.08,.75,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.42,.82),air);
              diffuseColor.a*=smoothstep(.01,.13,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.14,vMapUv.y)*.92;`
          });
        }
      }
      // Closest lush sunlit emerald-gold rolling foreground meadow hills (NEW trans-green-near.png)
      if(transGreenNear){
        for(const b of [
          {az:-52,arcDeg:52,r:2880,yMin:-122,height:275,flipX:false,key:'tgn-rings-front-v2'},
          {az:-96,arcDeg:48,r:2900,yMin:-120,height:275,flipX:true,key:'tgn-west-front-v2'},
          {az:6,arcDeg:56,r:2920,yMin:-128,height:265,flipX:false,key:'tgn-north-front-v2'},
          {az:56,arcDeg:46,r:2910,yMin:-124,height:255,flipX:false,key:'tgn-ne-front-v2'},
          {az:162,arcDeg:52,r:2930,yMin:-124,height:260,flipX:false,key:'tgn-south-front-v2'}
        ]){
          placeCurvedVista(T,scene,transGreenNear,{
            name:'Layer 4C — Lush sunlit rolling foreground meadow hills',az:b.az,arcDeg:b.arcDeg,r:b.r,yMin:b.yMin,height:b.height,
            bulge:75,flipX:b.flipX,order:-2,key:b.key,cols:40,rows:10,
            shader:`
              float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              // Exact warm golden-lime sunlit ridges + deep viridian-cobalt shadows matching 3D pasture!
              diffuseColor.rgb*=mix(vec3(.52,.75,.92),vec3(1.30,1.22,.64),smoothstep(.07,.42,lum));
              float air=.04+.11*(1.-smoothstep(.08,.75,vMapUv.y));
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.17,.40,.78),air);
              diffuseColor.a*=smoothstep(.01,.12,min(vMapUv.x,1.-vMapUv.x))*smoothstep(.01,.12,vMapUv.y)*.95;`
          });
        }
      }

      // Closer translucent sunlit valley mist veils slowly rising & drifting across the foothills (pure shader, zero file bloat!)
      for(const mv of [
        {az:-26,arcDeg:42,r:2360,yMin:-25,height:255,alpha:.42,seed:1.5,name:'Closer rising mist — White City to Rings saddle'},
        {az:-60,arcDeg:42,r:2400,yMin:-20,height:275,alpha:.44,seed:2.8,name:'Closer rising mist — Ornate Twin Rings base'},
        {az:-104,arcDeg:44,r:2320,yMin:-15,height:290,alpha:.46,seed:4.1,name:'Closer rising mist — Wide Western mountain valley'},
        {az:94,arcDeg:42,r:2450,yMin:-10,height:310,alpha:.42,seed:5.7,name:'Closer rising mist — Snow Sanctuary foothills'},
        {az:40,arcDeg:36,r:2380,yMin:-20,height:240,alpha:.36,seed:7.4,name:'Closer rising mist — Northeast ridge'}
      ]){
        placeRisingMistVeil(T,scene,timeU,{...mv,order:-2});
      }

      return Boolean(snowSanctuary||ornateRings||farPeak);
    });
  }

  function skyline(T,scene){
    const mat=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,fog:false,toneMapped:false});
    const farPeak=new T.Color(0xa2c8f4),farMid=new T.Color(0x6392de),farBase=new T.Color(0x8bb6ed),ink=new T.Color();
    grid(T,240,5,(u,v,p,k,col)=>{
      const a=u*Math.PI*2,r=6420+210*Math.cos(a*3+.8)-v*160;
      const ridge=profile(farContour,u)*640+24*Math.sin(a*19+.7*Math.cos(a*4))+12*Math.cos(a*41);
      p[k]=-200+Math.sin(a)*r;p[k+1]=mix(-380,45+ridge,v);p[k+2]=-80-Math.cos(a)*r;
      const sunSide=.5+.5*Math.sin(a*13+v*2.2);
      ink.copy(farBase).lerp(farMid,smoothStep(0,.62,v)).lerp(farPeak,smoothStep(.52,1,v)*(.55+.45*sunSide));
      ink.toArray(col,k);
    },mat,'Ultra-distant horizon atmosphere divide',scene,false,-11);
    return loadAllLayeredVistas(T,scene);
  }
  root.RideSkyline=skyline;
})(globalThis);
