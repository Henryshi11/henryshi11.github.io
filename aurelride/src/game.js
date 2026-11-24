(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const canvas = byId('world');
  window.RideView = {ready: false};
  try { buildGame(); }
  catch (error) {
    byId('error').hidden = false;
    byId('error').textContent = '画面未能启动。请使用开启图形加速的 Chrome 或 Edge 重新打开页面。';
    console.error(error);
  }

  function buildGame() {
    const T = window.THREE;
    // Detect hardware tier & user quality preference before building scene geometry
    const scalableGeos = [];
    const params = new URLSearchParams(location.search);
    const savedQuality = (() => { try { return localStorage.getItem('aurelride-quality'); } catch { return null; } })();
    const requestedQuality = params.get('quality') || savedQuality || 'auto';
    const coarseInit = matchMedia('(pointer:coarse)').matches;
    const lowCores = (navigator.hardwareConcurrency || 8) <= 4;
    const lowMem = (navigator.deviceMemory || 8) <= 4;
    let initialEco = requestedQuality === 'eco' || requestedQuality === 'low' || (requestedQuality === 'auto' && (coarseInit || (lowCores && lowMem)));
    const renderer = new T.WebGLRenderer({canvas, antialias: !initialEco, powerPreference:'high-performance'});
    // Probe GPU string for software / low-end integrated GPUs when in auto mode
    if (requestedQuality === 'auto' && !initialEco) {
      try {
        const gl = renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
        if (/swiftshader|llvmpipe|softpipe|mesa\s+offscreen|intel.*(hd|uhd|gma|celeron)|mali-g5|adreno\s*[345]/i.test(gpuName)) {
          initialEco = true;
        }
      } catch {}
    }
    const perfState = {
      mode: requestedQuality === 'eco' || requestedQuality === 'low' ? 'eco' : requestedQuality === 'high' ? 'high' : 'auto',
      isEco: initialEco,
      dynScale: initialEco ? 0.86 : 1.0,
      usePostFx: !initialEco,
      density: initialEco ? 0.72 : 1.0,
      registerScalable(geo, fullCount, minFrac = 0.52) {
        scalableGeos.push({geo, fullCount, minFrac});
      },
      applyDensity(factor) {
        this.density = Math.max(0.5, Math.min(1, factor));
        for (const item of scalableGeos) {
          const frac = item.minFrac + (1 - item.minFrac) * ((this.density - 0.5) / 0.5);
          item.geo.instanceCount = Math.max(64, Math.round(item.fullCount * Math.max(item.minFrac, Math.min(1, frac))));
        }
      }
    };
    globalThis.RidePerf = perfState;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;
    const scene = new T.Scene();
    scene.background = new T.Color(0x5288e5);
    scene.fog = new T.Fog(0x7fb0ec, 820, 4600);
    const camera = new T.PerspectiveCamera(53, 1, .14, 9000);
    scene.add(new T.HemisphereLight(0x8bbaff, 0x26422c, 1.12));
    const sun = new T.DirectionalLight(0xfff2d2, 3.85);
    sun.position.set(155, 175, 158);
    scene.add(sun);
    const height=(x,z)=>{
      const h=RideTrails.rideHeight(x,z,RideLand.height);
      if(!RideTrails.isDeck(x,z)){
        const wd=RideWorld.waterDepth(x,z);
        if(wd>.26)return Math.max(h,RideWorld.river(z).y-.26);
      }
      return h;
    };
    const land = RideLand.build(T,scene);
    const meadowLife=RideMeadowLife(T,scene,RideLand.height);
    const vistas=RideVistas.build(T,scene,RideWorld,RideLand);
    const orchard=RideOrchard.build(T,scene,RideLand);
    const bankTrees=RideBankTrees.build(T,scene,RideLand,RideTrails);
    const timber=RideTimberBridge.build(T,scene,RideLand,RideTrails);
    const weather=RideWeather.create(T,scene,{sun,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches});
    let skylineReady=false,outfitter=null;
    const scenery=[RideSkyline(T,scene),RideCityVista(T,scene),RideCascadeVista(T,scene)];
    const dragon=globalThis.RideCitadelDragon?RideCitadelDragon(T,scene):null;
    const loaders=[...scenery,land.ready??true,orchard.ready,timber.ready,bankTrees.ready];
    let doneLoaders=0;
    const trackedLoaders=loaders.map(p=>Promise.resolve(p).then(v=>{
      doneLoaders++;
      const pct=Math.min(99,Math.round(doneLoaders/loaders.length*100));
      if(!skylineReady&&byId('start'))byId('start').textContent='正在展开草海… '+pct+'%';
      return v;
    }));
    Promise.all(trackedLoaders).then(loaded=>{
      if(!loaded.every(Boolean)){
        byId('error').hidden=false;
        byId('error').textContent='远景加载失败，请重新打开游戏。';
        return;
      }
      skylineReady=true;
      try{renderer.compile(scene,camera);}catch{}
      byId('start').textContent='开始骑行';byId('start').disabled=false;
      byId('map-intro').disabled=false;
      byId('atelier-intro').disabled=false;
      window.RideView.ready=true;
    });
    const audio = RideAudio.create();
    const clamp = T.MathUtils.clamp, lerp = T.MathUtils.lerp;
    const angleDelta = n => Math.atan2(Math.sin(n),Math.cos(n));
    const damp = (a,b,rate,dt) => lerp(a,b,1-Math.exp(-rate*dt));
    const coarse = matchMedia('(pointer:coarse)').matches;
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const foliageTime = {value:0};
    const state = {x:0,z:0,y:0,heading:0,speed:0,steer:0,pitch:0,travel:0,time:0,
      handle:0,yawRate:0,grade:0,acceleration:0,effort:0,drive:true,coastHold:0,throttle:false,sprint:false,
      deckId:null,airborne:false,airCourse:0,verticalSpeed:0,airHeight:0,
      landingImpulse:0,landingCompression:0,landingAge:1,landingCount:0,
      routeDistance:0,guided:false,pace:true,paceTarget:13.5,parked:false,mode:'intro',sound:true,atBarrier:false};
    const dynamics={effort:0,grade:0,acceleration:0,braking:false,barTurn:0,cruise:true,gust:0,crosswind:0,tailwind:0};
    const cameraPresets=[
      {name:'史诗远景',az:-.12,pitch:.16,distance:7.1,height:1.68,fov:52},
      {name:'侧后披风近景',az:-.48,pitch:.17,distance:3.75,height:.92,fov:43},
      {name:'贴草低机位',az:-.22,pitch:.22,distance:4.85,height:.72,fov:56},
      {name:'侧前电影视角',az:2.42,pitch:.14,distance:4.9,height:1.18,fov:48}
    ];
    const wideLens=cameraPresets[0],closeLens=cameraPresets[1];
    const look = {minPitch:-.22,maxPitch:.72,
      yawPerPixel:T.MathUtils.degToRad(.22),pitchPerPixel:T.MathUtils.degToRad(.14),near:2.6,far:12.0};
    const view = {targetAz:wideLens.az,targetPitch:wideLens.pitch,targetDistance:wideLens.distance,base:1,
      locked:false,lastLookAt:-10,pointerLook:false};
    const held = new Set();
    const joy={active:false,id:null,originX:0,originY:0,dx:0,dy:0,mag:0,angle:0,camRef:0,used:false};
    const gearModes=[
      {id:'normal',label:'速度·标准',scale:1.0},
      {id:'fast',label:'速度·疾风',scale:1.30},
      {id:'slow',label:'速度·悠闲',scale:0.66}
    ];
    let gearIndex=0,pinchDist=0;
    const camPointers=new Map();
    const routes=new Map();
    const stoneBridge=RideWhiteBridge;
    const rider=RideRider.create(T,wheelHeight);
    scene.add(rider.root);
    for(const source of [...RideWorld.routes,RideTrails.route,RideVale.route,RideVale.bloomRoute,stoneBridge.route].filter(Boolean)){
      const curve=new T.CatmullRomCurve3(source.points.map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal');
      curve.arcLengthDivisions=source.points.length*70;
      const length=curve.getLength(), count=Math.max(240,Math.ceil(length/3));
      const samples=Array.from({length:count},(_,i)=>curve.getPointAt(i/count));
      routes.set(source.id,{id:source.id,curve,length,samples,name:source.name});
    }
    let route=routes.get('grand'),region=RideWorld.zones(0,0),hudAt=-10;
    const phases={sunny:'晴',cloud:'多云',shower:'太阳雨',clearing:'雨后初晴'};
    const places=[...RideWorld.landmarks,RideTrails.landmark,RideVale.landmark,RideVale.bloomLandmark,stoneBridge.landmark].filter(Boolean);
    const map=RideMap(RideWorld,RideLand.height,routes,places);
    const temp=new T.Vector3(), nearWall=new T.Vector3();
    const aimPos=new T.Vector3(), backPos=new T.Vector3(), ahead=new T.Vector3();
    const cameraFoot = new T.Vector3();
    const card=byId('controls');
    let noticeTimer,quietTimer,drag=null,clockLast=0;
    let displayedFov=53,changePitch=wideLens.pitch,changeYaw=wideLens.az,changeDist=wideLens.distance;
    let deckCameraLift=0,chaseHeading=0,cameraHeight=height(0,0),cameraRoll=0,chaseLateral=0,cameraGrade=0,fallLook=0,boomLimit=1;
    const lensVelocity={yaw:0,pitch:0,distance:0,ground:0,side:0,grade:0,roll:0};
    let fogPass=null, previousFrameReady=false;
    const riderTrackMask={value:1};
    const worldSunDir=new T.Vector3(.55,.62,.56).normalize();
    if(renderer.capabilities.isWebGL2 && !reduced){
      const hasFloatRT=renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float');
      const rt=new T.WebGLRenderTarget(2,2,{
        type:hasFloatRT?T.HalfFloatType:T.UnsignedByteType,
        minFilter:T.LinearFilter, magFilter:T.LinearFilter, depthBuffer:true, stencilBuffer:false
      });
      if(!hasFloatRT)rt.texture.colorSpace=T.SRGBColorSpace;
      rt.samples=Math.min(2,renderer.capabilities.maxSamples);
      rt.depthTexture=new T.DepthTexture(2,2,T.UnsignedIntType);
      // The render target's alpha stores the opaque rider silhouette when fogPass is active.
      // When direct-rendering in Eco mode (uTrackMask=0), keep alpha=1 so the rider stays solid.
      const marked=new Set();
      rider.root.traverse(object=>{
        const materials=Array.isArray(object.material)?object.material:[object.material];
        for(const material of materials){
          if(!material||material.transparent||marked.has(material))continue;
          marked.add(material);
          const before=material.onBeforeCompile,programKey=material.customProgramCacheKey();
          material.onBeforeCompile=function(shader,graphics){
            before.call(this,shader,graphics);
            shader.uniforms.uTrackMask=riderTrackMask;
            if(shader.fragmentShader.includes('#include <common>')){
              shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTrackMask;');
            }else{
              shader.fragmentShader='uniform float uTrackMask;\n'+shader.fragmentShader;
            }
            shader.fragmentShader=shader.fragmentShader.replace(/}\s*$/,'\n if(uTrackMask>.5)gl_FragColor.a=0.;\n}');
          };
          material.customProgramCacheKey=()=>programKey+'-tracked-cyclist-v2';
        }
      });
      const uniforms={
        picture:{value:rt.texture}, depthMap:{value:rt.depthTexture},
        shift:{value:new T.Vector4()},
        clip:{value:new T.Vector2(camera.near,camera.far)}, amount:{value:0},
        focalPixels:{value:600},pixel:{value:new T.Vector2()},
        sunScreen:{value:new T.Vector3(0,0,-1)},
        hdrMode:{value:hasFloatRT?1:0}
      };
      const shader=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
        vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`uniform sampler2D picture,depthMap;
          uniform vec4 shift;uniform vec2 pixel,clip;uniform vec3 sunScreen;
          uniform float amount,focalPixels,hdrMode;varying vec2 uv0;
          float viewDepth(float d){return clip.x*clip.y/(clip.y*(1.-d)+clip.x*d);}
          float contactTap(vec2 offset,float z,vec2 slope){
            vec2 uv=uv0+offset*pixel;
            float neighbour=viewDepth(texture2D(depthMap,uv).r);
            float contact=z+dot(slope,offset)-neighbour;
            float nearSurface=1.-smoothstep(.11,.24,abs(z-neighbour));
            float coverage=1.-smoothstep(.07,.67,texture2D(picture,uv).a);
            return smoothstep(.006,.061,contact)*nearSurface*coverage;
          }
          vec3 safeHdr(vec3 c){
            return vec3(
              (c.r>=0. && c.r<16.)?c.r:0.,
              (c.g>=0. && c.g<16.)?c.g:0.,
              (c.b>=0. && c.b<16.)?c.b:0.
            );
          }
          vec3 extractBright(vec3 c){
            vec3 s=safeHdr(c);
            float l=dot(s,vec3(.2126,.7152,.0722));
            return s*smoothstep(.88,1.45,l)*.55;
          }
          void main(){
            vec4 sample0=texture2D(picture,uv0);
            vec3 centre=safeHdr(sample0.rgb);
            vec3 result=centre;
            float d=texture2D(depthMap,uv0).r;
            float eyeDepth=viewDepth(d);
            vec2 slope=vec2(dFdx(eyeDepth),dFdy(eyeDepth));
            if(sample0.a<.22 && eyeDepth<14.){
              float metrePerPixel=eyeDepth/focalPixels;
              float facing=1.-smoothstep(1.40,2.9,length(slope)/metrePerPixel);
              float radius=clamp(.077/metrePerPixel,2.3,20.);
              vec2 a=vec2(.95,.18)*radius,b=vec2(-.21,.94)*radius;
              vec2 c=vec2(.40,.51)*radius,e=vec2(-.45,.37)*radius;
              float obscured=contactTap(a,eyeDepth,slope)+contactTap(-a,eyeDepth,slope)
                +contactTap(b,eyeDepth,slope)+contactTap(-b,eyeDepth,slope)
                +contactTap(c,eyeDepth,slope)+contactTap(-c,eyeDepth,slope)
                +contactTap(e,eyeDepth,slope)+contactTap(-e,eyeDepth,slope);
              result*=1.-.095*obscured*facing*(1.-smoothstep(.025,.22,sample0.a));
            }
            if(amount>.001 && eyeDepth<70. && sample0.a>.04){
              vec2 ndc=uv0*2.-1.;
              vec2 previousNdc=(ndc*eyeDepth+shift.xy)/max(.05,eyeDepth+shift.w);
              vec2 stroke=(ndc-previousNdc)*.5*amount;
              float periphery=smoothstep(.18,1.04,length(ndc*vec2(1.,.78)));
              float falloff=1.-smoothstep(18.,70.,eyeDepth);
              stroke*=falloff*mix(.50,1.0,periphery);
              float span=length(stroke/pixel);
              float limit=clamp(mix(12.,37.,periphery)/(720.*pixel.y),8.,66.);
              stroke*=min(1.,limit/max(1.,span));
              if(span>1.15){
                vec3 integrated=centre;
                float total=1.;
                for(int i=0;i<10;i++){
                  float offset=(float(i)-4.5)*.1;
                  vec2 sampleUV=clamp(uv0+stroke*offset,pixel,vec2(1.)-pixel);
                  float sd=texture2D(depthMap,sampleUV).r;
                  float discontinuity=abs(sd-d)/max(.00015,1.-d);
                  vec4 tap=texture2D(picture,sampleUV);
                  float weight=(1.-.60*abs(offset))*(1.-smoothstep(.10,.36,discontinuity))*tap.a;
                  integrated+=safeHdr(tap.rgb)*weight;
                  total+=weight;
                }
                result=mix(centre,integrated/total,mix(.58,.86,periphery)*sample0.a*smoothstep(1.15,3.6,span));
              }
            }
            // Tight, silky 2-ring Gaussian halation bloom (zero spire ghosting!)
            vec3 bloom=vec3(0.);
            float bScale=1./max(720.*pixel.y,.5);
            for(int k=0;k<8;k++){
              float a1=float(k)*.785398;
              float a2=a1+.392699;
              vec2 d1=vec2(cos(a1),sin(a1))*2.2*bScale*pixel;
              vec2 d2=vec2(cos(a2),sin(a2))*5.4*bScale*pixel;
              bloom+=extractBright(texture2D(picture,clamp(uv0+d1,pixel,vec2(1.)-pixel)).rgb)*.085;
              bloom+=extractBright(texture2D(picture,clamp(uv0+d2,pixel,vec2(1.)-pixel)).rgb)*.045;
            }
            result+=bloom*vec3(1.03,.99,.92)*.42;
            // Subtle directional Southeast solar atmospheric warmth when facing the sun
            if(sunScreen.z>0.){
              vec2 aspect=vec2(pixel.y/max(pixel.x,1.e-5),1.);
              float sunDist=length((uv0-sunScreen.xy)*aspect);
              float sunVeil=exp(-sunDist*2.4)*sunScreen.z;
              result+=vec3(.14,.11,.06)*sunVeil*.28;
            }
            // True Shadow-Deepening Cinema Contrast Curve (no midtone washout!)
            if(hdrMode>.5){
              vec3 x=max(vec3(0.),result);
              x=pow(x,vec3(1.09));
              result=x/(1.+.22*max(vec3(0.),x-.62));
              gl_FragColor=vec4(result,1.);
              #include <colorspace_fragment>
            }else{
              gl_FragColor=vec4(clamp(result,0.,1.),1.);
            }
          }`});
      const screen=new T.Scene();
      screen.add(new T.Mesh(new T.PlaneGeometry(2,2),shader));
      fogPass={rt,uniforms,screen,screenCamera:new T.Camera(),vp:new T.Matrix4()};
    }

    function resize(){
      if(outfitter?.visible)return;
      const w=Math.max(2,window.innerWidth),h=Math.max(2,window.innerHeight);
      const pixelBudget=perfState.isEco?1350000:3200000;
      const maxDpr=perfState.isEco?1.15:1.5;
      const baseScale=Math.min(window.devicePixelRatio||1,maxDpr,Math.sqrt(pixelBudget/(w*h)));
      const renderScale=Math.max(.52,baseScale*perfState.dynScale);
      renderer.setPixelRatio(renderScale);renderer.setSize(w,h,false);
      camera.aspect=w/h;camera.updateProjectionMatrix();
      if(fogPass){
        const rw=Math.max(2,Math.floor(w*renderScale)),rh=Math.max(2,Math.floor(h*renderScale));
        fogPass.rt.setSize(rw,rh);fogPass.uniforms.pixel.value.set(1/rw,1/rh);
      }
      previousFrameReady=false;
    }
    window.addEventListener('resize',resize);
    resize();
    function render(){
      if(!fogPass||!perfState.usePostFx){
        riderTrackMask.value=0;
        renderer.setRenderTarget(null);
        renderer.render(scene,camera);
        sceneDraws=renderer.info.render.calls;sceneTriangles=renderer.info.render.triangles;
        return;
      }
      riderTrackMask.value=1;
      const p=fogPass,u=p.uniforms;
      camera.updateMatrixWorld();
      p.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      u.focalPixels.value=.5*p.rt.height*camera.projectionMatrix.elements[5];
      const fx=Math.sin(state.heading),fz=-Math.cos(state.heading);
      // The virtual shutter travels with the vehicle. The chase boom also
      // sweeps through the air in a bend; looking around with the mouse does
      // not add an artificial smear to the horizon.
      const exposure=.040;
      const boomX=camera.position.x-state.x,boomZ=camera.position.z-state.z;
      u.shift.value.set((fx*state.speed-boomZ*state.yawRate)*exposure,
        state.verticalSpeed*exposure,(fz*state.speed+boomX*state.yawRate)*exposure,0).applyMatrix4(p.vp);
      u.amount.value=previousFrameReady&&state.mode==='ride'?T.MathUtils.smoothstep(state.speed,1.2,10.5):0;
      // Project Southeast world sun into screen space for directional atmospheric solar glare
      temp.copy(camera.position).addScaledVector(worldSunDir,1000).project(camera);
      const camFwd=ahead.set(0,0,-1).applyQuaternion(camera.quaternion);
      const sunFacing=Math.max(0,camFwd.dot(worldSunDir));
      u.sunScreen.value.set(temp.x*.5+.5,temp.y*.5+.5,sunFacing*sunFacing);
      renderer.setRenderTarget(p.rt);renderer.render(scene,camera);
      sceneDraws=renderer.info.render.calls;sceneTriangles=renderer.info.render.triangles;
      renderer.setRenderTarget(null);renderer.render(p.screen,p.screenCamera);
      previousFrameReady=true;
    }
    // The top of the aqueduct and the archway beneath it share the same
    // map coordinates. Access to the upper surface depends on wheel height.
    function reachableDeck(x,z){
      const top=stoneBridge.deckAt(x,z);
      if(top==null)return null;
      return Math.abs(top-state.y)<=(state.deckId ? .52 : stoneBridge.stepHeight)?top:null;
    }
    function wheelHeight(x,z){
      if(state.deckId){
        const top=stoneBridge.deckAt(x,z);
        if(top!=null)return top;
        // Axles can straddle the last flagstone. Extend its tangent only
        // for the contact solver; the centre of mass falls at the real lip.
        const forward=(x-state.x)*Math.sin(state.heading)-(z-state.z)*Math.cos(state.heading);
        return state.y+state.grade*forward;
      }
      return height(x,z);
    }
    function receivingHeight(x,z){
      const wd=!state.deckId?RideWorld.waterDepth(x,z):0;
      const floor=wd>.015?RideWorld.river(z).y+.024:height(x,z),top=stoneBridge.deckAt(x,z);
      const sameDeck=state.deckId && state.deckId===stoneBridge.surfaceId(x,z);
      return top!=null&&(sameDeck||top<=state.y+.48)?Math.max(floor,top):floor;
    }
    function freeSpace(x,z){
      const deck=reachableDeck(x,z);
      if(state.deckId||state.airborne||deck!=null){
        const b=RideWorld.bounds;
        if(x<b.minX+.6||x>b.maxX-.6||z<b.minZ+.6||z>b.maxZ-.6)return false;
      }else if(!RideTrails.canRideFrom(state.x,state.z,x,z,.6))return false;
      const y=(state.airborne?state.y:deck??(state.deckId?state.y:height(x,z)))+.8;
      return !vistas.blocked(x,z,.6,y)&&!orchard.blocked(x,z,.6,y)&&
        !timber.blocked(x,z,.6,y)&&!bankTrees.blocked(x,z,.6,y);
    }
    function nearestRoute(path){
      let best=Infinity,idx=0;
      path.samples.forEach((p,i)=>{
        const d=(p.x-state.x)**2+(p.z-state.z)**2;if(d<best){best=d;idx=i;}
      });
      return {at:idx/path.samples.length*path.length,gap:Math.sqrt(best)};
    }
    function setGuided(on,rejoin=false){
      state.guided=on;
      if(on){
        state.parked=false;
        setPace(false);
        let nearest=nearestRoute(route);
        if(rejoin&&nearest.gap>35){
          for(const candidate of routes.values()){
            const option=nearestRoute(candidate);
            if(option.gap<nearest.gap){route=candidate;nearest=option;}
          }
        }
        state.routeDistance=nearest.at;
      }
      byId('guide').setAttribute('aria-pressed',String(on));
    }
    function setPace(on){
      if(on){
        setGuided(false);
        state.parked=false;
        state.paceTarget=clamp(state.speed,8.5,12);
      }
      state.pace=on;
      byId('pace').setAttribute('aria-pressed',String(on));
    }
    function togglePace(){
      if(state.mode==='intro')mode('ride');
      joy.used=false;
      setPace(!state.pace);
      tell(state.pace?'自由漫骑　·　自己选方向，刹车可停':'已松开踏板');
    }
    const fork=RideTrails.cityFork,forkButton=byId('fork');
    const forkEast=Math.sin(fork.heading),forkNorth=Math.cos(fork.heading);
    let forkLocked=false;
    function nearFork(){
      const dx=state.x-fork.x,dz=state.z-fork.z;
      const along=dx*forkEast-dz*forkNorth,across=dx*forkNorth+dz*forkEast;
      return state.mode==='ride'&&!forkLocked&&along>=-51&&along<=14&&Math.abs(across)<13&&
        Math.cos(state.heading-fork.heading)>.55;
    }
    function updateFork(){
      if(forkLocked&&Math.hypot(state.x-fork.x,state.z-fork.z)>82)forkLocked=false;
      forkButton.hidden=!nearFork();
      if(!forkButton.hidden)byId('fork-label').textContent=route.id==='mill'?'回到全境巡游':'转入溪桥小径';
    }
    function switchAtFork(){
      if(!nearFork())return;
      route=routes.get(route.id==='mill'?'grand':'mill');
      setGuided(true);
      forkLocked=true;updateFork();tell(route.name);
      canvas.focus({preventScroll:true});
    }
    function move(dt){
      const joyActive=joy.active&&joy.mag>.08;
      const isJoySprint=joyActive&&(joy.mag>=.84||(gearIndex===1&&joy.mag>=.70));
      const throttle=held.has('KeyW')||held.has('ArrowUp');
      const brake=held.has('KeyS')||held.has('ArrowDown');
      const sprint=held.has('ShiftLeft')||held.has('ShiftRight')||isJoySprint;
      state.sprint=sprint;
      if((throttle||joyActive)&&!brake)state.parked=false;
      if(state.pace&&(brake||state.atBarrier))setPace(false);
      const turn=Number(held.has('KeyD')||held.has('ArrowRight'))-Number(held.has('KeyA')||held.has('ArrowLeft'));
      if((turn||joyActive)&&state.guided){setGuided(false);if(turn)tell('自由骑行　·　C 恢复巡游');}
      const fx=Math.sin(state.heading)*.60,fz=-Math.cos(state.heading)*.60;
      const uphill=state.airborne?0:(wheelHeight(state.x+fx,state.z+fz)-wheelHeight(state.x-fx,state.z-fz))/1.2;
      state.grade=damp(state.grade,uphill,8,dt);
      state.throttle=throttle||joyActive;
      state.coastHold=0;
      const gearScale=gearModes[gearIndex].scale;
      const cruiseSpeed=clamp(19.5-state.grade*14-Math.abs(state.steer)*3.2,13.5,24.5)*gearScale;
      if(state.speed>cruiseSpeed+1.2)state.drive=false;
      if(state.speed<cruiseSpeed-1.45)state.drive=true;
      const descending=T.MathUtils.smoothstep(-state.grade,.065,.15)*T.MathUtils.smoothstep(state.speed,5,11);
      const slopeLength=Math.hypot(1,state.grade);
      const breeze=weather.state;
      const fxAir=Math.sin(state.heading),fzAir=-Math.cos(state.heading);
      const airSpeed=breeze.windSpeed*.55;
      const apparentForward=state.speed-airSpeed*(breeze.windX*fxAir+breeze.windZ*fzAir);
      const apparentSide=airSpeed*(breeze.windX*fzAir-breeze.windZ*fxAir);
      const airDrag=.00135*apparentForward*Math.hypot(apparentForward,apparentSide);
      const surface=RideTrails.surfaceAt(state.x,state.z);
      const rolling=surface.material==='timber'?.045:surface.material==='gravel'?.062:.074;
      const inRiver=!state.deckId&&!RideTrails.isDeck(state.x,state.z)?RideWorld.waterDepth(state.x,state.z):0;
      const waterSplashDrag=inRiver>.015?clamp(inRiver*.18,.04,.22)/(1+state.speed*.045):0;
      const surfaceDrag=(state.deckId ? .042 : lerp(.068,rolling,surface.weight)+.02*breeze.wetness)+waterSplashDrag;
      const resistance=(state.airborne?0:surfaceDrag)+airDrag;
      // Uphill is softened so climbing feels effortless; downhill carries exhilarating momentum.
      const gravity=state.airborne?0:(state.grade>0?5.8:13.2)*state.grade/slopeLength;
      const climbing=T.MathUtils.smoothstep(state.grade,.06,.145);
      const levelEffort=state.drive?clamp(.62+(cruiseSpeed-state.speed)*.03,.50,.94):0;
      const climbEffort=clamp((gravity+resistance+.75*(cruiseSpeed-state.speed))/6.6,.18,1);
      const cruiseEffort=(1-descending)*lerp(levelEffort,climbEffort,climbing);
      const paceSpeed=(sprint?22.5:state.paceTarget)*gearScale;
      const paceEffort=clamp((.85*(paceSpeed-state.speed)+resistance+gravity)/6.6,0,sprint?1:.88);
      const normPull=clamp((joy.mag-.08)/.76,0,1);
      const joyTargetSpeed=(isJoySprint?lerp(21.5,33.5,clamp((joy.mag-.84)/.16,0,1)):lerp(3.4,18.2,Math.pow(normPull,1.12)))*gearScale;
      const joyEffort=clamp((1.18*(joyTargetSpeed-state.speed)+resistance+gravity)/6.8,0,isJoySprint?1.24:1.02);
      const targetEffort=brake||state.airborne?0:joyActive?joyEffort:(throttle||sprint)?(sprint?1.24:1):state.guided?cruiseEffort:(state.pace&&!joy.used)?paceEffort:0;
      state.effort=damp(state.effort,targetEffort,targetEffort>state.effort?7.2:7.8,dt);
      if(state.effort<.003)state.effort=0;
      const maxPowerSpeed=(sprint?40:34)*Math.max(1,gearScale*.95);
      const drive=state.effort*6.8*(1-T.MathUtils.smoothstep(state.speed,maxPowerSpeed-11,maxPowerSpeed));
      const acceleration=(state.airborne?0:drive)-resistance-gravity-(brake&&!state.airborne?8.5+.12*state.speed:0);
      const previousSpeed=state.speed;
      state.speed=clamp(state.speed+acceleration*dt,0,44);
      if(brake&&!state.airborne&&state.speed<.09&&!state.parked){
        state.parked=true;
        if(state.guided)setGuided(false);
        tell(joy.used?'已停稳　·　推动轮盘继续骑行':'已停稳　·　按 W 踩踏继续');
      }
      if(state.parked)state.speed=0;
      state.acceleration=damp(state.acceleration,(state.speed-previousSpeed)/dt,7.5,dt);
      // Progressive 2-stage carving + Honor of Kings 360° camera-relative joystick + gentle camera-guided flow!
      steerHold=turn?(Math.sign(turn)===lastTurnSign?Math.min(1,steerHold+dt*4.6):.15):Math.max(0,steerHold-dt*9.0);
      if(turn)lastTurnSign=Math.sign(turn);
      const progressiveTurn=turn*(.56+.44*steerHold*steerHold);
      let joySteer=0;
      if(joyActive){
        if(Math.abs(joy.angle)<.30 && camPointers.size===0){
          joy.camRef+=angleDelta(state.heading-joy.camRef)*(1-Math.exp(-dt*1.4));
        }
        const wantedHeading=joy.camRef+joy.angle;
        const headingErr=angleDelta(wantedHeading-state.heading);
        joySteer=clamp(headingErr*1.45,-1,1);
        if(Math.abs(joy.angle)>=.30 && camPointers.size===0){
          view.targetAz=angleDelta(view.targetAz+state.yawRate*dt*.92);
        }
      }
      let flowSteer=0;
      if(!joyActive && !turn && !state.guided && !drag && camPointers.size===0 && !view.pointerLook && !view.locked && (throttle||sprint) && state.speed>2.5){
        const activePreset=cameraPresets[view.base-1]||wideLens;
        const viewDiff=angleDelta(activePreset.az-view.targetAz);
        if(Math.abs(viewDiff)>.06 && Math.abs(viewDiff)<1.45){
          flowSteer=clamp(viewDiff*.38,-.42,.42);
          view.targetAz=angleDelta(view.targetAz+viewDiff*(1-Math.exp(-dt*.95)));
        }
      }
      const desiredInput=joyActive?joySteer:turn?progressiveTurn:flowSteer;
      const rollingYaw=Math.min(1.65,12.6/Math.max(state.speed,2.4))*T.MathUtils.smoothstep(state.speed,0,.58);
      const maxYaw=state.atBarrier&&turn?Math.max(.98,rollingYaw):rollingYaw;
      const counterSteer=turn && state.handle*turn<0;
      state.handle=damp(state.handle,desiredInput,counterSteer?16.5:turn?9.2:13.5,dt);
      let targetYaw=state.handle*maxYaw;
      const groundStep=state.speed*dt,step=groundStep/slopeLength;
      if(state.guided){
        const lead=clamp(7+state.speed*.39,7,18);
        route.curve.getPointAt(((state.routeDistance+lead)%route.length)/route.length,temp);
        const dist=Math.hypot(temp.x-state.x,temp.z-state.z);
        if(dist<lead+14)state.routeDistance=(state.routeDistance+step)%route.length;
        const wanted=Math.atan2(temp.x-state.x,state.z-temp.z);
        targetYaw=clamp(angleDelta(wanted-state.heading)*2.4,-maxYaw,maxYaw);
      }
      if(state.airborne)targetYaw=clamp(targetYaw,-.32,.32);
      state.yawRate=damp(state.yawRate,targetYaw,10.5,dt);
      state.heading+=state.yawRate*dt;
      state.steer=damp(state.steer,clamp(state.yawRate*state.speed/8.2,-1.15,1.15),8.5,dt);
      state.airCourse=state.airborne?state.airCourse+angleDelta(state.heading-state.airCourse)*(1-Math.exp(-.60*dt)):state.heading;
      const nx=state.x+Math.sin(state.airCourse)*step,nz=state.z-Math.cos(state.airCourse)*step;
      if(freeSpace(nx,nz)){state.x=nx;state.z=nz;state.travel+=groundStep;if(step>.0005)state.atBarrier=false;}
      else {
        let slid=false;
        for(const off of [.42,-.42,.85,-.85,1.25,-1.25]){
          const sa=state.airCourse+off,sx=state.x+Math.sin(sa)*step*.82,sz=state.z-Math.cos(sa)*step*.82;
          if(freeSpace(sx,sz)){
            state.x=sx;state.z=sz;state.travel+=groundStep*.82;
            state.heading+=angleDelta(sa-state.heading)*Math.min(1,dt*4.5);
            state.speed*=Math.exp(-1.6*dt);slid=true;state.atBarrier=false;break;
          }
        }
        if(!slid){state.speed*=Math.exp(-5.5*dt);state.atBarrier=true;}
      }
      const ground=height(state.x,state.z),deck=stoneBridge.deckAt(state.x,state.z);
      const wasOnDeck=Boolean(state.deckId);
      if(!state.airborne){
        if(deck!=null&&deck>=ground-.045&&Math.abs(deck-state.y)<=(wasOnDeck ? .52 : stoneBridge.stepHeight)){
          state.deckId=stoneBridge.surfaceId(state.x,state.z);
          state.verticalSpeed=(deck-state.y)/dt;
          state.y=deck;
        }else if(wasOnDeck&&state.y-ground>.40){
          state.deckId=null;state.airborne=true;
          state.verticalSpeed=clamp(state.speed*state.grade/slopeLength,-8,8);
        }else{
          state.deckId=null;
          state.verticalSpeed=(ground-state.y)/dt;
          state.y=ground;
        }
      }
      if(state.airborne){
        const previousY=state.y;
        state.y+=state.verticalSpeed*dt-.5*9.81*dt*dt;
        state.verticalSpeed-=9.81*dt;
        // A second bridge can also catch the rider from above. It never
        // lifts a bicycle riding the riverbank under its arch.
        const catchesDeck=deck!=null&&deck>=ground&&previousY>=deck-.04&&state.y<=deck;
        const floor=catchesDeck?deck:ground;
        if(state.y<=floor){
          state.landingImpulse=clamp(-state.verticalSpeed/17,.12,1);
          state.landingAge=0;state.landingCount++;state.verticalSpeed=0;
          state.deckId=catchesDeck?stoneBridge.surfaceId(state.x,state.z):null;
          state.airborne=false;state.y=floor;
        }
      }
      state.airHeight=state.airborne?Math.max(0,state.y-ground):0;
      state.landingAge+=dt;
      state.landingImpulse*=Math.exp(-4.2*dt);
      const t=state.landingAge/.095;
      state.landingCompression=t<10?state.landingImpulse*t*Math.exp(1-t):0;
      const bikePitch=state.airborne?clamp(Math.atan2(state.verticalSpeed,state.speed+3)*.34,-.32,.17):Math.atan(uphill);
      state.pitch=damp(state.pitch,bikePitch,state.airborne?2.8:9,dt);
    }
    function spring(value,target,key,hz,dt){
      const error=value-target, velocity=lensVelocity[key], decay=Math.exp(-hz*dt);
      const kick=(velocity+hz*error)*dt;
      lensVelocity[key]=(velocity-hz*kick)*decay;
      return target+(error+kick)*decay;
    }
    function cameraPose(dt,snap=false){
      const activePreset=cameraPresets[view.base-1]||wideLens;
      // Only gently drift back when actively steering (after 2.8s) or after a generous 8.5s sightseeing grace!
      const activelyTurning=held.has('KeyA')||held.has('KeyD')||held.has('ArrowLeft')||held.has('ArrowRight');
      const recenterWait=activelyTurning?2.6:8.5;
      if(!snap && !drag && camPointers.size===0 && !joy.active && !view.locked && !view.pointerLook && state.mode==='ride' && state.speed>2.5 && state.time-view.lastLookAt>recenterWait){
        view.targetAz+=angleDelta(activePreset.az-view.targetAz)*(1-Math.exp(-dt*(activelyTurning?1.15:.55)));
        view.targetPitch=damp(view.targetPitch,activePreset.pitch,.65,dt);
      }
      const effectiveDistance=view.targetDistance;
      const az=view.targetAz;
      const pitch=view.targetPitch;
      const moving=reduced?0:T.MathUtils.smoothstep(state.speed,3,28);
      const sprintBoost=state.sprint?1:0;
      const pull=(view.base===2?-.14:.10)*moving+.22*sprintBoost;
      if(snap){
        changeYaw=az;changePitch=pitch;changeDist=effectiveDistance+pull;
        for(const key in lensVelocity)lensVelocity[key]=0;
        chaseHeading=state.heading;cameraHeight=state.y;cameraRoll=cameraGrade=chaseLateral=fallLook=0;deckCameraLift=0;boomLimit=1;
      }else{
        const directLook=Boolean(drag||camPointers.size>0||view.pointerLook);
        changeYaw=spring(changeYaw,changeYaw+angleDelta(az-changeYaw),'yaw',directLook?26:12,dt);
        changePitch=spring(changePitch,pitch,'pitch',directLook?26:14,dt);
        changeDist=spring(changeDist,effectiveDistance+pull,'distance',10,dt);
        chaseHeading+=angleDelta(state.heading-chaseHeading)*(1-Math.exp(-dt*5.8));
        const probe=2.8+.15*state.speed;
        const hx=Math.sin(state.heading)*probe,hz=-Math.cos(state.heading)*probe;
        const roadAngle=state.airborne?state.pitch:Math.atan2(wheelHeight(state.x+hx,state.z+hz)-wheelHeight(state.x-hx,state.z-hz),2*probe);
        cameraGrade=spring(cameraGrade,roadAngle,'grade',5.8,dt);
        const rise=state.airborne?state.verticalSpeed:Math.sin(roadAngle)*state.speed;
        cameraHeight=spring(cameraHeight,state.y+rise*.15,'ground',13,dt);
        const descent=state.airborne?T.MathUtils.smoothstep(-state.verticalSpeed,1,22):0;
        fallLook=damp(fallLook,descent,state.airborne?3.8:2.6,dt);
        const pulse=.020*state.effort*Math.sin(rider.motion.crankAngle);
        const windLoad=.028*(dynamics.gust-.45)*dynamics.crosswind;
        // Lean camera slightly toward outside of corner so rider + flying cape sit on the rule-of-thirds.
        chaseLateral=spring(chaseLateral,moving*(-.42*state.steer+pulse+windLoad),'side',5.6,dt);
        cameraRoll=spring(cameraRoll,-moving*.068*state.steer*Math.cos(changeYaw),'roll',5.4,dt);
      }
      const small=clamp((wideLens.distance-changeDist)/(wideLens.distance-closeLens.distance),0,1);
      const baseBodyHeight=activePreset.height??lerp(1.68,.92,small);
      const bodyHeight=baseBodyHeight-moving*lerp(.10,.08,small);
      const lookingBack=held.has('KeyQ')&&state.mode==='ride';
      const orbit=(lookingBack?Math.PI-.45:changeYaw)-chaseHeading;
      backPos.set(Math.sin(orbit),0,Math.cos(orbit));
      const lensScale=clamp(Math.tan(28*Math.PI/180)/Math.tan(displayedFov*Math.PI/360),.88,1.52);
      const distance=lookingBack?5.0:changeDist*lensScale;
      const vOffset=clamp((activePreset.pitch-changePitch)*.65,-.75,.85);
      const desiredEye=lookingBack?2.55:bodyHeight+vOffset*distance+.58*fallLook;
      aimPos.set(state.x,state.y+1.16,state.z);
      nearWall.set(aimPos.x+backPos.x*distance+Math.cos(chaseHeading)*chaseLateral,
        cameraHeight+desiredEye,aimPos.z+backPos.z*distance+Math.sin(chaseHeading)*chaseLateral);
      const hillFollow=state.airborne?0:T.MathUtils.smoothstep(Math.abs(cameraGrade),.075,.185);
      const aboveDeck=state.deckId!==null;
      const eyeSupport=aboveDeck?stoneBridge.deckAt(nearWall.x,nearWall.z):null;
      const backGrade=aboveDeck && eyeSupport==null
        ? -Math.tan(cameraGrade)*distance*Math.cos(orbit+chaseHeading)
        : receivingHeight(nearWall.x,nearWall.z)-state.y;
      const relief=clamp(backGrade,-distance*.55,distance*.55)*hillFollow;
      nearWall.y+=relief;
      const clearanceAt=()=>Math.min(vistas.cameraFraction(aimPos,nearWall,.26),
        orchard.cameraFraction(aimPos,nearWall,.26),timber.cameraFraction(aimPos,nearWall,.26),
        bankTrees.cameraFraction(aimPos,nearWall,.26));
      let clearance=clearanceAt(),lift=0;
      const homeEye=nearWall.y;
      if(aboveDeck && clearance<.90){
        for(const step of [.65,1.3,2.1,3.0]){
          nearWall.y=homeEye+step;
          const available=clearanceAt();
          if(available>clearance+.035){clearance=available;lift=step;}
          if(available>.98)break;
        }
      }
      deckCameraLift=snap?lift:lift>deckCameraLift?damp(deckCameraLift,lift,17,dt):damp(deckCameraLift,lift,5,dt);
      nearWall.y=homeEye+deckCameraLift;
      if(deckCameraLift>.003||lift)clearance=clearanceAt();
      for(let i=1;i<=5;i++){
        const f=clearance*i/5;
        cameraFoot.lerpVectors(aimPos,nearWall,f);
        if(cameraFoot.y>=receivingHeight(cameraFoot.x,cameraFoot.z)+.34)continue;
        let lo=f-clearance/5,hi=f;
        for(let j=0;j<4;j++){
          const mid=(lo+hi)*.5;cameraFoot.lerpVectors(aimPos,nearWall,mid);
          if(cameraFoot.y<receivingHeight(cameraFoot.x,cameraFoot.z)+.34)hi=mid;else lo=mid;
        }
        clearance=lo;break;
      }
      boomLimit=snap||clearance<boomLimit?clearance:damp(boomLimit,clearance,4.6,dt);
      camera.position.lerpVectors(aimPos,nearWall,Math.max(.035,boomLimit));
      camera.position.y=Math.max(receivingHeight(camera.position.x,camera.position.z)+.31,camera.position.y);
      const horizontalFov=2*Math.atan(Math.tan(T.MathUtils.degToRad(displayedFov*.5))*camera.aspect);
      const behindWeight=Math.max(0,Math.cos(changeYaw));
      const bias=clamp(horizontalFov,.55,1.76)*lerp(.042,.125,small)*behindWeight;
      const direction=-orbit-bias;
      const eyePitch=clamp(Math.atan(Math.tan(changePitch)/lensScale)-vOffset*.14+cameraGrade*.12*(1-hillFollow)
        -Math.atan2(relief+deckCameraLift,distance)-moving*.006-fallLook*(reduced?.10:.22),-.85,.78);
      ahead.set(Math.sin(direction)*Math.cos(eyePitch),Math.sin(eyePitch),-Math.cos(direction)*Math.cos(eyePitch));
      if(lookingBack){
        const x=state.x-2.6*Math.sin(chaseHeading),z=state.z+2.6*Math.cos(chaseHeading);
        camera.lookAt(x,Math.max(state.y-1,receivingHeight(x,z))+.52,z);
      }else camera.lookAt(cameraFoot.copy(camera.position).add(ahead));
      camera.rotateZ(cameraRoll);
      const baseFov=activePreset.fov??52;
      const nf=baseFov+(reduced?0:lerp(10.5,6.5,small)*T.MathUtils.smoothstep(state.speed,6,30)+2.6*sprintBoost+.45*moving*state.effort);
      if(Math.abs(displayedFov-nf)>.025){displayedFov=damp(displayedFov,nf,2.8,dt);camera.fov=displayedFov;camera.updateProjectionMatrix();}
    }
    function preset(n,announce=true){
      const idx=clamp(n,1,cameraPresets.length);
      const lens=cameraPresets[idx-1];
      view.base=idx;view.targetAz=lens.az;view.targetDistance=lens.distance;
      view.targetPitch=lens.pitch;view.lastLookAt=-10;
      if(announce)tell('镜位 '+idx+' · '+lens.name);
    }
    function showUI(){
      document.body.classList.remove('quiet');clearTimeout(quietTimer);
      quietTimer=setTimeout(()=>{if(card.hidden)document.body.classList.add('quiet');},2200);
    }
    function tell(message){
      byId('notice').textContent=message;byId('notice').classList.add('show');clearTimeout(noticeTimer);
      noticeTimer=setTimeout(()=>byId('notice').classList.remove('show'),1600);
    }
    function help(open){
      card.hidden=!open;byId('help').setAttribute('aria-expanded',String(open));showUI();
    }
    const joyZone=byId('joy-zone'),joyBase=byId('joy-base'),joyKnob=byId('joy-knob'),gearBtn=byId('touch-gear');
    function resetJoy(){
      joy.active=false;joy.id=null;joy.dx=joy.dy=joy.mag=0;
      if(joyZone){joyZone.classList.remove('active','sprint');}
      if(joyBase){joyBase.style.left='50%';joyBase.style.top='50%';}
      if(joyKnob){joyKnob.style.setProperty('--jx','0px');joyKnob.style.setProperty('--jy','0px');}
    }
    function mode(next){
      if(next==='ride'&&state.mode==='intro'&&state.travel===0){
        state.speed=5.4;state.drive=true;state.effort=.32;
      }
      state.mode=next;document.body.dataset.mode=next;held.clear();drag=null;camPointers.clear();resetJoy();updateFork();
      byId('pause').textContent=next==='ride'?'Ⅱ':'▷';byId('pause').setAttribute('aria-label',next==='ride'?'暂停':'继续');
      if(next==='ride'){audio.setEnabled(state.sound);canvas.focus({preventScroll:true});showUI();}
      else{byId('start').textContent=next==='intro'?'开始骑行':'继续骑行';byId('where').textContent=next==='intro'?'白城草原 · 向阳草甸':'途中小憩';}
      audio.update(state.speed,false,next==='ride');previousFrameReady=false;
    }
    function relocate(place,path){
      land.resetTrail?.();
      audio.resetPosition();
      route=path;forkLocked=false;
      Object.assign(state,{x:place.x,z:place.z,y:height(place.x,place.z),heading:place.id==='city'?0:place.heading,
        speed:5.4,steer:0,pitch:0,travel:0,routeDistance:0,
        deckId:null,airborne:false,verticalSpeed:0,airHeight:0,airCourse:place.heading,
        landingAge:1,landingImpulse:0,landingCompression:0,landingCount:0,
        handle:0,yawRate:0,grade:0,effort:0,acceleration:0,coastHold:0,drive:true,throttle:false,atBarrier:false});
      setGuided(true);preset(1,false);cameraPose(0,true);previousFrameReady=false;hudAt=-10;
    }
    function reset(){
      relocate(RideWorld.landmarks[0],routes.get('grand'));state.speed=0;tell('已回到白城草甸');
    }
    let beforeMap='intro';
    function openMap(){
      if(!skylineReady||map.visible||outfitter?.visible)return;
      beforeMap=state.mode;
      help(false);
      if(beforeMap==='ride')mode('pause');
      map.open(state,route.id);
    }
    function closeMap(){
      map.close();
      if(beforeMap==='ride')mode('ride');
    }
    function depart(grand,roam=false){
      const place=grand?RideWorld.landmarks[0]:map.selected;
      map.close();relocate(place,routes.get(grand?'grand':place.id));
      if(roam)setPace(true);
      mode('ride');tell(roam?'自由漫骑　·　刹车可停':grand?route.name:place.name);
    }
    const lookButton=byId('wardrobe');
    function saveEquipment(){
      byId('outfit-name').textContent=rider.look.name;
      try{
        localStorage.setItem('white-city-ride-equipment',JSON.stringify({version:2,character:rider.character.id,bike:rider.bike.id,look:rider.look.id}));
        localStorage.setItem('white-city-rider-look',rider.look.id);
      }catch{}
    }
    function changeLook(){
      const selected=rider.cycleLook();
      byId('outfit-name').textContent=selected.name;
      tell('衣装 · '+selected.name);
      saveEquipment();
    }
    try{
      const legacy=localStorage.getItem('white-city-rider-look');
      if(legacy&&legacy!=='tide')rider.setLook(legacy);
      const saved=JSON.parse(localStorage.getItem('white-city-ride-equipment'));
      if(saved){
        if(rider.characters.some(c=>c.id===saved.character))rider.setCharacter(saved.character);
        if(rider.bikes.some(b=>b.id===saved.bike))rider.setBike(saved.bike);
        const previousDefault=!saved.version&&saved.character==='iris'&&saved.bike==='road'&&saved.look==='tide';
        if(previousDefault){rider.setLook('vermilion');saveEquipment();}
        else if(rider.looks.some(l=>l.id===saved.look))rider.setLook(saved.look);
      }
    }catch{}
    byId('outfit-name').textContent=rider.look.name;
    lookButton.onclick=changeLook;
    let beforeOutfit='intro';
    outfitter=RideOutfitter(T,renderer,rider,(accept,opener)=>{
      resize();
      if(accept)saveEquipment();
      mode(beforeOutfit);
      if(beforeOutfit!=='ride'&&opener?.isConnected)opener.focus({preventScroll:true});
      if(accept&&beforeOutfit==='ride')tell(rider.character.name+' · '+rider.bike.name);
    });
    function openOutfit(opener){
      if(!skylineReady||map.visible||outfitter.visible)return;
      beforeOutfit=state.mode;help(false);
      if(beforeOutfit==='ride')mode('pause');
      render(1/60);
      outfitter.open(opener);
    }
    byId('atelier-intro').onclick=e=>openOutfit(e.currentTarget);
    byId('atelier-open').onclick=e=>openOutfit(e.currentTarget);
    function toggleSound(){
      state.sound=!state.sound;audio.setEnabled(state.sound);
      byId('mute').setAttribute('aria-pressed',String(state.sound));showUI();
    }
    const qualityBtn=byId('quality');
    function syncQualityUI(){
      if(!qualityBtn)return;
      const label=perfState.isEco?'流畅':'高清';
      qualityBtn.textContent=label;
      qualityBtn.setAttribute('aria-pressed',String(perfState.isEco));
      qualityBtn.title=perfState.isEco?'当前：流畅节能模式（点击切回高清）':'当前：高清模式（低配电脑可点击切换流畅）';
    }
    function toggleQuality(){
      perfState.isEco=!perfState.isEco;
      perfState.mode=perfState.isEco?'eco':'high';
      perfState.dynScale=perfState.isEco?0.85:1.0;
      perfState.usePostFx=!perfState.isEco;
      perfState.applyDensity(perfState.isEco?0.58:1.0);
      try{localStorage.setItem('aurelride-quality',perfState.mode);}catch{}
      syncQualityUI();resize();showUI();
      tell(perfState.isEco?'已切换流畅模式（低配优化）':'已切换高清画质');
    }
    syncQualityUI();
    if(qualityBtn)qualityBtn.onclick=toggleQuality;
    const togglePause=()=>mode(state.mode==='ride'?'pause':'ride');
    const toggleGuide=()=>{setGuided(!state.guided,true);tell(state.guided?route.name:'自由骑行');};
    byId('start').onclick=()=>mode('ride');byId('pause').onclick=togglePause;
    byId('mute').onclick=toggleSound;byId('guide').onclick=toggleGuide;
    byId('pace').onclick=togglePace;
    byId('help').onclick=()=>help(card.hidden);byId('close-help').onclick=()=>help(false);
    byId('map-open').onclick=openMap;byId('map-intro').onclick=openMap;byId('map-close').onclick=closeMap;
    byId('map-depart').onclick=()=>depart(false);byId('map-tour').onclick=()=>depart(true);
    byId('map-roam').onclick=()=>depart(false,true);
    forkButton.onclick=switchAtFork;
    byId('world-map').addEventListener('cancel',e=>{e.preventDefault();closeMap();});
    byId('touch-camera').onclick=()=>preset((view.base%cameraPresets.length)+1);
    if(gearBtn){
      gearBtn.onclick=()=>{
        gearIndex=(gearIndex+1)%gearModes.length;
        const g=gearModes[gearIndex];
        gearBtn.textContent=g.label;
        gearBtn.dataset.gear=g.id;
        tell('骑行档位 · '+g.label.replace('速度·','')+(g.id==='fast'?'（轮盘拉满极速冲刺）':g.id==='slow'?'（舒缓观景）':'（随轮盘幅度快慢自如）'));
        showUI();
      };
    }
    if(coarse)document.body.classList.add('touch-device');
    window.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch')document.body.classList.add('touch-device');
    },{passive:true});
    if(joyZone){
      const maxR=44;
      const updateStick=(clientX,clientY)=>{
        const dx=clientX-joy.originX,dy=clientY-joy.originY;
        const dist=Math.hypot(dx,dy);
        const clamped=Math.min(maxR,dist);
        const ux=dist>.001?dx/dist:0,uy=dist>.001?dy/dist:0;
        joy.dx=ux*clamped;joy.dy=uy*clamped;
        joy.mag=clamp(dist/maxR,0,1);
        if(dist>3)joy.angle=Math.atan2(dx,-dy);
        if(joyKnob){
          joyKnob.style.setProperty('--jx',joy.dx.toFixed(1)+'px');
          joyKnob.style.setProperty('--jy',joy.dy.toFixed(1)+'px');
        }
        const sprintingNow=joy.mag>=.84||(gearIndex===1&&joy.mag>=.70);
        joyZone.classList.toggle('sprint',sprintingNow);
      };
      joyZone.addEventListener('pointerdown',e=>{
        e.preventDefault();e.stopPropagation();
        if(joy.active)return;
        if(state.mode==='intro')mode('ride');
        joyZone.setPointerCapture(e.pointerId);
        const rect=joyZone.getBoundingClientRect();
        const pad=54;
        const localX=clamp(e.clientX-rect.left,pad,Math.max(pad,rect.width-pad));
        const localY=clamp(e.clientY-rect.top,pad,Math.max(pad,rect.height-pad));
        if(joyBase){joyBase.style.left=localX+'px';joyBase.style.top=localY+'px';}
        joy.active=true;joy.id=e.pointerId;joy.used=true;
        joy.originX=rect.left+localX;joy.originY=rect.top+localY;
        joy.camRef=chaseHeading-changeYaw;
        joyZone.classList.add('active');
        updateStick(e.clientX,e.clientY);
        showUI();
      });
      joyZone.addEventListener('pointermove',e=>{
        if(!joy.active||e.pointerId!==joy.id)return;
        e.preventDefault();
        updateStick(e.clientX,e.clientY);
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture']){
        joyZone.addEventListener(type,e=>{
          if(joy.active&&e.pointerId===joy.id)resetJoy();
        });
      }
    }
    function togglePointerLook(){
      if(document.pointerLockElement===canvas){document.exitPointerLock?.();return;}
      canvas.requestPointerLock?.();
    }
    document.addEventListener('pointerlockchange',()=>{
      view.pointerLook=document.pointerLockElement===canvas;
      if(view.pointerLook)tell('自由鼠标控镜 · Esc 退出');
    });
    window.addEventListener('keydown',e=>{
      if(outfitter.visible){
        if(e.code==='KeyB'&&!e.repeat){e.preventDefault();outfitter.close(false);}
        return;
      }
      if(e.code==='KeyB'&&!e.repeat&&!map.visible){e.preventDefault();openOutfit(document.activeElement);return;}
      if(e.code==='KeyG'&&!e.repeat){e.preventDefault();if(map.visible)closeMap();else openMap();return;}
      if(map.visible||!skylineReady)return;
      if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if(e.repeat)return;
      if(e.code==='Tab'&&state.mode==='ride'){togglePointerLook();return;}
      if(e.code==='KeyL'){view.locked=!view.locked;tell(view.locked?'已锁定当前电影机位':'已开启视角柔和回正');return;}
      if(e.code==='Space'){togglePause();return;}
      if(e.code==='KeyN'){switchAtFork();return;}
      if(e.code==='KeyF'){togglePace();return;}
      if(e.code==='KeyV'){changeLook();return;}
      if(e.code==='KeyQ'&&state.mode==='ride'){held.add(e.code);previousFrameReady=false;return;}
      if(e.code==='KeyH'){help(card.hidden);return;}
      if(e.code==='Escape'){if(view.pointerLook){document.exitPointerLock?.();return;}if(!card.hidden)help(false);else if(state.mode==='ride')mode('pause');return;}
      if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowRight','ArrowLeft'].includes(e.code)){
        if(state.mode==='intro')mode('ride');held.add(e.code);
      }
      if(e.code==='Digit1')preset(1);if(e.code==='Digit2')preset(2);
      if(e.code==='Digit3')preset(3);if(e.code==='Digit4')preset(4);
      if(e.code==='KeyC')toggleGuide();if(e.code==='KeyR')reset();if(e.code==='KeyM')toggleSound();
    });
    window.addEventListener('keyup',e=>{if(e.code==='KeyQ')previousFrameReady=false;held.delete(e.code);});
    window.addEventListener('blur',()=>{held.clear();drag=null;camPointers.clear();resetJoy();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='ride')mode('pause');});
    document.querySelectorAll('[data-key]').forEach(b=>{
      b.addEventListener('pointerdown',e=>{e.stopPropagation();b.setPointerCapture(e.pointerId);held.add(b.dataset.key);if(b.dataset.key==='KeyQ')previousFrameReady=false;});
      for(const type of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(type,()=>{held.delete(b.dataset.key);if(b.dataset.key==='KeyQ')previousFrameReady=false;});
    });
    canvas.addEventListener('pointerdown',e=>{
      if(outfitter.visible)return;
      if(e.button===1){e.preventDefault();if(state.mode==='ride')togglePointerLook();return;}
      if(e.pointerType==='mouse'&&e.button>0)return;
      if(camPointers.size>=2)return;
      try{canvas.setPointerCapture(e.pointerId);}catch{}
      camPointers.set(e.pointerId,{x:e.clientX,y:e.clientY,travel:0});
      if(camPointers.size===2){
        const pts=[...camPointers.values()];
        pinchDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      }else{
        drag=camPointers.get(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove',e=>{
      if(outfitter.visible)return;
      if(view.pointerLook){
        view.targetAz=angleDelta(view.targetAz-e.movementX*look.yawPerPixel*.85);
        view.targetPitch=clamp(view.targetPitch-e.movementY*look.pitchPerPixel*.85,look.minPitch,look.maxPitch);
        if(joy.active)joy.camRef=chaseHeading-view.targetAz;
        view.lastLookAt=state.time;
        return;
      }
      const pt=camPointers.get(e.pointerId);
      if(pt){
        const dx=e.clientX-pt.x,dy=e.clientY-pt.y;
        pt.travel+=Math.hypot(dx,dy);
        pt.x=e.clientX;pt.y=e.clientY;
        if(camPointers.size===2){
          const pts=[...camPointers.values()];
          const dNow=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
          if(pinchDist>12&&dNow>12){
            view.targetDistance=clamp(view.targetDistance*(pinchDist/dNow),look.near,look.far);
          }
          pinchDist=dNow;
        }else{
          const sens=e.pointerType==='touch'?1.18:1.0;
          view.targetAz=angleDelta(view.targetAz-dx*look.yawPerPixel*sens);
          view.targetPitch=clamp(view.targetPitch-dy*look.pitchPerPixel*sens,look.minPitch,look.maxPitch);
          if(joy.active)joy.camRef=chaseHeading-view.targetAz;
          view.lastLookAt=state.time;
        }
      }
      if(e.clientY<75)showUI();
    });
    const endCamPointer=e=>{
      const pt=camPointers.get(e.pointerId);
      if(!pt)return;
      const tap=pt.travel<6&&camPointers.size===1;
      camPointers.delete(e.pointerId);
      drag=camPointers.size===1?[...camPointers.values()][0]:null;
      if(tap&&state.mode==='intro'&&e.type==='pointerup')mode('ride');
    };
    canvas.addEventListener('pointerup',endCamPointer);
    canvas.addEventListener('pointercancel',endCamPointer);
    canvas.addEventListener('lostpointercapture',endCamPointer);
    canvas.addEventListener('wheel',e=>{
      if(outfitter.visible)return;
      e.preventDefault();
      const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
      view.targetDistance=clamp(view.targetDistance*Math.exp(clamp(pixels,-120,120)*.00085),look.near,look.far);
    },{passive:false});
    if(coarse)byId('hint').textContent='左下轮盘控制方向与快慢（拉到底冲刺） · 右手滑屏 360° 环视';
    let sceneDraws=0,sceneTriangles=0;
    let perfAvgDt=1/60,perfSampleTime=0,perfCooldown=0;
    let steerHold=0,lastTurnSign=0,physAcc=0,riderSunVis=1;
    const FIXED_DT=1/120;
    state.y=height(0,0);cameraPose(0,true);
    rider.root.position.set(0,state.y,0);land.update(0,0,0,0);rider.update(0,0,0,0);
    const draw=now=>{
      const realDt=clockLast?Math.min(.3,(now-clockLast)/1000):1/60;clockLast=now;
      const dt=Math.min(.10,realDt),active=state.mode==='ride';
      if(outfitter.visible){outfitter.draw(dt);requestAnimationFrame(draw);return;}
      // Adaptive performance guard: smoothly step down resolution / postFX / grass density if sustained FPS drops on low-end GPUs
      if(active && !document.hidden && realDt<.20){
        perfAvgDt=lerp(perfAvgDt,realDt,.06);
        perfSampleTime+=realDt;
        if(perfCooldown>0)perfCooldown-=realDt;
        if(perfSampleTime>1.4 && perfCooldown<=0){
          perfSampleTime=0;
          if(perfAvgDt>.034){
            if(perfState.usePostFx && perfAvgDt>.040){
              perfState.usePostFx=false;perfCooldown=2.5;
            }else if(perfState.dynScale>.64){
              perfState.dynScale=Math.max(.64,perfState.dynScale-.12);
              resize();perfCooldown=2.2;
            }else if(perfState.density>.55){
              perfState.applyDensity(Math.max(.55,perfState.density-.22));
              perfCooldown=3.0;
            }
          }else if(perfAvgDt<.0185 && !perfState.isEco && perfState.dynScale<1.0){
            perfState.dynScale=Math.min(1.0,perfState.dynScale+.08);
            resize();perfCooldown=3.5;
          }
        }
      }
      if(active){
        physAcc=Math.min(.10,physAcc+dt);
        while(physAcc>=FIXED_DT){
          move(FIXED_DT);
          state.time+=FIXED_DT;
          physAcc-=FIXED_DT;
        }
      }
      if(state.mode!=='pause')foliageTime.value+=dt;
      const w=weather.update(state.x,state.z,state.time,camera,{speed:state.speed,heading:state.heading,axles:state.airborne?null:rider.axles});
      // Dynamically plunge rider & silk cape into cool cobalt shade inside Great Wall / cumulus shadows,
      // then ignite blazing golden-white rim-light & silk translucency when riding back into sunlight!
      const wallShade=state.deckId?0:(RideLand.monumentShadowAt?RideLand.monumentShadowAt(state.x,state.z):0);
      const targetSunVis=1-.86*Math.max(w.cloudShade||0,wallShade);
      riderSunVis=damp(riderSunVis,targetSunVis,7.2,dt);
      rider.setSunVisibility?.(riderSunVis);
      rider.root.position.set(state.x,state.y,state.z);
      rider.root.rotation.order='YXZ';rider.root.rotation.y=-state.heading;rider.root.rotation.x=state.pitch;
      dynamics.effort=state.effort;dynamics.grade=state.grade;dynamics.acceleration=state.acceleration;
      dynamics.sprint=state.sprint;
      dynamics.parked=state.parked;
      const inWaterNow=!state.deckId&&!RideTrails.isDeck(state.x,state.z)&&RideWorld.waterDepth(state.x,state.z)>=.015;
      dynamics.shadowInMeadow=!state.deckId&&!RideTrails.isDeck(state.x,state.z);
      dynamics.inWater=inWaterNow;
      dynamics.airborne=state.airborne;dynamics.verticalSpeed=state.verticalSpeed;
      dynamics.airHeight=state.airHeight;dynamics.landingCompression=state.landingCompression;dynamics.shadowHeight=receivingHeight;
      dynamics.braking=active&&(held.has('KeyS')||held.has('ArrowDown'));
      dynamics.barTurn=-Math.atan2(1.11*state.yawRate,Math.max(state.speed,.8));dynamics.cruise=state.guided;
      dynamics.gust=w.gust;
      dynamics.crosswind=w.windX*Math.cos(state.heading)+w.windZ*Math.sin(state.heading);
      dynamics.tailwind=w.windX*Math.sin(state.heading)-w.windZ*Math.cos(state.heading);
      if(state.mode!=='pause')rider.update(active?dt:0,active?state.speed:0,-state.steer,foliageTime.value,dynamics);
      land.update(state.x,state.z,foliageTime.value,state.speed,state.heading,rider.axles,!state.airborne&&!state.deckId);
      meadowLife.update(state.x,state.z,state.heading,state.travel,foliageTime.value,w);
      cameraPose(dt);
      camera.updateMatrix();
      weather.follow?.(rider.axles);
      orchard.update(state.x,state.z,state.time,w);
      bankTrees.update(state.x,state.z,state.time,w);
      dragon?.update(foliageTime.value);
      const windPan=-(w.windX*camera.matrix.elements[0]+w.windZ*camera.matrix.elements[2]);
      const ambience=RideAudio.environment(state.x,state.z,state.travel,rider.axles,camera,{airborne:state.airborne,stone:!!state.deckId,impact:state.landingImpulse});
      const turningCranks=!rider.motion.coasting&&Math.abs(rider.motion.cadenceRPM)>4;
      audio.update(state.speed,turningCranks,active,dynamics.gust,clamp(windPan,-1,1),w,ambience);
      if(state.time-hudAt>.4){
        region=RideWorld.zones(state.x,state.z);hudAt=state.time;
        const closeToCreek=Math.hypot(state.x-RideTrails.bridge.x,state.z-RideTrails.bridge.z)<75;
        byId('place').textContent=state.mode==='intro'?'白城骑行':state.deckId==='aqueduct'?'白石长桥':
          state.deckId==='eastwall'?'白石长城':
          closeToCreek?'溪桥河岸':
          RideOrchard.coverage(state.x,state.z)>.20?'樱花林':RideVale.bloomNear(state.x,state.z)?RideVale.bloomLandmark.name:
          RideVale.near(state.x,state.z)?RideVale.landmark.name:region.name;
        updateFork();
        byId('conditions').textContent=(phases[w.phase]||'晴')+'　·　风速 '+w.windSpeed.toFixed(1)+' m/s';
      }
      render(realDt);requestAnimationFrame(draw);
    };
    render(1/60);
    window.RideView.diagnostics=()=>({x:state.x,z:state.z,speed:state.speed,mode:state.mode,guided:state.guided,skylineReady,
      distance:state.travel,elevation:state.y,cameraDistance:changeDist,orbit:changeYaw,lookPitch:changePitch,heading:state.heading,
      effort:state.effort,grade:state.grade,steer:state.steer,yawRate:state.yawRate,acceleration:state.acceleration,
      simTime:state.time,region:region.id,route:route.id,pace:state.pace,parked:state.parked,field:RideWildfields.sample(state.x,state.z),
      onDeck:!!state.deckId||RideTrails.isDeck(state.x,state.z),stoneDeck:state.deckId,airborne:state.airborne,
      airHeight:state.airHeight,verticalSpeed:state.verticalSpeed,landingCompression:state.landingCompression,landingCount:state.landingCount,
      routeDistance:state.routeDistance,atBarrier:state.atBarrier,surface:state.airborne?'air':state.deckId?'stone':RideTrails.surfaceAt(state.x,state.z).material,
      nearFork:nearFork(),look:rider.look?.id,character:rider.character?.id,bike:rider.bike?.id,outfitter:outfitter.visible,weather:{phase:weather.state.phase,windSpeed:weather.state.windSpeed,
        windX:weather.state.windX,windZ:weather.state.windZ,rain:weather.state.rain,wetness:weather.state.wetness,
        gust:weather.state.gust,cloud:weather.state.cloud},
      gust:dynamics.gust,fieldOfView:displayedFov,cameraRoll,boomFraction:boomLimit,
      motion:rider.motion,trail:land.trailStats?.(),drawCalls:sceneDraws||renderer.info.render.calls,triangles:sceneTriangles||renderer.info.render.triangles});
    requestAnimationFrame(draw);
  }
})();
