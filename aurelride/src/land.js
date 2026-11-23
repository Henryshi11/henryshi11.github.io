/* Wind meadow and distant landscape. Coordinates are metres, with Y up. */
(function (root) {
  'use strict';

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function smooth(lo, hi, n) {
    const t = clamp((n - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
  }
  // The game samples this same moving pressure front for the cape and wind audio.
  function windAt(x,z,time) {
    return root.RideWeather.windAt(x,z,time);
  }
  function height(x, z) {
    const ridge = 24 + 9 * Math.sin(z * 0.0056) + 4 * Math.sin(z * 0.022);
    const bank = smooth(8, 140, x + 7 * Math.sin(z * 0.008)) * ridge;
    // The shoulder rises diagonally across the meadow. Its far face opens
    // into a shallow basin, then rejoins the valley floor before the gate.
    const along=-z+.36*(x-35);
    const shoulder=smooth(-50,17,x)*(1-smooth(49,116,x));
    const roll=24*smooth(165,373,along)*(1-smooth(373,554,along))
      -11*smooth(399,581,along)*(1-smooth(595,762,along));
    return root.RideWorld.relief(x,z)+bank + shoulder*roll + 2.6 * Math.sin(z * 0.015 + x * 0.008)
      + 1.8 * Math.sin(x * 0.026 - z * 0.01) + 1.15 * Math.cos(z * 0.03 + x * 0.019)
      + 0.50 * Math.sin(x * 0.052 + z * 0.036) - 1.15;
  }

  const landFunction = `
    ${root.RideWorld.terrainGLSL}
    uniform sampler2D uMeadowHeights;
    uniform vec2 uGroundCenter;
    // Project the full possible vertical interval of the basin (-25 to 115 m).
    // This rejects whole stands off screen even when riding above a ravine.
    bool outsideMeadowView(vec2 point,float radius){
      vec3 eye=(viewMatrix*vec4(point.x,45.,point.y,1.)).xyz;
      float farthest=-eye.z+70.*abs(viewMatrix[1].z)+radius;
      float nearestSide=abs(eye.x)-70.*abs(viewMatrix[1].x)-radius;
      return farthest<0. || nearestSide*projectionMatrix[0].x>farthest;
    }
    float terrainHeight(vec2 p) {
      vec2 offset=abs(p-uGroundCenter);
      float distanceToRider=max(offset.x,offset.y);
      if(distanceToRider<63.){
        vec4 levels=texture2D(uMeadowHeights,(p*.8+.5)/128.);
        vec2 decode=vec2(255.,255./256.);
        return mix(dot(levels.rg,decode),dot(levels.ba,decode),smoothstep(44.,59.,distanceToRider))-64.;
      }
      float ridge = 24.0 + 9.0*sin(p.y*0.0056) + 4.0*sin(p.y*0.022);
      float along=-p.y+.36*(p.x-35.);
      float shoulder=smoothstep(-50.,17.,p.x)*(1.-smoothstep(49.,116.,p.x));
      float roll=24.*smoothstep(165.,373.,along)*(1.-smoothstep(373.,554.,along))
        -11.*smoothstep(399.,581.,along)*(1.-smoothstep(595.,762.,along));
      return worldRelief(p)+shoulder*roll+smoothstep(8.0,140.0,p.x+7.0*sin(p.y*0.008))*ridge
        + 2.6*sin(p.y*0.015+p.x*0.008) + 1.8*sin(p.x*0.026-p.y*0.01)
        + 1.15*cos(p.y*0.03+p.x*0.019) + 0.50*sin(p.x*0.052+p.y*0.036) - 1.15;
    }
  `;
  const noiseFunctions = `
    float h21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx)*0.1031);
      p3 += dot(p3,p3.yzx+33.33);
      return fract((p3.x+p3.y)*p3.z);
    }
    float noise2(vec2 p) {
      vec2 i=floor(p), f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),
                 mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);
    }
  `;
  const meadowPaint = `
    ${root.RideWeather.glsl}
    ${root.RidePathSurface.glsl}
    ${root.RideOrchard?.shadowGLSL || 'float orchardShade(vec2 p){return 0.;}'}
    ${root.RideBankTrees?.shadowGLSL || 'float bankTreeShade(vec2 p){return 0.;}'}
    ${root.RideWildfields?.glsl || 'vec2 wildCover(vec2 p){return vec2(0.);} vec3 fieldCover(vec2 p){return vec3(0.);}'}
    float treeShade(vec2 p){return max(orchardShade(p),bankTreeShade(p));}
    float fieldLensClear(vec2 p,vec2 rider){
      vec2 delta=p-cameraPosition.xz;
      if(dot(delta,delta)>20.)return 1.;
      vec2 plants=wildCover(cameraPosition.xz);
      float cover=smoothstep(.005,.10,max(plants.x,plants.y));
      if(cover<=0.)return 1.;
      vec2 line=rider-cameraPosition.xz;float boom=max(.01,length(line));line/=boom;
      float ahead=clamp(dot(delta,line),0.,min(2.8,boom*.69));
      float gap=length(delta-line*ahead),margin=mix(1.38,.53,smoothstep(.12,2.8,ahead));
      return 1.-cover*(1.-smoothstep(.11,margin,gap));
    }
    vec3 treeLight(vec2 p){return mix(vec3(1.),vec3(.70,.76,.83),treeShade(p));}
    float wheelSight(vec2 point,vec2 axle) {
      vec2 ray=cameraPosition.xz-axle;
      float lengthRay=length(ray);
      vec2 axis=ray/max(.001,lengthRay);
      float along=dot(point-axle,axis);
      float lateral=length(point-axle-axis*clamp(along,0.,1.02));
      return (1.-smoothstep(.12,.43,lateral))*(1.-smoothstep(.79,1.15,along))
        *(1.-smoothstep(5.,6.5,lengthRay));
    }
    // The first bend of the worn singletrack follows the folding meadow.
    // It continues into the distance, independent of where the rider steers.
    float trailX(float z) {
      return -.076*z+6.*sin(z*.010)*smoothstep(155.,350.,-z)
        +1.40*sin(z*.074+.28)+.49*sin(z*.142+1.5);
    }
    float tread(vec2 p) {
      return (1.-smoothstep(.24,.81,abs(p.x-trailX(p.y))))*
        smoothstep(-460.,-385.,p.y)*(1.-smoothstep(58.,88.,p.y));
    }
    float flowerDrift(vec2 p) {
      float beds=.72*noise2(p*.083+vec2(17.,4.))+.28*noise2(p*.23-2.7);
      return smoothstep(.54,.77,beds)*(1.-.83*tread(p));
    }
    // Long connected stands with short turf in the clearings between them.
    float pastureDrift(vec2 p){
      vec2 drift=p+.1*p.yx+7.*vec2(noise2(p*.021),noise2(.023*p+4.3));
      float belt=.65*noise2(drift*vec2(.017,.026)+vec2(6.2,-3.5))
        +.28*noise2(drift*vec2(.032,.038)+vec2(-1.8,4.2))+.07*noise2(p*.084);
      // A grazed glade opens between the first bend and the gate. The banks
      // to its east and west grow tall and flower above the shorter turf.
      vec2 glade=(p-vec2(-9.,-18.))/vec2(29.,46.);
      return smoothstep(.39,.73,belt)*smoothstep(.36,1.61,length(glade));
    }
    float meadowLight(vec2 p) {
      float islands=.72*noise2(p*.019+vec2(5.7,-1.3))+.28*noise2(p*.053+1.76);
      return smoothstep(.17,.83,islands);
    }
    float meadowFacing(vec3 surfaceNormal){
      return smoothstep(.30,.94,dot(normalize(surfaceNormal),vec3(.447,.696,.563)));
    }
    float snowCover(vec2 p,float elev){
      // Snow appears strictly toward the Eastern Snow Mountain Range (+X) with soft organic drift edges,
      // keeping the west plateau free for the golden-silvergrass sea and never blocking distant vistas.
      float drift=noise2(p*.015+vec2(9.1,-4.7))*68.+noise2(p*.058+vec2(-3.2,6.4))*24.+noise2(p*.20)*7.;
      return smoothstep(145.,355.,p.x+drift);
    }
    vec3 meadowReflectance(float sun,float maturity,float stand){
      float intensity=clamp(sun,0.,1.);
      vec3 shade=vec3(.125,.285,.115);
      vec3 lamina=vec3(.385,.605,.175);
      vec3 lit=vec3(.735,.835,.255);
      vec3 pigment=mix(shade,lamina,min(1.,intensity/.50));
      pigment=mix(pigment,lit,max(0.,(intensity-.50)/.50));
      return pigment+vec3(.036,.012,-.014)*(maturity-.5)+vec3(.010,.014,.012)*stand;
    }
    float windfront(vec2 p,float time) {
      return rideWindFront(p,uWeatherTime-(uTime-time));
    }
    vec2 bendingWind(vec2 p,float time,float leaf,float noiseSeed,float gust) {
      // The base responds first. The thinner tip follows, briefly overshooting
      // the same wave after the pressure front has passed.
      float lag=.19*leaf+.045*noiseSeed;
      float secondary=sin(dot(p,vec2(.88,-.43))-(time-lag)*3.35+.52*sin(p.x*.29))*.5+.5;
      float flutter=sin((time-lag)*5.2+noiseSeed*4.1-leaf*2.0)*leaf*gust;
      vec2 wind=uWeatherWind*(.105+gust*1.32+secondary*.18)*(.48+.95*uWeatherStrength);
      return wind+vec2(-uWeatherWind.y,uWeatherWind.x)*(.09*sin(p.x*.26-time*1.31)+.082*flutter);
    }
  `;
  const regionalPlant = `
    vec3 seasonalPigment(vec3 c,vec4 zone,vec2 p){
      float value=dot(c,vec3(.24,.64,.12));
      vec3 marsh=vec3(value*.62,value*1.08,value*.72)+vec3(.005,.034,.034);
      vec3 straw=vec3(value*1.10,value*1.12,value*.72)+vec3(.036,.046,.018);
      vec3 foliage=mix(mix(c,marsh,.81*zone.z),straw,.46*zone.w);
      foliage*=mix(vec3(1.),vec3(.71,.78,.86),rideCloudShade(p))*treeLight(p);
      return foliage*mix(vec3(1.),vec3(.86,.90,.94),uWeatherWet);
    }
    float riverGrass(vec2 p){
      if(p.x< -820.||p.x> -478.)return 1.;
      vec4 r=worldChannel(p);return smoothstep(.18,2.45,abs(r.x)-r.y);
    }
  `;
  const displayColor = `
    vec3 toLinear(vec3 c) {
      return mix(c/12.92,pow((max(c,vec3(0.0))+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));
    }
  `;
  const castShadow = `
    uniform sampler2D uCyclistMask;
    uniform float uMaskStrength,uMaskSpan;
    float cyclistOcclusion(vec2 p,float heightAboveSoil) {
      vec2 q=p-uRider+vec2(-.643,-.810)*heightAboveSoil;
      if(max(abs(q.x),abs(q.y))>.5*uMaskSpan || uMaskStrength<.01)return 0.;
      vec2 uv=.5+vec2(q.x,-q.y)/uMaskSpan;
      const float spread=.0085;
      float occlusion=texture2D(uCyclistMask,uv).a*.40
        +.15*(texture2D(uCyclistMask,uv+vec2(spread,0.)).a+texture2D(uCyclistMask,uv-vec2(spread,0.)).a
        +texture2D(uCyclistMask,uv+vec2(0.,spread)).a+texture2D(uCyclistMask,uv-vec2(0.,spread)).a);
      return occlusion*uMaskStrength;
    }
    vec3 grassShadowMultiplier(vec2 p,float heightAboveSoil){
      return mix(vec3(1.),vec3(.32,.41,.46),cyclistOcclusion(p,heightAboveSoil));
    }
  `;
  function randomSequence(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function makeSwardTexture(T){
    // Rasterize a few square metres of curved leaves from above. Each texel
    // stores the slope on the visible leaf, its pigment, and its height above
    // its neighbours. Mip filtering averages light over the unresolved leaves.
    const size=512,mask=size-1,rand=randomSequence(161713);
    const depth=new Float32Array(size*size),data=new Uint8Array(size*size*4);
    for(let i=0;i<depth.length;i++){
      const v=4*i;data[v]=data[v+1]=128;data[v+2]=104;data[v+3]=57;
    }
    for(let tuft=0;tuft<3600;tuft++){
      const cx=rand()*size,cz=rand()*size,bearing=rand()*Math.PI*2;
      const mound=.002+.019*rand(),vigor=.36+.64*rand(),maturity=.22+.57*rand();
      for(let leaf=0;leaf<8;leaf++){
        const angle=bearing+(rand()-.5)*4.7,dx=Math.cos(angle),dz=Math.sin(angle);
        const rootX=cx+(rand()-.5)*9,rootZ=cz+(rand()-.5)*9;
        const length=6+(10+13*rand())*vigor,width=.50+rand()*1.18;
        const rise=.035+.094*rand(),curl=(rand()-.5)*length*.72;
        const age=Math.min(1,Math.max(0,maturity+(rand()-.5)*.34));
        for(let k=0;k<4;k++){
          const t0=k/4,t1=(k+1)/4;
          const sx=rootX+dx*length*t0-dz*curl*t0*t0,sz=rootZ+dz*length*t0+dx*curl*t0*t0;
          const ex=rootX+dx*length*t1-dz*curl*t1*t1,ez=rootZ+dz*length*t1+dx*curl*t1*t1;
          const vx=ex-sx,vz=ez-sz,inv=1/(vx*vx+vz*vz),unit=Math.sqrt(inv);
          const bound=width+1,top=Math.floor(Math.min(sz,ez)-bound),bottom=Math.ceil(Math.max(sz,ez)+bound);
          const left=Math.floor(Math.min(sx,ex)-bound),right=Math.ceil(Math.max(sx,ex)+bound);
          for(let j=top;j<=bottom;j++)for(let i=left;i<=right;i++){
            const lx=i+.5-sx,lz=j+.5-sz,s=(lx*vx+lz*vz)*inv;
            if(s<0||s>1)continue;
            const t=t0+s*.25,across=(lz*vx-lx*vz)*unit;
            const radius=width*(.69+.48*Math.sin(t*Math.PI))*(1-.966*t*t);
            const coverage=Math.min(1,radius+.48-Math.abs(across));
            if(coverage<=0)continue;
            const h=mound+rise*(t*(2.34-1.58*t))+.0015*(1-Math.min(1,Math.abs(across)/radius));
            const n=(j&mask)*size+(i&mask);
            if(h<=depth[n])continue;
            depth[n]=h;
            const slope=(.52-.75*t),fold=.31*(across>0?1:-1);
            const nx=(-vx*slope-vz*fold)*unit,nz=(-vz*slope+vx*fold)*unit;
            const p=4*n;
            data[p]+=coverage*(127.5+120*nx-data[p]);
            data[p+1]+=coverage*(127.5+120*nz-data[p+1]);
            data[p+2]+=coverage*(255*age-data[p+2]);
            data[p+3]+=coverage*(49+Math.min(201,1390*h)-data[p+3]);
          }
        }
      }
    }
    const atlas=new T.DataTexture(data,size,size,T.RGBAFormat);
    atlas.wrapS=atlas.wrapT=T.RepeatWrapping;
    atlas.minFilter=T.LinearMipmapLinearFilter;atlas.magFilter=T.LinearFilter;
    atlas.generateMipmaps=true;atlas.anisotropy=8;atlas.needsUpdate=true;
    return atlas;
  }

  function makeCanopyRelief(T){
    // Between individual leaves and whole stands is the scale of bunches:
    // overlapping fans curve into the prevailing breeze and intercept light
    // on one shoulder. Project them onto a toroidal 24-metre patch of meadow.
    const size=512,mask=size-1,metresPerPixel=24/size,rand=randomSequence(53593);
    const heights=new Float32Array(size*size);
    for(const [count,short,long,spread,rise] of [[105,.6,3.5,.44,.22],[540,.30,1.14,.47,.14],[2530,.12,.48,.49,.079]]){
      const layer=new Float32Array(heights.length);
      for(let n=0;n<count;n++){
        const x=rand()*size,z=rand()*size,k=2*Math.PI/size;
        const angle=.28+1.2*Math.sin(k*z)+.58*Math.sin(2*k*x+k*z)+(rand()-.5)*1.28;
        const ca=Math.cos(angle),sa=Math.sin(angle);
        const length=(short+(long-short)*rand())/metresPerPixel,width=length*spread*(.64+.64*rand());
        const bend=(rand()-.5)*.81,height=rise*(.6+.59*rand());
        const extent=Math.ceil(1.24*Math.hypot(length,width));
        for(let j=Math.floor(z)-extent;j<=z+extent;j++)for(let i=Math.floor(x)-extent;i<=x+extent;i++){
          const dx=i+.5-x,dz=j+.5-z;
          const u=(ca*dx+sa*dz)/length;
          if(Math.abs(u)>=1)continue;
          const v=((-sa*dx+ca*dz)/width-bend*(u*u-.19))/(1+.27*u);
          const d=u*u+v*v;
          if(d>=1)continue;
          const envelope=(1-d)*(1-d),surface=height*envelope*(1+.36*u);
          const cell=(j&mask)*size+(i&mask);
          layer[cell]=Math.max(surface,layer[cell]);
        }
      }
      for(let i=0;i<heights.length;i++)heights[i]+=layer[i];
    }
    const data=new Uint8Array(size*size*4);
    const sample=(x,z)=>heights[(z&mask)*size+(x&mask)];
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const v=j*size+i,p=4*v;
      const sx=(sample(i-1,j)-sample(i+1,j))/(2*metresPerPixel);
      const sz=(sample(i,j-1)-sample(i,j+1))/(2*metresPerPixel);
      data[p]=clamp(127.5+140*sx,0,255);
      data[p+1]=clamp(127.5+140*sz,0,255);
      data[p+2]=clamp(25+650*heights[v],0,255);
      data[p+3]=255;
    }
    const relief=new T.DataTexture(data,size,size,T.RGBAFormat);
    relief.wrapS=relief.wrapT=T.RepeatWrapping;relief.generateMipmaps=true;
    relief.minFilter=T.LinearMipmapLinearFilter;relief.magFilter=T.LinearFilter;relief.anisotropy=8;
    relief.needsUpdate=true;return relief;
  }

  function makeSnowRelief(T){
    // Wind-carved alpine snowdrifts (sastrugi) and soft powder pillow relief on a 20m tile.
    const size=512,mask=size-1,metresPerPixel=20/size,rand=randomSequence(88241);
    const heights=new Float32Array(size*size);
    for(const [count,lenMin,lenMax,aspect,amp] of [[85,2.2,6.4,.32,.26],[360,.8,2.4,.38,.13],[1600,.25,.85,.45,.055]]){
      const layer=new Float32Array(heights.length);
      for(let n=0;n<count;n++){
        const x=rand()*size,z=rand()*size,k=2*Math.PI/size;
        const angle=-.42+.35*Math.sin(k*z+k*x)+(rand()-.5)*.55;
        const ca=Math.cos(angle),sa=Math.sin(angle);
        const len=(lenMin+(lenMax-lenMin)*rand())/metresPerPixel;
        const wid=len*aspect*(.65+.7*rand());
        const rise=amp*(.55+.7*rand());
        const ext=Math.ceil(1.2*Math.hypot(len,wid));
        for(let j=Math.floor(z)-ext;j<=z+ext;j++)for(let i=Math.floor(x)-ext;i<=x+ext;i++){
          const dx=i+.5-x,dz=j+.5-z;
          const u=(ca*dx+sa*dz)/len,v=(-sa*dx+ca*dz)/wid;
          const d=u*u+v*v;if(d>=1)continue;
          // Asymmetric windward slope (steeper) and leeward tail (gentler) like real snowdrifts
          const env=(1-d)*(1-d)*(1+.42*u);
          const cell=(j&mask)*size+(i&mask);
          layer[cell]=Math.max(layer[cell],rise*env);
        }
      }
      for(let i=0;i<heights.length;i++)heights[i]+=layer[i];
    }
    const data=new Uint8Array(size*size*4);
    const sample=(x,z)=>heights[(z&mask)*size+(x&mask)];
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const v=j*size+i,p=4*v;
      const sx=(sample(i-1,j)-sample(i+1,j))/(2*metresPerPixel);
      const sz=(sample(i,j-1)-sample(i,j+1))/(2*metresPerPixel);
      const grain=(rand()-.5)*14;
      data[p]=clamp(127.5+195*sx+grain*.4,0,255);
      data[p+1]=clamp(127.5+195*sz+grain*.4,0,255);
      data[p+2]=clamp(40+540*heights[v]+grain,0,255);
      data[p+3]=255;
    }
    const tex=new T.DataTexture(data,size,size,T.RGBAFormat);
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.generateMipmaps=true;
    tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=8;
    tex.needsUpdate=true;return tex;
  }


  // World-space samples outlive the texture window. A fast turn can re-enter
  // its own trail without losing cells when the local rendering window moves.
  const tireTextureSize=512,tireCell=.14;
  function tireField(T) {
    const size=tireTextureSize,cell=tireCell,recovery=48,bucketSize=32,buckets=new Map();
    const data=new Uint8Array(size*size*4);
    const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
    texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
    const lower=new T.Vector2(), axles=[new T.Vector2(),new T.Vector2()];
    const previous=[new T.Vector2(),new T.Vector2()],inMeadow=[false,false];
    const axleGround=new T.Vector2(1,1),lastStamped=[new T.Vector2(),new T.Vector2()];
    const uniforms={uTouch:{value:texture},uTouchOrigin:{value:lower},uAxle:{value:axles},
      uLastStamped:{value:lastStamped},uAxleGround:{value:axleGround}};
    let time=0,lastUpload=-1,lastEviction=0,hasPose=false,frontMeters=0,rearMeters=0,readback=false,cellCount=0,uploads=0;
    const id=(x,z)=>x*1048576+z;
    const bucketKey=(x,z)=>id(Math.floor(x/bucketSize),Math.floor(z/bucketSize));
    function remaining(cell,now){return cell.pressure*(1-smooth(3,cell.life,now-cell.t));}
    function sweep(a,b,wheelNow,speed,seconds){
      const dx=b.x-a.x,dz=b.y-a.y,run=Math.hypot(dx,dz);
      const local=root.RideWildfields?.sample(b.x,b.y),grass=local?.grass||0,lavender=local?.lavender||0;
      const radius=.88+.26*grass+.14*lavender,life=recovery+10*grass+5*lavender;
      const denom=dx*dx+dz*dz;
      const tx=run>.012?dx/run:wheelNow.x,tz=run>.012?dz/run:wheelNow.y;
      const impulse=.96+.04*smooth(0,12,Math.abs(speed));
      for(let z=Math.floor((Math.min(a.y,b.y)-radius)/cell);z<=Math.floor((Math.max(a.y,b.y)+radius)/cell);z++){
        for(let x=Math.floor((Math.min(a.x,b.x)-radius)/cell);x<=Math.floor((Math.max(a.x,b.x)+radius)/cell);x++){
          const px=(x+.5)*cell-a.x,pz=(z+.5)*cell-a.y;
          const f=clamp((px*dx+pz*dz)/Math.max(.000001,denom),0,1);
          const lx=px-f*dx,lz=pz-f*dz,gap=Math.hypot(lx,lz);
          if(gap>=radius)continue;
          // Dual-width profile: lush wide parted grass swath (0..0.78) + razor-thin true tire centerline (0.78..0.995)!
          const wide=.78*(1-smooth(.14,radius,gap));
          const narrow=.215*(1-smooth(.02,.115,gap));
          const touch=Math.min(.995,impulse*(wide+narrow));
          const side=clamp((lx*tz-lz*tx)/.18,-1,1);
          const bx=tx*.52+tz*.90*side,bz=tz*.52-tx*.90*side;
          const fringe=1-smooth(.03,radius*.48,Math.abs(gap-radius*.54));
          const lip=fringe*(.72+.34*side*(.80*tz+.60*tx));
          const key=id(x,z),chunk=bucketKey(x,z);
          let bucket=buckets.get(chunk);
          if(!bucket){bucket={cells:new Map(),expires:0};buckets.set(chunk,bucket);}
          bucket.expires=Math.max(bucket.expires,seconds+life);
          let v=bucket.cells.get(key);
          if(!v){v={x,z,t:seconds,pressure:0,dx:bx,dz:bz,lip:0,life};bucket.cells.set(key,v);cellCount++;}
          const existing=remaining(v,seconds);
          // A second wheel may run obliquely across the first wheel's mark.
          // Keep the strongest compression while blending the lay direction.
          const mix=touch/Math.max(.001,existing*.65+touch);
          v.dx+=(bx-v.dx)*mix;v.dz+=(bz-v.dz)*mix;
          v.lip+=(lip-v.lip)*mix;v.life=life;
          v.pressure=Math.min(.985,Math.max(existing,touch)+.08*Math.min(existing,touch));v.t=seconds;
        }
      }
      return run;
    }
    function upload(x,z,seconds,speed){
      // The chase camera sees further behind the bicycle than ahead. Sample the
      // travelled side generously while keeping marks fixed to world coordinates.
      const lag=8*smooth(.5,10,Math.abs(speed));
      const ox=Math.floor((x-headingVec.x*lag)/(4*cell))*4-size/2;
      const oz=Math.floor((z-headingVec.y*lag)/(4*cell))*4-size/2;
      lower.set(ox*cell,oz*cell);data.fill(0);
      for(let bz=Math.floor(oz/bucketSize);bz<=Math.floor((oz+size-1)/bucketSize);bz++)
        for(let bx=Math.floor(ox/bucketSize);bx<=Math.floor((ox+size-1)/bucketSize);bx++){
          const bucket=buckets.get(id(bx,bz));if(!bucket)continue;
          for(const [key,v] of bucket.cells){
            if(seconds-v.t>=v.life){bucket.cells.delete(key);cellCount--;continue;}
            const i=v.x-ox,j=v.z-oz;if(i<0||j<0||i>=size||j>=size)continue;
            const k=4*(j*size+i),pressure=remaining(v,seconds);
            data[k]=Math.round(255*pressure*(.5+.5*clamp(v.dx,-1,1)));
            data[k+1]=Math.round(255*pressure*(.5+.5*clamp(v.dz,-1,1)));
            data[k+2]=Math.round(255*pressure);
            data[k+3]=Math.round(255*v.lip*(1-smooth(.38,v.life,seconds-v.t)));
          }
        }
      if(seconds-lastEviction>1){
        for(const [key,bucket] of buckets)if(seconds>=bucket.expires){
          cellCount-=bucket.cells.size;buckets.delete(key);
        }
        lastEviction=seconds;
      }
      for(let i=0;i<2;i++)lastStamped[i].copy(axles[i]);
      texture.needsUpdate=true;lastUpload=seconds;uploads++;
    }
    const headingVec=new T.Vector2();
    function update(x,z,seconds,speed,heading,hubs,touchesSoil){
      time=seconds;headingVec.set(Math.sin(heading),-Math.cos(heading));
      readback=!!(hubs&&hubs.front&&hubs.rear&&Number.isFinite(hubs.front.x+hubs.front.z+hubs.rear.x+hubs.rear.z));
      if(readback){axles[0].set(hubs.front.x,hubs.front.z);axles[1].set(hubs.rear.x,hubs.rear.z);}
      else{axles[0].set(x+.56*headingVec.x,z+.56*headingVec.y);axles[1].set(x-.55*headingVec.x,z-.55*headingVec.y);}
      for(let i=0;i<2;i++){
        const cur=axles[i],prev=previous[i];if(!hasPose)prev.copy(cur);
        if(!touchesSoil||root.RideTrails.isDeck(cur.x,cur.y)||root.RideWorld.waterDepth(cur.x,cur.y)>.015){
          prev.copy(cur);inMeadow[i]=false;continue;
        }
        if(!inMeadow[i]){prev.copy(cur);lastStamped[i].copy(cur);}
        // Once parked, live contact supports the two fixed patches without
        // continually stamping or slowly spreading the trail around them.
        if(!hasPose || !inMeadow[i] || cur.distanceToSquared(prev)>.022*.022){
          const distance=sweep(prev,cur,headingVec,speed,seconds);
          if(i===0)frontMeters+=distance;else rearMeters+=distance;
          prev.copy(cur);
        }
        inMeadow[i]=true;
      }
      axleGround.set(inMeadow[0]?1:0,inMeadow[1]?1:0);
      if(!hasPose||(cellCount&&seconds-lastUpload>=1/15-.00001))upload(x,z,seconds,speed);
      hasPose=true;
    }
    function reset(){buckets.clear();cellCount=uploads=0;data.fill(0);texture.needsUpdate=true;
      hasPose=false;inMeadow.fill(false);frontMeters=rearMeters=lastEviction=0;lastUpload=-1;}
    function sample(x,z){
      let pressure=0,dx=0,dz=0,age=null;
      const u=x/cell-.5,v=z/cell-.5,i=Math.floor(u),j=Math.floor(v);
      for(let k=0;k<4;k++){
        const sx=k&1,sz=k>>1;
        const point=buckets.get(bucketKey(i+sx,j+sz))?.cells.get(id(i+sx,j+sz));if(!point)continue;
        const weight=(sx?u-i:1-u+i)*(sz?v-j:1-v+j)*remaining(point,time);
        pressure+=weight;dx+=weight*point.dx;dz+=weight*point.dz;
        if(weight>.001)age=Math.min(age===null?Infinity:age,time-point.t);
      }
      for(let n=0;n<2;n++){
        if(!inMeadow[n])continue;const axle=axles[n];
        const live=(1-smooth(.15,.62,Math.hypot(axle.x-x,axle.y-z)))*.98;
        if(live>pressure){pressure=live;age=0;dx=live*headingVec.x*.7;dz=live*headingVec.y*.7;}
      }
      return {compression:pressure,bendX:dx,bendZ:dz,age};
    }
    const stats=()=>({activeCells:cellCount,frontMeters,rearMeters,recoverySeconds:recovery,worldAxles:readback,
      textureSpan:size*cell,uploads,uploadedBytes:uploads*data.byteLength,
      front:[axles[0].x,axles[0].y],rear:[axles[1].x,axles[1].y]});
    return {uniforms,update,reset,sample,stats};
  }

  const wheelPressure=`
    uniform sampler2D uTouch;uniform vec2 uTouchOrigin,uAxle[2],uLastStamped[2],uAxleGround;
    vec2 tireSegment(vec2 p,vec2 a,vec2 b){
      vec2 delta=b-a;
      return p-a-delta*clamp(dot(p-a,delta)/max(.00001,dot(delta,delta)),0.,1.);
    }
    vec4 wheelTrace(vec2 p){
      vec2 uv=(p-uTouchOrigin)/${(tireTextureSize*tireCell).toFixed(1)};
      if(any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998))))return vec4(0.);
      vec4 past=texture2D(uTouch,uv);
      vec2 bend=2.*past.rg-vec2(past.b);
      vec2 gap=p-uAxle[1];
      if(dot(gap,gap)>10. || max(uAxleGround.x,uAxleGround.y)<.5)return vec4(bend,past.ba);
      vec2 a=tireSegment(p,uLastStamped[0],uAxle[0]),b=tireSegment(p,uLastStamped[1],uAxle[1]);
      vec2 side=dot(a,a)+64.*(1.-uAxleGround.x)<dot(b,b)+64.*(1.-uAxleGround.y)?a:b;
      float liveWide=.78*(1.-smoothstep(.14,.68,length(side)));
      float liveNarrow=.215*(1.-smoothstep(.02,.115,length(side)));
      float live=min(.995,(liveWide+liveNarrow)*max(uAxleGround.x,uAxleGround.y));
      vec2 toward=uAxle[0]-uAxle[1];
      vec2 fresh=(toward/max(.1,length(toward))*.68+side/max(.12,length(side))*.47)*live;
      return vec4(mix(bend,fresh,smoothstep(.0,.14,live-past.b)),max(past.b,live),past.a);
    }
    vec3 wheelImprint(vec2 p){return wheelTrace(p).xyz;}
  `;

  function makeMeadow(T,scene,time,contact,soil,shadow,rider) {
    // Low-frequency drifts choose where flowers grow. A separate mipmapped
    // layer preserves those drifts far beyond the last modeled flower.
    const petals = document.createElement('canvas');
    petals.width = petals.height = 512;
    const ctx = petals.getContext('2d'), rand = randomSequence(47738);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,512,512);
    for (let group=0; group<305; group++) {
      const cx=rand()*512,cy=rand()*512,spread=3+rand()*8;
      const hue=rand()>0.28?'#fff':'#a8a8a8';
      ctx.fillStyle=hue;
      for (let j=0; j<11; j++) {
        const a=rand()*Math.PI*2,d=rand()*spread;
        const x=(cx+Math.cos(a)*d+512)%512,y=(cy+Math.sin(a)*d+512)%512;
        ctx.beginPath();
        ctx.ellipse(x,y,1.2+rand()*2.1,.96+rand()*1.34,a,0,Math.PI*2);
        ctx.fill();
      }
    }
    const bloomTexture=new T.CanvasTexture(petals);
    bloomTexture.wrapS=bloomTexture.wrapT=T.RepeatWrapping;
    bloomTexture.anisotropy=4;
    const zs=[-5200];
    function append(out,end,n){const lo=out[out.length-1];for(let k=1;k<=n;k++)out.push(lo+(end-lo)*k/n);}
    append(zs,-2650,16);append(zs,-1840,23);append(zs,1260,388);append(zs,2650,37);append(zs,5200,16);
    const rows=zs.map(z=>{
      const river=root.RideWorld.river(z),left=river.x-river.halfWidth,right=river.x+river.halfWidth;
      const xs=[-5200];
      for(const [end,n] of [[-2650,16],[-1940,14],[left-65,82],[left-9,9],[left,5],[river.x,8],[right,8],
        [right+9,5],[right+65,9],[-325,27],[460,113],[1100,37],[2650,28],[5200,16]])append(xs,end,n);
      return xs.map(x=>{const y=height(x,z),b=root.RideWorld.zones(x,z);
        return [x,y,z,b.flowers,b.river,b.plateau,Math.abs(x-river.x)-river.halfWidth];});
    });
    const turf=makeSwardTexture(T),relief=makeCanopyRelief(T),snowRelief=makeSnowRelief(T);
    const mat=new T.ShaderMaterial({
      uniforms:{...shadow,...contact,uRider:rider,uBladePaint:{value:turf},uCanopyRelief:{value:relief},uSnowRelief:{value:snowRelief},uBlooms:{value:bloomTexture},uTime:time},
      vertexShader:`attribute vec4 aZone;varying vec4 vZone;varying vec3 vPos,vNormal;varying float vWash;
        #ifdef LOCAL_MEADOW
        attribute float aCoarseY;
        uniform vec2 uGroundCenter;
        #endif
        ${noiseFunctions}
        void main(){vPos=position;vNormal=normal;vZone=aZone;
          #ifdef LOCAL_MEADOW
          vec2 groundOffset=abs(position.xz-uGroundCenter);
          vPos.y=mix(position.y,aCoarseY,smoothstep(44.,59.,max(groundOffset.x,groundOffset.y)));
          #endif
          vWash=noise2(position.xz*vec2(.007,.010)+vec2(3.8,2.1))*.75+
            noise2(position.xz*vec2(.019,.013)+1.4)*.25;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(vPos,1.0);}`,
      fragmentShader:`
        uniform sampler2D uBladePaint,uCanopyRelief,uSnowRelief,uBlooms;
        uniform vec2 uGroundCenter,uRider;
        ${castShadow}
        uniform float uTime;varying vec4 vZone;
        varying vec3 vPos,vNormal;varying float vWash;
        ${wheelPressure}${noiseFunctions}
        ${meadowPaint}
        ${root.RidePathSurface.groundGLSL}
        ${displayColor}
        void main(){
          vec2 p=vPos.xz;
          vec2 groundOffset=abs(p-uGroundCenter);
          float groundDistance=max(groundOffset.x,groundOffset.y);
          #ifdef LOCAL_MEADOW
          if(groundDistance>=60.)discard;
          #else
          if(groundDistance<60.)discard;
          #endif
          float dist=distance(cameraPosition,vPos),light=meadowLight(p);
          float face=meadowFacing(vNormal),grown=pastureDrift(p),wave=windfront(p,uTime);
          // Broad hummocks change the angle of the grass canopy in the sun.
          // Microstructure comes from one top-down optical map at a fixed
          // physical scale. Its curled leaves resolve individually only from near.
          vec2 drift=vec2(noise2(p*.044+2.),noise2(p*.041-3.));
          vec2 q=(p+3.4*drift)*.36;
          vec4 lamina=texture2D(uBladePaint,q);
          const mat2 turn=mat2(.62,.785,-.785,.62);
          vec4 under=texture2D(uBladePaint,turn*q*.67+vec2(.26,.57));
          vec2 upperNormal=lamina.rg*2.-1.,underNormal=(under.rg*2.-1.)*turn;
          vec2 leafNormal=mix(underNormal,upperNormal,.66);
          float heightInPile=mix(under.a,lamina.a,.66);
          float maturity=mix(under.b,lamina.b,.66);
          float tufts=noise2(p*.22+1.65*drift),pile=heightInPile;
          vec2 patchUv=(p+5.3*drift)/24.;
          vec3 crown=texture2D(uCanopyRelief,patchUv).rgb;
          vec3 depth=texture2D(uCanopyRelief,turn*patchUv*.69+.493).rgb;
          vec2 canopySlope=.76*(crown.rg*2.-1.)+.24*((depth.rg*2.-1.)*turn);
          float crest=mix(depth.b,crown.b,.76);
          float tuftLight=dot(canopySlope,vec2(.62,.78))*(.24+.065*grown)+(crest-.49)*.11;
          float micro=dot(leafNormal,vec2(.447,.563))*.35+(heightInPile-.55)*.28+tuftLight;
          float glint=smoothstep(.56,.90,wave)*(.038+.037*grown);
          float sun=.50+.29*(light-.48)+.47*(face-.50)+.10*(tufts-.48)-.050*grown+glint;
          vec3 base=meadowReflectance(sun+micro,maturity,grown);
          float horizon=smoothstep(32.,200.,dist);
          // Once individual flowers fall below a pixel only the warm colour
          // of a flowering bed should remain. Leave the visible heads to geometry.
          float flowers=flowerDrift(p)*(1.+vZone.x*.6)*(1.-.62*vZone.z);
          float blooms=texture2D(uBlooms,p*.12+.17).r;
          base=mix(base,vec3(.84,.836,.58),blooms*flowers*(.18+.12*horizon));
          float tone=clamp(dot(base,vec3(.26,.62,.12)),0.,1.);
          vec3 gold=mix(vec3(.311,.411,.147),vec3(.862,.847,.443),smoothstep(.12,.76,tone));
          vec3 fern=mix(vec3(.103,.245,.156),vec3(.503,.681,.326),smoothstep(.10,.73,tone));
          base=mix(base,fern,vZone.y*.72);base=mix(base,gold,vZone.z*.46);
          float bars=1.-smoothstep(-.4,2.9,vZone.w);
          if(bars>.001){
            float sand=texture2D(uBladePaint,p*.49).r;
            float fleck=noise2(p*4.63+noise2(p*.77)*2.3);
            vec3 gravel=mix(vec3(.296,.329,.257),vec3(.660,.654,.489),sand*.49+fleck*.51);
            base=mix(base,gravel,bars);
          }
          vec3 wild=fieldCover(p);
          if(max(max(wild.r,wild.g),wild.b)>.003){
            float grain=.54*tufts+.26*vWash+.20*pile;
            vec3 straw=mix(vec3(.38,.414,.16),vec3(.759,.735,.39),grain+.16*wave);
            vec3 sage=mix(vec3(.24,.335,.28),vec3(.48,.537,.40),grain);
            float distant=smoothstep(12.,118.,dist);
            vec3 buds=mix(vec3(.350,.267,.494),vec3(.615,.493,.745),grain);
            vec3 leafbed=mix(vec3(.31,.42,.18),vec3(.49,.59,.22),grain);
            vec3 corollas=mix(vec3(.88,.68,.12),vec3(1.,.89,.32),clamp(grain+.25*wave,0.,1.));
            base=mix(base,mix(leafbed,corollas,.17+.77*distant),wild.b*.98);
            base=mix(base,straw,wild.r*(.36+.42*distant));
            base=mix(base,mix(sage,buds,distant*(.53+.39*tufts)),wild.g*(.60+.39*distant));
          }
          vec4 path=footpath(p);
          path.x*=smoothstep(-.04,1.25,vZone.w);
          base=pathGround(base,path,p,light,face,dist);
          // Soft pink-and-white fallen cherry petal drift blanket beneath the cherry orchard!
          float orchardCov=orchardWoodland(p);
          if(orchardCov>.04){
            float pCluster=noise2(p*.32+vec2(4.2,-1.9))*.6+noise2(p*1.45)*.4;
            float petalSpec=smoothstep(.44,.82,noise2(p*3.9+vec2(1.7,5.3)));
            float driftPetals=smoothstep(.06,.55,orchardCov)*smoothstep(.32,.78,pCluster)*(.38+.62*petalSpec);
            vec3 petalCol=mix(vec3(.99,.82,.88),vec3(1.0,.96,.98),petalSpec);
            base=mix(base,petalCol,driftPetals*.68);
          }
          // Sunlit champagne-silver shimmer across the western silvergrass plateau
          if(vZone.z>.05){
            float silverWave=smoothstep(.45,.90,wave)*(.45+.55*noise2(p*.09+vec2(1.5,2.8)));
            base=mix(base,vec3(.88,.86,.72),vZone.z*silverWave*.32);
          }
          vec3 daylight=mix(vec3(1.),vec3(.69,.76,.86),rideCloudShade(p))*treeLight(p);
          daylight*=mix(vec3(1.),vec3(.85,.89,.92),uWeatherWet);
          base*=daylight;
          // High-altitude alpine snow: baked 2-layer wind-carved sastrugi relief normals,
          // exposed steep cold alpine rock ridges, deep glacial cobalt shadows, and crystal sparkle.
          float rawSnow=snowCover(p,vPos.y);
          float steepness=1.-vNormal.y;
          float rockOutcrop=smoothstep(.16,.44,steepness)*smoothstep(.18,.58,rawSnow);
          float snowMask=rawSnow*(1.-.85*rockOutcrop);
          float snow=smoothstep(.04,.88,snowMask);
          if(rawSnow>.005){
            vec2 sUv1=p/20.;
            vec2 sUv2=turn*p/7.4+vec2(.31,.67);
            vec3 sr1=texture2D(uSnowRelief,sUv1).rgb;
            vec3 sr2=texture2D(uSnowRelief,sUv2).rgb;
            vec2 slope1=sr1.rg*2.-1.;
            vec2 slope2=(sr2.rg*2.-1.)*turn;
            vec2 snowSlope=slope1*.72+slope2*.38;
            float snowCrest=sr1.b*.68+sr2.b*.32;
            vec3 snowN=normalize(vNormal+vec3(snowSlope.x*.95,0.,snowSlope.y*.95));
            vec3 sunDir=normalize(vec3(.447,.696,.563));
            vec3 viewDir=normalize(cameraPosition-vPos);
            float nd=dot(snowN,sunDir);
            float wrap=smoothstep(-.38,.86,nd);
            // Soft powder velvet rim + subsurface cyan-blue glow in shadow hollows
            float rim=pow(1.-max(0.,dot(snowN,viewDir)),2.4)*smoothstep(.05,.82,nd);
            float hollow=smoothstep(.65,.18,snowCrest);
            vec3 snowDeep=mix(vec3(.36,.57,.88),vec3(.29,.49,.82),hollow);
            vec3 snowMid=vec3(.78,.89,.99);
            vec3 snowLit=vec3(1.0,.995,.985);
            vec3 snowCol=mix(snowDeep,snowMid,smoothstep(0.,.50,wrap));
            snowCol=mix(snowCol,snowLit,smoothstep(.38,1.,wrap));
            snowCol+=vec3(.075,.065,.035)*rim + vec3(.045,.055,.07)*(snowCrest-.48);
            // Dual-scale sun-glinting snow crystals shifting with view angle
            float sp1=pow(h21(floor(p*11.)+floor(cameraPosition.xz*.35)),19.);
            float sp2=pow(h21(floor(p*5.5)+floor(cameraPosition.xz*.2)),21.);
            float sparkle=(sp1*.85+sp2*.65)*smoothstep(.30,.85,nd)*(1.-smoothstep(5.,48.,dist));
            snowCol+=vec3(1.0,.99,.94)*sparkle*1.35;
            snowCol*=daylight;
            // Steep cold blue-slate alpine rock peeking through deep snowdrifts
            if(rockOutcrop>.01){
              float rockTex=noise2(p*.65)*.55+noise2(p*2.4)*.45;
              vec3 rockCol=mix(vec3(.18,.26,.42),vec3(.44,.52,.66),smoothstep(.15,.85,rockTex*face+.25))*daylight;
              base=mix(base,rockCol,rockOutcrop*.92);
            }
            float frostEdge=smoothstep(.02,.32,snow)*(1.-smoothstep(.32,.78,snow));
            base=mix(base,mix(base*vec3(.88,.94,1.0),vec3(.84,.91,.98)*daylight,.52),frostEdge);
            base=mix(base,snowCol,smoothstep(.10,.86,snow));
          }
          vec4 impression=wheelTrace(p);
          if(impression.z>.005||impression.w>.005){
            float available=(1.-path.w)*(1.-.83*path.x);
            // Wide, lush parted swath for regular green meadow & tall flowerbeds
            float core=smoothstep(.10,.74,impression.z);
            vec2 along=normalize(impression.xy+vec2(.00001));
            vec2 across=vec2(-along.y,along.x);
            vec2 layUV=vec2(dot(p,across),dot(p,along))*vec2(.58,.31);
            vec4 bent=texture2D(uBladePaint,layUV);
            float polish=.095*(bent.a-.51)+.048*(bent.r-.5);
            vec2 laidNormal=(bent.r-.5)*across+(bent.g-.5)*along;
            // 1. Default lush meadow track: deep emerald-olive parted core + golden-green sunlit shoulder
            vec3 pressed=meadowReflectance(.12+.16*sun+.44*dot(laidNormal,vec2(.62,.78))+.19*tuftLight,bent.b,grown)*vec3(.75,.85,.70)+vec3(polish);
            vec3 edgeGlow=vec3(.115,.130,.052);
            // 2. Purple Lavender track: deep plum-violet crushed stems + pale lilac scattered petals on edges
            if(wild.g>.05){
              vec3 lavCore=mix(vec3(.24,.17,.36),vec3(.40,.34,.50),bent.a);
              pressed=mix(pressed,lavCore,smoothstep(.05,.45,wild.g));
              edgeGlow=mix(edgeGlow,vec3(.20,.12,.26),smoothstep(.05,.45,wild.g));
            }
            // 3. Yellow Canola track: dark forest-olive crushed stalks + bright golden-yellow fallen petal rims
            if(wild.b>.05){
              vec3 canCore=mix(vec3(.21,.34,.13),vec3(.44,.52,.18),bent.a);
              pressed=mix(pressed,canCore,smoothstep(.05,.45,wild.b));
              edgeGlow=mix(edgeGlow,vec3(.32,.26,.04),smoothstep(.05,.45,wild.b));
            }
            // 4. Western Silvergrass Sea track: flattened warm champagne-straw lane + pale silver edges
            if(vZone.z>.12){
              vec3 silCore=mix(vec3(.48,.46,.28),vec3(.72,.68,.46),bent.a);
              pressed=mix(pressed,silCore,smoothstep(.12,.55,vZone.z));
              edgeGlow=mix(edgeGlow,vec3(.20,.19,.13),smoothstep(.12,.55,vZone.z));
            }
            // 5. Cherry Petal Blanket track: tire sweeps petals aside to reveal cool damp green grass + pink petal ridges on sides!
            if(orchardCov>.08){
              float petW=smoothstep(.08,.48,orchardCov);
              vec3 dampGrass=mix(vec3(.18,.31,.15),vec3(.30,.44,.22),bent.a);
              pressed=mix(pressed,dampGrass,petW*.92);
              edgeGlow=mix(edgeGlow,vec3(.34,.14,.20),petW);
            }
            pressed*=daylight;
            float vegAmt=available*core*(.94+.05*tufts)*(1.-snow);
            base=mix(base,pressed,vegAmt);
            base+=edgeGlow*daylight*available*impression.w*(1.-.62*core)*(1.-snow);
            // 6. Eastern Snowfield track: RAZOR-THIN true single bicycle tire width (~13cm) cool cobalt groove + crisp thin snow rim!
            if(snow>.01){
              float narrowRut=smoothstep(.825,.935,impression.z);
              float narrowRim=smoothstep(.73,.83,impression.z)*(1.-narrowRut);
              vec3 snowRutCol=mix(vec3(.42,.62,.87),vec3(.58,.75,.94),bent.a)*daylight;
              base=mix(base,snowRutCol,available*narrowRut*snow*.95);
              base+=vec3(.14,.16,.19)*daylight*available*narrowRim*snow;
            }
          }
          base=mix(base,vec3(.56,.68,.46),smoothstep(260.,1650.,dist)*.48*(1.-snow));
          base=mix(base,vec3(.63,.70,.76),smoothstep(95.,1370.,dist)*uWeatherHaze*.72);
          base*=grassShadowMultiplier(p,0.);
          gl_FragColor=vec4(toLinear(base),1.0);
          #include <colorspace_fragment>
        }`
    });
    // Break up the large terrain into cullable pieces. Rows follow the actual
    // water edge, with five close contour samples on either bank and a dense bed.
    const cols=rows[0].length;
    for(let j=0;j<rows.length-1;j+=36)for(let i=0;i<cols-1;i+=40){
      const top=Math.min(rows.length-1,j+36),right=Math.min(cols-1,i+40),stride=right-i+1;
      const pos=[],norm=[],zones=[],idx=[];
      for(let k=j;k<=top;k++)for(let l=i;l<=right;l++){
        const [x,y,z,flowers,river,plateau,shore]=rows[k][l];pos.push(x,y,z);zones.push(flowers,river,plateau,shore);
        // Central differences compensate for oblique grid rows along the river.
        const a=rows[k][Math.max(0,l-1)],b=rows[k][Math.min(cols-1,l+1)];
        const c=rows[Math.max(0,k-1)][l],d=rows[Math.min(rows.length-1,k+1)][l];
        const dx=(b[1]-a[1])/(b[0]-a[0]),dz=(d[1]-c[1]-dx*(d[0]-c[0]))/(d[2]-c[2]);
        const len=Math.hypot(dx,1,dz);norm.push(-dx/len,1/len,-dz/len);
        if(k<top&&l<right){const n=(k-j)*stride+l-i;idx.push(n,n+stride,n+1,n+1,n+stride,n+stride+1);}
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
      g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('aZone',new T.Float32BufferAttribute(zones,4));g.setIndex(idx);g.computeBoundingSphere();
      const mesh=new T.Mesh(g,mat);mesh.name='Meadow and riverbed';scene.add(mesh);
    }
    mat.uniforms.uGroundCenter=soil.uGroundCenter;
    return root.RideTerrainDetail(T,scene,mat,rows,height,soil);
  }

  function createSky(T, scene) {
    const mat=new T.ShaderMaterial({
      side:T.BackSide,depthWrite:false,fog:false,uniforms:root.RideWeather.uniforms(T),
      vertexShader:`varying vec3 vRay;
        void main(){
          vRay=position;
          vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);
          gl_Position=clip.xyww;
        }`,
      fragmentShader:`varying vec3 vRay;${root.RideWeather.glsl}
        ${displayColor}
        float cloudLobe(vec2 p,vec2 center,vec2 radius){
          vec2 t=(p-center)/radius;
          return 1.-dot(t,t);
        }
        vec3 southernBank(vec3 sky,vec3 ray){
          vec2 axis=normalize(vec2(-.43,.90));
          float forward=dot(ray.xz,axis);
          if(forward<.79||ray.y>.34)return sky;
          vec2 q=vec2(dot(ray.xz,vec2(axis.y,-axis.x)),ray.y)/forward;
          q-=vec2(-.011+.014*sin(uWeatherTime*.013),.111);
          if(abs(q.x)>.51||q.y<-.055||q.y>.19)return sky;
          vec2 flow=uWeatherDrift*.000023;
          vec2 wav=texture2D(uWeatherMap,q*vec2(1.9,3.)+vec2(.24,.54)-flow).rg-.5;
          vec2 p=q+vec2(wav.y*.038,wav.x*.045);
          float low=cloudLobe(p,vec2(-.051,.010),vec2(.341,.032));
          float left=cloudLobe(p,vec2(-.191,.044),vec2(.089,.056));
          float cap=cloudLobe(p,vec2(-.097,.072),vec2(.098,.079));
          float fold=cloudLobe(p,vec2(-.003,.040),vec2(.077,.047));
          float downwind=cloudLobe(p,vec2(.108,.025),vec2(.114,.035));
          float mass=max(max(low,left),max(max(cap,fold),downwind));
          float edge=smoothstep(-.10,.20,mass)*smoothstep(-.033,-.015,p.y);
          float relief=.26+.53*smoothstep(-.014,.070,p.y)+.22*wav.y
            +.18*(1.-smoothstep(.02,.78,cap))*smoothstep(.043,.088,p.y);
          vec3 lit=mix(vec3(.744,.804,.868),vec3(.982,.982,.964),clamp(relief,0.,1.));
          return mix(sky,lit,edge*.88*(1.-.80*uWeatherCloud));
        }
        vec3 horizonClouds(vec3 sky,vec3 ray){
          float az=atan(ray.x,-ray.z);
          float h=ray.y;
          if(h<-.02||h>.48)return sky;
          // 360-degree sunlit cumulus bank ringing the distant mountains & framing the White City.
          float drift=uWeatherTime*.0045;
          vec2 cuv=vec2(az*.42+drift,h*2.9);
          float c1=texture2D(uWeatherMap,cuv*vec2(.85,.65)+vec2(.12,.31)).r;
          float c2=texture2D(uWeatherMap,cuv*vec2(1.9,1.4)+vec2(.57,.18)-vec2(drift*.4,0.)).g;
          float band=smoothstep(.005,.095,h)*(1.-smoothstep(.15,.36,h));
          float puffs=smoothstep(.46,.76,c1*.66+c2*.34+.14*sin(az*3.+1.1));
          float alpha=puffs*band*.86;
          float litTop=smoothstep(.04,.24,h)+.22*(c2-.45);
          vec3 cloudShadow=vec3(.58,.73,.93);
          vec3 cloudBright=vec3(.99,.995,1.0);
          vec3 cloudCol=mix(cloudShadow,cloudBright,clamp(.35+.65*litTop,0.,1.));
          sky=mix(sky,cloudCol,alpha);
          // Delicate high-altitude wispy cirrus streaks across the upper cobalt sky.
          if(h>.14){
            vec2 wuv=vec2(az*.35+drift*.6,h*1.8);
            float wisp=texture2D(uWeatherMap,wuv*vec2(1.6,3.2)+vec2(.33,.71)).g;
            float wMask=smoothstep(.58,.86,wisp)*smoothstep(.14,.26,h)*(1.-smoothstep(.32,.47,h));
            sky=mix(sky,vec3(.93,.96,1.0),wMask*.38);
          }
          return sky;
        }
        void main(){
          vec3 ray=normalize(vRay);
          float h=max(ray.y,0.);
          // Clear air deepens toward the zenith and away from the fixed Southeast world sun (+141°),
          // adding a subtle warm solar sky glow in the Southeast so 360° lighting feels physically grounded!
          vec3 worldSun=normalize(vec3(.447,.696,.563));
          float sunAlign=max(0.,dot(ray,worldSun));
          float northLight=clamp(.5-.5*dot(ray.xz,normalize(vec2(.62,.78))),0.,1.);
          vec3 azurite=mix(vec3(.245,.565,.955),vec3(.135,.385,.925),northLight);
          vec3 sky=mix(vec3(.605,.785,.975),azurite,smoothstep(-.025,.28,h));
          sky=mix(sky,vec3(.065,.235,.795),smoothstep(.20,.88,h));
          sky+=vec3(.26,.22,.12)*pow(sunAlign,7.)*.42 + vec3(.65,.58,.42)*pow(sunAlign,64.)*.55;
          sky=horizonClouds(sky,ray);
          sky=southernBank(sky,ray);
          sky=rideCloudSky(sky,ray,cameraPosition);
          gl_FragColor=vec4(toLinear(sky),1.);
          #include <colorspace_fragment>
        }`
    });
    const sky=new T.Mesh(new T.SphereGeometry(1,36,20),mat);
    sky.frustumCulled=false;sky.renderOrder=-100;sky.name='Open daylight';
    scene.add(sky);
  }

  function tilePool(T,scene,geometry,material,tileSize,rows,name,usePoints) {
    const meshes=[],half=(rows-1)>>1;
    geometry.boundingSphere=new T.Sphere(new T.Vector3(),tileSize*.94+1.5);
    for(let i=0;i<rows*rows;i++) {
      const mesh=usePoints?new T.Points(geometry,material):new T.Mesh(geometry,material);
      mesh.name=name;scene.add(mesh);meshes.push(mesh);
    }
    let lastA=Infinity,lastB=Infinity;
    return function placeTiles(x,z) {
      const a=Math.floor(x/tileSize+.5),b=Math.floor(z/tileSize+.5);
      if(a===lastA&&b===lastB)return;
      lastA=a;lastB=b;
      let i=0;
      for(let j=-half;j<=half;j++)for(let k=-half;k<=half;k++,i++){
        const tx=a+k,tz=b+j,px=tx*tileSize,pz=tz*tileSize;
        const mesh=meshes[i];
        const variant=(Math.imul(tx,73)^Math.imul(tz,237))>>>0;
        mesh.rotation.y=(variant%4)*Math.PI*.5;
        mesh.position.set(px,height(px,pz),pz);
      }
    };
  }

  // Fine oat panicles on the plateau and rust-tipped bulrushes along a narrow
  // strip on either bank. Roots are fixed in the landscape at all view angles.
  function regionalStems(T,scene,rider,time,track,shadow,rand){
    const pos=[],marks=[],indices=[];
    function blade(angle,ox,oz,height,width,bow,type){
      const n=pos.length/3,dx=Math.cos(angle),dz=Math.sin(angle);
      const rows=type===1?[[0,.42],[.54,.42],[.76,.74],[.83,2.0],[.98,1.6],[1.02,.12]]:
        [[0,.43],[.28,.95],[.58,1.],[.82,.55],[1.,.012]];
      for(let i=0;i<rows.length;i++){
        const [t,w]=rows[i];const bend=bow*t*t;
        for(const side of [-1,1]){
          pos.push(ox+dx*bend-dz*side*w*width,height*t,oz+dz*bend+dx*side*w*width);
          marks.push(t,side,type);
        }
        if(i){const k=n+2*i;indices.push(k-2,k,k-1,k-1,k,k+1);}
      }
    }
    for(let k=0;k<6;k++){
      const a=k*2.4,r=.06+rand()*.22;
      blade(a,Math.cos(a)*r,Math.sin(a)*r,.50+rand()*.46,.014+rand()*.023,.19+rand()*.22,0);
    }
    for(let k=0;k<3;k++){
      const a=.5+k*2.13,r=.08+rand()*.18;
      blade(a,Math.cos(a)*r,Math.sin(a)*r,1.04+rand()*.23,.0088,.09+rand()*.18,1);
    }
    const perf=globalThis.RidePerf||{};
    const g=new T.InstancedBufferGeometry(),roots=[],seeds=[],grid=perf.isEco?64:83;
    for(let i=0;i<grid*grid;i++){
      roots.push(((i%grid+rand())/grid-.5)*118,((Math.floor(i/grid)+rand())/grid-.5)*118);
      const a=rand()*Math.PI*2;seeds.push(Math.cos(a),Math.sin(a),rand(),rand());
    }
    const totalInst=grid*grid;
    for(let k=totalInst-1;k>0;k--){
      const j=Math.floor(rand()*(k+1));
      let rx=roots[k*2],rz=roots[k*2+1];
      roots[k*2]=roots[j*2];roots[k*2+1]=roots[j*2+1];roots[j*2]=rx;roots[j*2+1]=rz;
      for(let m=0;m<4;m++){const tmp=seeds[k*4+m];seeds[k*4+m]=seeds[j*4+m];seeds[j*4+m]=tmp;}
    }
    g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);
    g.setAttribute('aForm',new T.Float32BufferAttribute(marks,3));
    g.setAttribute('aSeed',new T.InstancedBufferAttribute(new Float32Array(seeds),4));
    g.setAttribute('aRoot',new T.InstancedBufferAttribute(new Float32Array(roots),2));g.instanceCount=totalInst;
    if(perf.registerScalable)perf.registerScalable(g,totalInst,.55);
    const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{uRider:rider,uTime:time,...track,...shadow},
      vertexShader:`attribute vec2 aRoot;attribute vec4 aSeed;attribute vec3 aForm;uniform float uTime;uniform vec2 uRider;
        varying vec3 vColour;${landFunction}${noiseFunctions}${meadowPaint}${wheelPressure}${castShadow}
        void main(){
          vec2 center=uRider+mod(aRoot-uRider+59.,118.)-59.;float d=length(center-uRider);
          vec4 channel=worldChannel(center);float edge=abs(channel.x)-channel.y;
          float marsh=smoothstep(-.8,1.2,edge)*(1.-smoothstep(6.,15.,edge));
          float oasis=smoothstep(.30,.71,noise2(center*.12)+noise2(center*.58)*.16);
          float upland=worldBiomes(center).w;
          float high=clamp(upland-.22,0.,1.)*smoothstep(.26,.68,noise2(center*vec2(.055,.082)));
          float available=max(marsh*oasis,high*1.05);
          float fade=(1.-smoothstep(42.,62.,d))*smoothstep(aSeed.w-.12,aSeed.w+.12,available)*footpathGrass(footpath(center));
          if(fade<.08){gl_Position=vec4(2.,2.,2.,1.);return;}
          float w=windfront(center,uTime-.25*aForm.x),size=mix(1.18,1.15,marsh)*(.78+.58*aSeed.z)*fade*fieldLensClear(center,uRider);
          vec3 pressure=wheelImprint(center);float t=aForm.x;
          vec2 dir=uWeatherWind*(.08+.62*w)*(.52+.95*uWeatherStrength)*(1.-.72*pressure.z)+pressure.xy*1.05;
          vec2 p=center+mat2(aSeed.x,aSeed.y,-aSeed.y,aSeed.x)*position.xz*size+dir*t*t*size;
          float crush=smoothstep(.08,.80,pressure.z);
          float h=position.y*size*(1.-.16*t*w)*(1.-.963*crush);
          // Luminous silver-champagne tall silvergrass sea on the western upland plateau!
          vec3 colour=mix(vec3(.52,.54,.30),vec3(.19,.421,.244),marsh)+vec3(.28,.27,.18)*t;
          if(aForm.z>.5 && t>.68){
            vec3 silverPlume=mix(vec3(.86,.82,.64),vec3(1.0,.99,.93),smoothstep(.68,.98,t)*(.65+.35*w));
            vec3 reed=mix(vec3(.35,.255,.165),vec3(.539,.386,.22),.60*aSeed.z+.38*t);
            colour=mix(silverPlume,reed,marsh);
          }
          colour*=(.93+.07*aForm.y+.10*w*t)*(1.-.46*crush);
          colour*=mix(vec3(1.),vec3(.70,.77,.86),rideCloudShade(p))*treeLight(p);
          colour*=grassShadowMultiplier(p,h);
          vColour=colour;gl_Position=projectionMatrix*viewMatrix*vec4(p.x,terrainHeight(center)-.04+h,p.y,1.);
        }`,fragmentShader:`varying vec3 vColour;${displayColor}
        void main(){gl_FragColor=vec4(toLinear(vColour),1.);
          #include <colorspace_fragment>
        }`});
    const mesh=new T.Mesh(g,material);mesh.name='Reeds and upland silvergrass';mesh.frustumCulled=false;scene.add(mesh);
    return (x,z)=>{const center=root.RideWorld.river(z);mesh.visible=Math.abs(x-center.x)<center.halfWidth+85 || root.RideWorld.zones(x,z).plateau>.12;};
  }

  function vegetation(T,scene,rider,time,track,shadow) {
    const rand=randomSequence(37019);
    root.RideMeadowTufts(T,scene,rider,time,{...track,...shadow},
      {pressure:wheelPressure,land:landFunction,noise:noiseFunctions,paint:meadowPaint,
        regional:regionalPlant,shadow:castShadow,display:displayColor},rand);
    const flowers=flowerHeads(T,scene,rider,time,track,rand,shadow);
    const stems=regionalStems(T,scene,rider,time,track,shadow,rand);
    return (x,z)=>{flowers(x,z);stems(x,z);};
  }

  function flowerHeads(T,scene,rider,time,track,rand,shadow) {
    // Tiny clusters share the direction and timing of the grass. Groups are
    // seeded in world coordinates and grow thick along the inner field margin.
    const tile=13, pos=[], buds=[];
    for(let i=0;i<193;i++){
      const x=(rand()-.5)*(tile-.4),z=(rand()-.5)*(tile-.4);
      const seed=rand(),tone=rand(),span=.09+rand()*.21;
      for(let j=0;j<8;j++){
        const a=rand()*Math.PI*2,r=span*Math.sqrt(rand());
        pos.push(x+r*Math.cos(a),.18+rand()*.125,z+r*Math.sin(a));
        buds.push(.013+rand()*.018+(i%7===0?.008:0),seed,tone,rand());
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    g.setAttribute('aBud',new T.Float32BufferAttribute(buds,4));
    const pixels={value:720};
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{uRider:rider,uTime:time,uPixels:pixels,...track,...shadow},
      vertexShader:`attribute vec4 aBud;uniform vec2 uRider;uniform float uTime,uPixels;${wheelPressure}
        varying vec4 vBloom;varying float vTwist;
        ${landFunction}${noiseFunctions}${meadowPaint}${regionalPlant}${castShadow}
        void main(){
          vec2 p=(modelMatrix*vec4(position.x,0.,position.z,1.)).xz;
          vec4 zone=worldBiomes(p);
          float drift=clamp(flowerDrift(p)*(1.+.95*zone.y)+zone.y*.19,0.,1.)*(1.-.75*zone.w),d=length(p-uRider);
          vec2 wild=wildCover(p);
          float count=smoothstep(aBud.y-.04,aBud.y+.04,.045+smoothstep(.28,.78,drift)*.82)*(1.-smoothstep(26.,35.,d))*(1.-.94*max(wild.r,wild.g));
          count*=1.-.91*orchardWoodland(p);
          float pathHeight=footpathGrass(footpath(p))*fieldLensClear(p,uRider);
          float soilY=terrainHeight(p);
          count*=riverGrass(p)*pathHeight*(1.-smoothstep(.12,.45,snowCover(p,soilY))); if(count<.02){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;return;}
          float w=windfront(p,uTime-.23),h=position.y*(1.-.86*tread(p))*pathHeight;
          vec3 imprint=wheelImprint(p);
          float press=smoothstep(.08,.80,imprint.z);
          if(d<2.15)h*=1.-.94*max(uAxleGround.x*wheelSight(p,uAxle[0]),uAxleGround.y*wheelSight(p,uAxle[1]));
          float y=terrainHeight(p)+h*(1.-.18*w)*(1.-.969*press);
          p+=h*(bendingWind(p,uTime,.95,aBud.w,w)*.64*(1.-.72*press)+imprint.xy*1.17);
          vec4 view=viewMatrix*vec4(p.x,y,p.y,1.);
          float diameter=aBud.x*projectionMatrix[1][1]*uPixels/max(.35,-view.z);
          gl_PointSize=clamp(diameter,1.,16.);
          vec3 color=mix(vec3(.82,.714,.32),vec3(.918,.913,.746),smoothstep(.07,.46,aBud.z));
          float bands=noise2(p*vec2(.038,.024));
          vec3 meadowFlower=mix(vec3(.84,.687,.981),vec3(.973,.699,.692),smoothstep(.48,.71,bands));
          meadowFlower=mix(meadowFlower,vec3(.998,.905,.502),smoothstep(.67,.80,aBud.z));
          color=mix(color,meadowFlower,zone.y*(.74+.26*step(.24,aBud.z)));
          color*=mix(vec3(1.),vec3(.74,.79,.89),rideCloudShade(p))*treeLight(p)*(.92+.08*meadowLight(p));
          color*=grassShadowMultiplier(p,h);
          vBloom=vec4(color,count*min(1.,diameter*diameter)*(.96-.91*press));
          vTwist=aBud.w*6.28318;gl_Position=projectionMatrix*view;
        }`,
      fragmentShader:`varying vec4 vBloom;varying float vTwist;${displayColor}
        void main(){
          vec2 p=(gl_PointCoord*2.-1.)*vec2(1.,1.24);
          float l=length(p),rim=.76+.085*cos(5.*atan(p.y,p.x)+vTwist);
          float a=vBloom.a*(1.-smoothstep(rim-.19,rim+.15,l));if(a<.026)discard;
          vec3 c=mix(vBloom.rgb*vec3(.93,.87,.71),vBloom.rgb,smoothstep(.06,.45,l));
          gl_FragColor=vec4(toLinear(c),a);
          #include <colorspace_fragment>
        }`});
    const scratch=new T.Vector2();
    mat.onBeforeRender=renderer=>{const target=renderer.getRenderTarget();
      pixels.value=target?target.height:renderer.getDrawingBufferSize(scratch).y;};
    return tilePool(T,scene,g,mat,tile,5,'Cream wildflowers along the track',true);
  }

  function alpineSnowAtmosphere(T,scene,time){
    // 1. Drifting alpine snowflakes when riding in high cold elevations (>22m)
    const rand=randomSequence(73911);
    const flakeCount=360,flakePos=new Float32Array(flakeCount*3),flakeSeed=new Float32Array(flakeCount*4);
    for(let i=0;i<flakeCount;i++){
      flakeSeed.set([rand(),rand(),rand(),rand()],i*4);
    }
    const flakeGeo=new T.BufferGeometry();
    flakeGeo.setAttribute('position',new T.BufferAttribute(flakePos,3));
    flakeGeo.setAttribute('aSeed',new T.BufferAttribute(flakeSeed,4));
    const uSnowAmt={value:0},uRear={value:new T.Vector3()},uBack={value:new T.Vector2(0,1)},uBikeSpeed={value:0};
    const flakeMat=new T.ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{uTime:time,uSnowAmt},
      vertexShader:`
        attribute vec4 aSeed;
        uniform float uTime,uSnowAmt;
        varying float vAlpha;
        void main(){
          if(uSnowAmt<.01){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;vAlpha=0.;return;}
          vec3 vol=vec3(36.,18.,36.);
          vec3 drift=vec3(uTime*(1.6+aSeed.w*1.2)+sin(uTime*1.3+aSeed.x*12.)*1.2,-uTime*(1.8+aSeed.y*1.4),uTime*(.8+aSeed.z));
          vec3 delta=mod(aSeed.xyz*vol+drift-cameraPosition+.5*vol,vol)-.5*vol;
          vec3 world=cameraPosition+delta;
          vec4 view=viewMatrix*vec4(world,1.);
          float fade=smoothstep(1.2,4.5,length(delta))*(1.-smoothstep(12.,17.,length(delta.xz)));
          vAlpha=uSnowAmt*fade*(.55+.45*aSeed.w);
          gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((2.8+4.2*aSeed.w)*projectionMatrix[1][1]*320./max(1.,-view.z),1.5,6.5);
        }`,
      fragmentShader:`
        varying float vAlpha;
        void main(){
          float r=length(gl_PointCoord*2.-1.);
          float a=vAlpha*(1.-smoothstep(.25,1.,r));
          if(a<.01)discard;
          gl_FragColor=vec4(.95,.98,1.,a);
          #include <colorspace_fragment>
        }`
    });
    const flakes=new T.Points(flakeGeo,flakeMat);
    flakes.name='Alpine falling snow';flakes.frustumCulled=false;flakes.renderOrder=7;
    scene.add(flakes);

    // 2. Crisp white powder snow mist kicked up behind the rear wheel in snow zones
    const sprayCount=96,sprayPos=new Float32Array(sprayCount*3),spraySeed=new Float32Array(sprayCount*4);
    for(let i=0;i<sprayCount;i++)spraySeed.set([rand(),rand(),rand(),rand()],i*4);
    const sprayGeo=new T.BufferGeometry();
    sprayGeo.setAttribute('position',new T.BufferAttribute(sprayPos,3));
    sprayGeo.setAttribute('aSeed',new T.BufferAttribute(spraySeed,4));
    const sprayMat=new T.ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{uTime:time,uSnowAmt,uRear,uBack,uBikeSpeed},
      vertexShader:`
        attribute vec4 aSeed;
        uniform float uTime,uSnowAmt,uBikeSpeed;
        uniform vec3 uRear;uniform vec2 uBack;
        varying float vAlpha;
        void main(){
          if(uSnowAmt<.05||uBikeSpeed<2.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;vAlpha=0.;return;}
          float life=.26+.34*aSeed.y;
          float age=fract(uTime/life+aSeed.x),t=age*life;
          vec2 side=vec2(-uBack.y,uBack.x);
          float spd=smoothstep(2.,16.,uBikeSpeed);
          vec2 off=uBack*(.15+t*(1.8+uBikeSpeed*(.22+.16*aSeed.w)))+side*((aSeed.z-.5)*(.12+1.45*t));
          float lift=(1.35+1.8*aSeed.z)*spd;
          vec3 p=uRear+vec3(off.x,-.24+lift*t-3.2*t*t,off.y);
          vec4 view=viewMatrix*vec4(p,1.);
          vAlpha=uSnowAmt*spd*(1.-age)*(smoothstep(0.,.14,age))*(.45+.45*aSeed.w);
          gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((6.+9.*aSeed.w+age*8.)*projectionMatrix[1][1]*300./max(.8,-view.z),2.,16.);
        }`,
      fragmentShader:`
        varying float vAlpha;
        void main(){
          float r=length(gl_PointCoord*2.-1.);
          float a=vAlpha*(1.-smoothstep(.15,1.,r));
          if(a<.01)discard;
          gl_FragColor=vec4(.92,.97,1.,a*.78);
          #include <colorspace_fragment>
        }`
    });
    const spray=new T.Points(sprayGeo,sprayMat);
    spray.name='Powder snow rear wheel mist';spray.frustumCulled=false;spray.renderOrder=7;
    scene.add(spray);

    // 3. Fluttering pink-and-white cherry petals kicked up from the rear wheel in the cherry grove!
    const petalCount=72,petalPos=new Float32Array(petalCount*3),petalSeed=new Float32Array(petalCount*4);
    for(let i=0;i<petalCount;i++)petalSeed.set([rand(),rand(),rand(),rand()],i*4);
    const petalGeo=new T.BufferGeometry();
    petalGeo.setAttribute('position',new T.BufferAttribute(petalPos,3));
    petalGeo.setAttribute('aSeed',new T.BufferAttribute(petalSeed,4));
    const uPetalAmt={value:0};
    const petalMat=new T.ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{uTime:time,uPetalAmt,uRear,uBack,uBikeSpeed},
      vertexShader:`
        attribute vec4 aSeed;
        uniform float uTime,uPetalAmt,uBikeSpeed;
        uniform vec3 uRear;uniform vec2 uBack;
        varying float vAlpha,vTone;
        void main(){
          if(uPetalAmt<.05||uBikeSpeed<1.5){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;vAlpha=0.;vTone=0.;return;}
          float life=.55+.65*aSeed.y;
          float age=fract(uTime/life+aSeed.x),t=age*life;
          vec2 side=vec2(-uBack.y,uBack.x);
          float spd=smoothstep(1.5,14.,uBikeSpeed);
          vec2 swirl=side*(sin(uTime*4.2+aSeed.z*18.)*.35+(aSeed.z-.5)*(.25+2.1*t));
          vec2 off=uBack*(.18+t*(1.4+uBikeSpeed*(.16+.12*aSeed.w)))+swirl;
          float lift=(1.1+1.5*aSeed.z)*spd;
          vec3 p=uRear+vec3(off.x,-.22+lift*t-1.35*t*t,off.y);
          vec4 view=viewMatrix*vec4(p,1.);
          vAlpha=uPetalAmt*spd*(1.-age*age)*smoothstep(0.,.12,age)*(.65+.35*aSeed.w);
          vTone=aSeed.w;
          gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((4.5+5.5*aSeed.w)*projectionMatrix[1][1]*300./max(.8,-view.z),2.,11.);
        }`,
      fragmentShader:`
        varying float vAlpha,vTone;
        void main(){
          vec2 q=(gl_PointCoord*2.-1.)*vec2(1.,1.45);
          float r=length(q);
          float a=vAlpha*(1.-smoothstep(.35,1.,r));
          if(a<.01)discard;
          vec3 c=mix(vec3(.99,.78,.86),vec3(1.0,.96,.98),vTone);
          gl_FragColor=vec4(c,a);
          #include <colorspace_fragment>
        }`
    });
    const petals=new T.Points(petalGeo,petalMat);
    petals.name='Cherry petal drift rear-wheel wake';petals.frustumCulled=false;petals.renderOrder=7;
    scene.add(petals);

    return function update(x,z,speed,heading,axles,touchesSoil){
      const amt=snowAt(x,z);
      const orch=root.RideOrchard?.coverage?root.RideOrchard.coverage(x,z):0;
      uSnowAmt.value=amt;
      uPetalAmt.value=smooth(.06,.42,orch);
      flakes.visible=amt>.02;
      spray.visible=amt>.06&&touchesSoil&&speed>2;
      petals.visible=uPetalAmt.value>.05&&touchesSoil&&speed>1.5;
      if(spray.visible||petals.visible){
        if(axles&&axles.rear)uRear.value.copy(axles.rear);
        else uRear.value.set(x-.55*Math.sin(heading),height(x,z)+.36,z+.55*Math.cos(heading));
        uBack.value.set(-Math.sin(heading),Math.cos(heading));
        uBikeSpeed.value=speed;
      }
    };
  }

  function build(T,scene) {
    const time={value:0},rider={value:new T.Vector2()};
    const maskFallback=new T.DataTexture(new Uint8Array(4),1,1);
    maskFallback.needsUpdate=true;
    const shadow={...root.RideWeather.uniforms(T),...root.RideOrchard?.shadowUniforms(T),...root.RideBankTrees?.shadowUniforms(T),...root.RideWildfields?.uniforms(T),...root.RidePathSurface.uniforms(T),uCyclistMask:{value:maskFallback},uMaskStrength:{value:0},uMaskSpan:{value:4.2}};
    const contact=tireField(T);
    createSky(T,scene);
    const snowAtmos=alpineSnowAtmosphere(T,scene,time);
    const soil=root.RideTerrainDetail.createUniforms(T);
    Object.assign(shadow,soil);
    const updateGround=makeMeadow(T,scene,time,contact.uniforms,soil,shadow,rider);
    const water=root.RideWater.build(T,scene,height);
    const shiftTiles=vegetation(T,scene,rider,time,contact.uniforms,shadow);
    const wild=root.RideWildfields?.build(T,scene,height,{...shadow,...contact.uniforms,uRider:rider,uTime:time},
      {pressure:wheelPressure,paint:meadowPaint,noise:noiseFunctions,cast:castShadow,display:displayColor});
    let lastHeading=0,lastX=NaN,lastZ=NaN;
    function update(x,z,seconds,speed=0,heading,axles,touchesSoil=true) {
      const dx=x-lastX,dz=z-lastZ;
      const reset=!Number.isFinite(lastX)||seconds<time.value||Math.abs(dx)+Math.abs(dz)>24;
      if(reset)contact.reset();
      if(Number.isFinite(heading))lastHeading=heading;
      else if(!reset&&dx*dx+dz*dz>.00001)lastHeading=Math.atan2(dx,-dz);
      contact.update(x,z,seconds,speed,lastHeading,axles,touchesSoil);
      water.update(x,z,seconds,speed,touchesSoil?axles:null);
      time.value=seconds;rider.value.set(x,z);lastX=x;lastZ=z;
      const cast=root.RideRider && root.RideRider.shadow;
      if(cast && cast.texture){
        shadow.uCyclistMask.value=cast.texture;
        shadow.uMaskStrength.value=cast.pasture?cast.strength:0;
        shadow.uMaskSpan.value=cast.span;
      }
      updateGround(x,z);
      shiftTiles(x,z);
      wild?.update(x,z);
      snowAtmos(x,z,speed,lastHeading,axles,touchesSoil);
    }
    update(0,0,0,0,0);
    return {ready:wild?.ready||Promise.resolve(true),update,resetTrail:contact.reset,contactAt:contact.sample,trailStats:contact.stats};
  }
  // CPU mirror of the eastern snow-mountain direction mask so audio & snow particles match the shader exactly.
  function snowAt(x,z){
    const drift=34*(Math.sin(x*.019+z*.014)+Math.cos(x*.013-z*.017)+2)*.5;
    return smooth(145,355,x+drift);
  }
  root.RideLand={build,height,windAt,snowAt};
})(globalThis);
