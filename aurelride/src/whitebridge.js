/* White stone aqueduct. The road surface and wheel contact share the same survey. */
(() => {
  'use strict';
  const ground = globalThis.RideLand.height, world = globalThis.RideWorld;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const river = world.river(-205), cx = river.x;
  const limits = [-374,-313,-253,-195,-136,-44,44,136,193,248,302];
  const bend = s => -205 + 8.5 * Math.sin(s * .007);
  const crown = Math.max(river.y + 54, ground(cx - 88, bend(-88)) + 39, ground(cx + 81, bend(81)) + 40);
  const first = -404, end = 302, width = 4.48, roadY = crown + 11.99;
  // Each original arcade is a chord. Use those chords and not the analytic
  // sine here: even small differences are visible along a balustrade.
  function aqueductZ(s) {
    let i = 1;
    while (i < limits.length - 1 && s > limits[i]) i++;
    const a = limits[i-1], b = limits[i];
    return mix(bend(a), bend(b), (s-a)/(b-a));
  }
  function aqueductY(s, w) {
    const land = ground(cx+s, aqueductZ(s)+w);
    const top = roadY + .075 * (1 - (w/width)**2);
    if (s < -367) return mix(land+.035, Math.max(top,land+.035), ease((s-first)/33));
    return top;
  }
  const lip = w => end + .41*Math.sin(w*1.7+.4) + .33*Math.cos(w*2.8) + .26*w;
  const aquaPoint = (s,w=0) => [cx+s, aqueductY(s,w), aqueductZ(s)+w];
  // The upper stones overhang the fractured abutment. Its foundation and
  // crown stop inland of the lip, leaving a clear vertical fall to the grass.
  const pierStations=[...limits.slice(0,-1),end-8.6];
  const aqueduct = {cx, limits, pierStations, crown, first, end, width, center:aqueductZ, lip, point:aquaPoint};

  // Second rideable white-stone skyway: the 1.56km solid Eastern White-Stone Great Wall (matching aqueduct stone paving!).
  // Uses a 5-point smoothed centerline elevation so the battlements glide smoothly with zero stair-steps or sideways tilt,
  // blending flush into the local terrain right where each ramp touches the meadow.
  const wallFirst = -1180, wallEnd = 380, wallWidth = 4.0, wallRise = 9.4;
  const wallCenterX = z => 54 + 18 * Math.sin(z * .0055) + 6 * Math.cos(z * .014) + Math.max(0, -z - 650) * .035;
  function wallSmoothGround(z) {
    const c0 = ground(wallCenterX(z), z);
    const c1 = ground(wallCenterX(z - 18), z - 18), c2 = ground(wallCenterX(z + 18), z + 18);
    const c3 = ground(wallCenterX(z - 36), z - 36), c4 = ground(wallCenterX(z + 36), z + 36);
    // Ensure elevated crest always clears both left & right hillside shoulders cleanly
    const cx = wallCenterX(z);
    const highShoulder = Math.max(ground(cx - wallWidth, z), ground(cx + wallWidth, z));
    return Math.max((c3 + c1 * 2 + c0 * 3 + c2 * 2 + c4) / 9, highShoulder - 1.2);
  }
  function wallElevationFactor(z) {
    if (z >= 82 && z <= 118) return 0;
    const southRamp = ease((wallEnd - z) / 85);
    const northRamp = ease((z - wallFirst) / 85);
    const gateSouth = z > 118 ? ease((z - 118) / 62) : 1;
    const gateNorth = z < 82 ? ease((82 - z) / 62) : 1;
    return southRamp * northRamp * gateSouth * gateNorth;
  }
  function wallDeckY(z, w) {
    const x = wallCenterX(z) + w;
    const localLand = ground(x, z) + .04;
    const f = wallElevationFactor(z);
    const elevatedY = wallSmoothGround(z) + wallRise * f + .05 * (1 - (w / wallWidth) ** 2) * f;
    // Kiss exact local meadow slope smoothly at ramp touchdowns (zero step, zero tilt once elevated!)
    const levelBlend = ease(f / .22);
    return mix(localLand, Math.max(localLand, elevatedY), levelBlend);
  }
  const wallPoint = (z, w = 0) => [wallCenterX(z) + w, wallDeckY(z, w), z];
  const eastWall = {first:wallFirst, end:wallEnd, width:wallWidth, rise:wallRise, centerX:wallCenterX, factor:wallElevationFactor, deckY:wallDeckY, point:wallPoint};

  const stepHeight=.28;
  function surfaceId(x,z){
    if(x>=cx+first && x<=cx+end+2.6 && z>-220 && z< -188){
      const s=x-cx,w=z-aqueductZ(s);
      if(Math.abs(w)<=width && s<=lip(w))return 'aqueduct';
    }
    if(z>=wallFirst && z<=wallEnd && x>18 && x<130){
      const w=x-wallCenterX(z);
      if(Math.abs(w)<=wallWidth && (z<82 || z>118))return 'eastwall';
    }
    return null;
  }
  function deckAt(x,z){
    const id=surfaceId(x,z);
    if(id==='aqueduct')return aqueductY(x-cx,z-aqueductZ(x-cx));
    if(id==='eastwall')return wallDeckY(z,x-wallCenterX(z));
    return null;
  }
  const crossing = s => [cx+s,aqueductZ(s)];
  const bank = (z,d) => [world.river(z).x+d,z];
  const points=[
    crossing(-443),crossing(-421),crossing(-402),crossing(-384),...limits.map(crossing),
    crossing(340),[-304,-220],[-280,-276],[-290,-370],[-334,-476],
    [-425,-582],[-535,-637],bank(-645,70),bank(-645,31),bank(-645,10),bank(-645,-10),
    bank(-645,-31),bank(-645,-74),[-843,-595],[-919,-521],[-1023,-442],[-1105,-375],
    [-1164,-307],[-1186,-259],[-1182,-229],[-1164,-210],crossing(-466)
  ];
  const route = {id:'skybridge', name:'白石长桥', points};
  function start(route) {
    const [[x,z],[nx,nz]]=route.points;
    return {id:route.id,name:route.name,x,z,heading:Math.atan2(nx-x,z-nz)};
  }

  function build(T,parent){
    const xyz=[],uv=[],tone=[],idx=[],road=[];
    const obj=new T.Group();obj.name='The river aqueduct deck';parent.add(obj);
    const colors=new Map();
    const stone=(hex)=>{if(!colors.has(hex))colors.set(hex,new T.Color(hex));return colors.get(hex);};
    function face(a,b,c,d,hex,top=false,wallMode=false){
      const offset=xyz.length/3, ink=stone(hex);
      for(const pt of [a,b,c,d]){
        xyz.push(...pt);tone.push(ink.r,ink.g,ink.b);
        if(wallMode){
          const s=pt[2],t=pt[0]-wallCenterX(s);
          uv.push(s,top?t:t*.84+pt[1]*.74);
        }else{
          const s=pt[0]-cx,t=pt[2]-aqueductZ(s);
          uv.push(s,top?t:t*.84+pt[1]*.74);
        }
        road.push(top?1:0);
      }
      idx.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
    }
    const raise=(p,h)=>[p[0],p[1]+h,p[2]];
    const railBins=new Map();
    function binKey(x,z){return Math.floor(x/16)+','+Math.floor(z/16);}
    function recordRail(e){
      // Bake a small spatial index once. Normal riding and short camera sweeps
      // only consult the few finished sections within reach.
      for(let ix=Math.floor((Math.min(e.ax,e.bx)-2)/16);ix<=Math.floor((Math.max(e.ax,e.bx)+2)/16);ix++){
        for(let iz=Math.floor((Math.min(e.az,e.bz)-2)/16);iz<=Math.floor((Math.max(e.az,e.bz)+2)/16);iz++){
          const key=ix+','+iz;
          if(!railBins.has(key))railBins.set(key,[]);
          railBins.get(key).push(e);
        }
      }
    }
    function course(a,b,c,d,bottom,top,side){
      const at=(p,h)=>raise(p,h);
      const shade=side===1?0xe3d3bd:0xc6cde0;
      face(at(a,bottom),at(b,bottom),at(b,top),at(a,top),shade);
      face(at(d,bottom),at(c,bottom),at(c,top),at(d,top),shade);
      face(at(a,top),at(b,top),at(c,top),at(d,top),0xfff0d2);
      face(at(a,bottom),at(a,top),at(d,top),at(d,bottom),0xd3c7b9);
      face(at(b,bottom),at(c,bottom),at(c,top),at(b,top),0xe4d5bc);
    }
    function railing(from,to,side,height){
      const length=to-from;if(length<.03)return;
      const total=Math.ceil(length/7.4);
      for(let k=0;k<total;k++){
        const l=mix(from,to,k/total),r=mix(from,to,(k+1)/total);
        const make=(u,v,o,lo,hi)=>{
          const a=aquaPoint(u,side*(width-o)), b=aquaPoint(v,side*(width-o));
          const c=aquaPoint(v,side*(width+.04)),d=aquaPoint(u,side*(width+.04));
          course(a,b,c,d,lo,hi,side);
        };
        const a=aquaPoint(l,side*(width-.20)),b=aquaPoint(r,side*(width-.20));
        recordRail({ax:a[0],az:a[2],bx:b[0],bz:b[2],ay:a[1],by:b[1],thick:.185,h:height+.18});
        make(l,r,.36,.015,.19);
        make(l,r,.25,.19,.42);
        make(l+.03,r-.03,.31,.42,.51);
        // Solid, chamfered merlons flank long sight openings. A rider can
        // look down at the water through the longer bays between them.
        for(let q=0;q<2;q++){
          const t=mix(l,r,(q+.32)/2),span=Math.min(.49,(r-l)*.11);
          if(t-span<l||t+span>r)continue;
          make(t-span,t+span,.30,.50,height);
          make(t-span-.055,t+span+.055,.36,height,height+.10);
        }
        if(k%4===0||k===total-1){
          make(r-.54,r-.025,.44,.015,height+.15);
          make(r-.57,r,.48,height+.15,height+.28);
        }
      }
    }
    function pave(){
      const steps=Math.ceil((end-first)/3.1);
      const lanes=[-1,-.66,-.33,0,.33,.66,1].map(t=>t*width);
      const cut=(s,w)=>s===end?lip(w):s;
      for(let j=0;j<steps;j++){
        const l=mix(first,end,j/steps),r=j===steps-1?end:mix(first,end,(j+1)/steps);
        for(let i=1;i<lanes.length;i++){
          const wa=lanes[i-1],wb=lanes[i];
          const a=aquaPoint(cut(l,wa),wa),b=aquaPoint(cut(r,wa),wa),c=aquaPoint(cut(r,wb),wb),d=aquaPoint(cut(l,wb),wb);
          face(a,b,c,d,0xf5ebd8,true);
          if(j===steps-1){
            const bb=raise(b,-1.62-.24*Math.abs(Math.sin(i*4))),cc=raise(c,-1.62-.24*Math.abs(Math.sin((i+1)*4)));
            face(b,c,cc,bb,i%3===0?0xc6b5a4:0xd4c5ae);
          }
        }
        for(const k of [-1,1]){
          const w=k*width,a=aquaPoint(cut(l,w),w),b=aquaPoint(cut(r,w),w);
          face(a,b,raise(b,-.56),raise(a,-.56),k===-1?0xc4c9da:0xe0d2ba);
          face(raise(a,-.56),raise(b,-.56),raise(b,-1.27),raise(a,-1.27),k===-1?0xb4bcd3:0xd6c4af);
        }
      }
    }
    function paveEastWall(){
      const segments=[[wallFirst,82],[118,wallEnd]];
      const lanes=[-1,-.5,0,.5,1].map(t=>t*wallWidth);
      for(const [zA,zB] of segments){
        const steps=Math.ceil((zB-zA)/5.0);
        for(let j=0;j<steps;j++){
          const z0=mix(zA,zB,j/steps),z1=mix(zA,zB,(j+1)/steps);
          for(let i=1;i<lanes.length;i++){
            const wa=lanes[i-1],wb=lanes[i];
            const a=wallPoint(z0,wa),b=wallPoint(z1,wa),c=wallPoint(z1,wb),d=wallPoint(z0,wb);
            face(a,b,c,d,0xf5ebd8,true,true);
          }
          // Deeply buried side skirts along the paving edge so zero gap ever appears between deck and wall body
          for(const k of [-1,1]){
            const w=k*wallWidth,a=wallPoint(z0,w),b=wallPoint(z1,w);
            face(a,b,raise(b,-.75),raise(a,-.75),k===-1?0xe0d2ba:0xc4c9da,false,true);
            face(raise(a,-.75),raise(b,-.75),raise(b,-1.85),raise(a,-1.85),k===-1?0xd6c4af:0xb4bcd3,false,true);
          }
        }
        // Clean, smoothly tapered battlements & merlons along elevated wall sections (smoothly dropping to 0 at ramps!)
        for(const side of [-1,1]){
          const rStart=zA===wallFirst?wallFirst+28:136;
          const rEnd=zB===wallEnd?wallEnd-28:64;
          const len=rEnd-rStart;if(len<=0)continue;
          const total=Math.ceil(len/8.5);
          for(let k=0;k<total;k++){
            const z0=mix(rStart,rEnd,k/total),z1=mix(rStart,rEnd,(k+1)/total);
            const zm=.5*(z0+z1);
            const f0=ease((wallElevationFactor(z0)-.10)/.35);
            const f1=ease((wallElevationFactor(z1)-.10)/.35);
            const fm=.5*(f0+f1);
            if(fm<.05)continue;
            const makeWallRail=(u,v,o,lo,hi0,hi1)=>{
              const a=wallPoint(u,side*(wallWidth-o)),b=wallPoint(v,side*(wallWidth-o));
              const c=wallPoint(v,side*(wallWidth+.08)),d=wallPoint(u,side*(wallWidth+.08));
              const shade=side===-1?0xe3d3bd:0xc6cde0;
              face(raise(a,lo),raise(b,lo),raise(b,hi1),raise(a,hi0),shade,false,true);
              face(raise(d,lo),raise(c,lo),raise(c,hi1),raise(d,hi0),shade,false,true);
              face(raise(a,hi0),raise(b,hi1),raise(c,hi1),raise(d,hi0),0xfff0d2,false,true);
            };
            const a=wallPoint(z0,side*(wallWidth-.20)),b=wallPoint(z1,side*(wallWidth-.20));
            if(fm>.30)recordRail({ax:a[0],az:a[2],bx:b[0],bz:b[2],ay:a[1],by:b[1],thick:.20,h:1.15*fm});
            makeWallRail(z0,z1,.36,-.12,.52*f0,.52*f1);
            // Solid fortress merlons when fully elevated
            if(fm>.65){
              for(let q=0;q<2;q++){
                const t=mix(z0,z1,(q+.30)/2),sp=Math.min(.68,(z1-z0)*.16);
                const hM=.98*fm;
                makeWallRail(t-sp,t+sp,.34,.48*fm,hM,hM);
                makeWallRail(t-sp-.05,t+sp+.05,.40,hM,hM+.11,hM+.11);
              }
            }
          }
        }
      }
    }
    pave();
    for(const side of [-1,1])railing(-357,end-(side===1?11:7),side,.90);
    paveEastWall();
    const geom=new T.BufferGeometry();
    geom.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
    geom.setAttribute('color',new T.Float32BufferAttribute(tone,3));
    geom.setAttribute('stoneUV',new T.Float32BufferAttribute(uv,2));
    geom.setAttribute('walkFace',new T.Float32BufferAttribute(road,1));geom.setIndex(idx);
    const mat=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,fog:true});
    mat.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nattribute vec2 stoneUV; attribute float walkFace; varying vec2 paving; varying float onWalk;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\npaving=stoneUV;onWalk=walkFace;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying vec2 paving;varying float onWalk;float pebble(vec2 n){return fract(sin(dot(mod(n,4096.),vec2(12.988,74.157)))*43758.54);}')
        .replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
        vec2 p=paving*mix(vec2(.71,1.65),vec2(.69,1.13),onWalk);
        p.x+=.5*mod(floor(p.y),2.);
        vec2 unit=fract(p),aa=clamp(fwidth(p),vec2(.001),vec2(.44));
        vec2 gap=smoothstep(vec2(.009)-aa*.53,vec2(.023)+aa*.55,min(unit,1.-unit));
        float tile=pebble(floor(p)),speckle=pebble(floor(paving*47.));
        float seam=1.-min(gap.x,gap.y);
        float near=1.-smoothstep(.12,.7,max(aa.x,aa.y));
        vec2 bevel=smoothstep(vec2(.012)-aa*.36,vec2(.025)+aa*.38,unit)*(1.-smoothstep(vec2(.034)-aa*.32,vec2(.046)+aa*.32,unit));
        diffuseColor.rgb*=.903+.085*tile+near*((speckle-.5)*.014+.043*max(bevel.x,bevel.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.317,.372),seam*.64*near);
        float border=abs(abs(paving.y)-(onWalk>.5?3.72:100.));
        float inlay=(1.-smoothstep(.041,.065+fwidth(paving.y)*.56,border))*onWalk*near;
        float brass=(1.-smoothstep(.008,.019+fwidth(paving.y)*.5,abs(border-.095)))*onWalk*near;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.496,.474,.472),inlay*.67);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.866,.676,.385),brass*.65);`);
    };
    RideStoneFinish.limestone(mat);
    if(globalThis.RideWeather?.shadeMaterial)RideWeather.shadeMaterial(T,mat);
    const mesh=new T.Mesh(geom,mat);mesh.name='River aqueduct paving and cut-stone parapets';obj.add(mesh);
    function nearby(x,z,r){
      const nearAqua=x>=cx+first-r-1 && x<=cx+end+4+r && z>=-221-r && z<=-188+r;
      const nearWall=z>=wallFirst-r-2 && z<=wallEnd+r+2 && x>=16-r && x<=132+r;
      return nearAqua||nearWall;
    }
    function touches(x,z,r,feet,head,tolerance){
      if(!nearby(x,z,r))return false;
      const s=x-cx,w=z-aqueductZ(s);
      if(s>=first && s<=lip(clamp(w,-width,width)) && Math.abs(w)<width+r){
        const top=aqueductY(s,clamp(w,-width,width));
        if(feet<top-tolerance && head>top-1.34)return true;
      }
      if(z>=wallFirst && z<=wallEnd && (z<82||z>118)){
        const ww=x-wallCenterX(z);
        if(Math.abs(ww)<wallWidth+r){
          const top=wallDeckY(z,clamp(ww,-wallWidth,wallWidth));
          if(feet<top-tolerance && head>top-1.34)return true;
        }
      }
      for(const e of railBins.get(binKey(x,z))||[]){
        const reach=r+e.thick;
        if(x<Math.min(e.ax,e.bx)-reach||x>Math.max(e.ax,e.bx)+reach||
          z<Math.min(e.az,e.bz)-reach||z>Math.max(e.az,e.bz)+reach)continue;
        const dx=e.bx-e.ax,dz=e.bz-e.az;
        const f=clamp(((x-e.ax)*dx+(z-e.az)*dz)/(dx*dx+dz*dz)),floor=mix(e.ay,e.by,f);
        if(head<floor-.04||feet>floor+e.h)continue;
        if(Math.hypot(x-e.ax-dx*f,z-e.az-dz*f)<reach)return true;
      }
      return false;
    }
    function blocked(x,z,r,y){return touches(x,z,r,y-.8,y+.77,stepHeight);}
    function cameraFraction(from,to,margin=.26){
      const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
      const length=Math.hypot(dx,dy,dz);
      if(!nearby(from.x,from.z,length+margin))return 1;
      const steps=Math.ceil(length/.22);
      for(let i=1;i<=steps;i++){
        const f=i/steps,y=from.y+dy*f;
        if(touches(from.x+dx*f,from.z+dz*f,margin,y-margin,y+margin,0))return (i-1)/steps;
      }
      return 1;
    }
    return {blocked,cameraFraction};
  }
  globalThis.RideWhiteBridge={aqueduct,eastWall,stepHeight,surfaceId,deckAt,build,route,landmark:start(route)};
})();
