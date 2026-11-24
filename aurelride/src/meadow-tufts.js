/* Below the exposed leaf tips, light filters through several levels of
   interwoven leaves. Their optical density is baked once in world metres;
   the living crowns above them bend and overlap in three dimensions. */
globalThis.RideMeadowTufts=function(T,scene,rider,time,fields,glsl,rand){
  'use strict';
  const perf=globalThis.RidePerf||{};
  const isEco=!!perf.isEco;
  const levels=[.14,.31,.51,.72],size=isEco?256:384,tileMetres=2.7;
  function makeCanopy(){
    const data=new Uint8Array(size*size*4);
    const wrap=n=>(n%size+size)%size;
    const crownCount=isEco?440:885;
    for(let crown=0;crown<crownCount;crown++){
      const x=rand()*size,y=rand()*size,bearing=rand()*Math.PI*2;
      const vigor=.69+.45*rand(),tillerCount=5+Math.floor(rand()*5);
      for(let n=0;n<tillerCount;n++){
        const az=bearing+(rand()-.5)*4.8,dx=Math.cos(az),dy=Math.sin(az);
        const px=x+(rand()-.5)*9,py=y+(rand()-.5)*9;
        const reach=(12+30*rand())*vigor,curl=(rand()-.5)*reach*.95;
        const length=vigor*(.47+.66*rand()),width=.70+1.22*rand();
        for(let s=0;s<levels.length;s++){
          const t=levels[s]/length;if(t>=1)continue;
          const a=Math.max(0,t-.11/length),b=Math.min(1,t+.10/length);
          const project=q=>q*(.36+.64*q);
          const sx=px+dx*reach*project(a)-dy*curl*a*a,sy=py+dy*reach*project(a)+dx*curl*a*a;
          const ex=px+dx*reach*project(b)-dy*curl*b*b,ey=py+dy*reach*project(b)+dx*curl*b*b;
          const vx=ex-sx,vy=ey-sy,inv=1/Math.max(.01,vx*vx+vy*vy);
          const r=width*(1-.82*t*t),pad=r+1,brightness=.64+.36*t;
          for(let j=Math.floor(Math.min(sy,ey)-pad);j<=Math.ceil(Math.max(sy,ey)+pad);j++)
            for(let i=Math.floor(Math.min(sx,ex)-pad);i<=Math.ceil(Math.max(sx,ex)+pad);i++){
              const q=Math.max(0,Math.min(1,((i+.5-sx)*vx+(j+.5-sy)*vy)*inv));
              const distance=Math.hypot(i+.5-sx-vx*q,j+.5-sy-vy*q);
              const amount=Math.max(0,Math.min(1,r+.52-distance))*brightness;
              if(amount>0){const slot=4*(wrap(j)*size+wrap(i))+s;data[slot]=Math.max(data[slot],Math.round(amount*255));}
            }
        }
      }
    }
    const volume=new T.DataTexture(data,size,size,T.RGBAFormat);
    volume.wrapS=volume.wrapT=T.RepeatWrapping;volume.generateMipmaps=true;
    volume.minFilter=T.LinearMipmapLinearFilter;volume.magFilter=T.LinearFilter;
    volume.anisotropy=4;volume.needsUpdate=true;
    return volume;
  }
  const uniforms={...fields,uRider:rider,uTime:time,uCanopy:{value:makeCanopy()}};
  const common=`
    uniform vec2 uRider;uniform float uTime;
    ${glsl.pressure}${glsl.land}${glsl.noise}${glsl.paint}${glsl.regional}${glsl.shadow}
    float grassHeight(vec2 p,float grown,float sun){
      float grazed=(.205+.085*sun+.78*grown);
      float edge=footpathGrass(footpath(p))*riverGrass(p);
      return grazed*edge*(1.-.78*tread(p))*(1.-.73*wildCover(p).y)*fieldLensClear(p,uRider);
    }
    vec3 foliageShade(vec3 pigment,vec2 p,float crush,vec4 zone){
      vec3 c=seasonalPigment(pigment,zone,p);
      c*=mix(vec3(1.),vec3(.67,.77,.65),crush);
      return c;
    }`;
  function canopyVolume(){
    // Bound the geometry by screen resolution. Every vertex is fixed to the
    // ground grid so the exposed banks keep their shape as the bicycle moves.
    // This surface models the intertwined lower blades, with the open crowns
    // and their moving tips supplied by the ribbons above it.
    const geom=new T.BufferGeometry(),pos=[],idx=[];
    const positive=[0];let dist=0;
    while(dist<48){dist+=dist<8?.25:dist<16?.5:dist<28?1:2;positive.push(dist);}
    const coords=positive.slice(1).reverse().map(n=>-n).concat(positive),count=coords.length;
    for(const z of coords)for(const x of coords)pos.push(x,0,z);
    for(let z=1;z<count;z++)for(let x=1;x<count;x++){
      const n=z*count+x;idx.push(n-count-1,n-1,n-count,n-count,n-1,n);
    }
    geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));geom.setIndex(idx);
    const material=new T.ShaderMaterial({side:T.FrontSide,uniforms,transparent:true,depthWrite:false,blending:T.CustomBlending,
      blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,vertexShader:`
      ${common}
      varying vec4 vCoord,vTone;varying vec3 vWorld;
      void main(){
        vec2 origin=floor(cameraPosition.xz*4.+.5)*.25;
        vec2 p=origin+position.xz;
        float range=distance(p,cameraPosition.xz),distant=1.-smoothstep(11.,45.,range);
        float grown=pastureDrift(p),light=meadowLight(p);
        float h=grassHeight(p,grown,light),soil=terrainHeight(p);
        float snow=snowCover(p,soil);
        h*=1.-smoothstep(.12,.68,snow);
        vec2 slope=vec2(terrainHeight(p+vec2(1.,0.)),terrainHeight(p+vec2(0.,1.)))-soil;
        float face=meadowFacing(vec3(-slope.x,1.,-slope.y));
        vec2 uv=p+vec2(.26*sin(p.y*.55)+.12*sin(p.x*.74),.37*sin(p.x*.42)+.15*sin(p.y*.67));
        float tufts=noise2(uv*1.63),bank=noise2(uv*.68+4.);
        float wind=windfront(p,uTime);
        vec2 breeze=bendingWind(p,uTime,.44,.47,wind);
        vec4 mark=wheelTrace(p);float crush=smoothstep(.06,.81,mark.z);
        float height=h*(.19+.27*tufts+.20*bank)*(.94-.13*wind)*distant;
        vec2 shift=h*.13*mix(breeze,mark.xy*2.,crush);
        vec2 top=p+shift;
        height*=1.-.977*crush;
        // Folded crowns have a lit cheek and a shaded hollow. The broad
        // hillside retains the same light response as the underlying pasture.
        float sun=.32+.24*light+.37*(face-.5)+.075*(bank-.5)+.062*(wind-.36);
        vec3 color=meadowReflectance(sun,.40+.19*light,grown);
        vTone=vec4(seasonalPigment(color,worldBiomes(p),p),grown);
        vWorld=vec3(top.x,height,top.y);
        vCoord=vec4(uv/${tileMetres.toFixed(2)},distant*smoothstep(.015,.081,h),crush);
        gl_Position=projectionMatrix*viewMatrix*vec4(top.x,soil+dot(shift,slope)+height-.026-.043*crush,top.y,1.);
      }`,fragmentShader:`
      uniform vec2 uRider;uniform sampler2D uCanopy;
      ${glsl.pressure}${glsl.shadow}${glsl.display}
      varying vec4 vCoord,vTone;varying vec3 vWorld;
      void main(){
        if(vCoord.z<.008)discard;
        vec4 slices=texture2D(uCanopy,vCoord.xy);
        float thickness=dot(slices,vec4(.18,.26,.31,.25));
        vec3 c=vTone.rgb+vec3(.153,.133,.058)*(thickness-.46);
        float press=smoothstep(.08,.79,wheelTrace(vWorld.xz).z);
        c=mix(c,c*vec3(.71,.78,.66),press);
        c*=grassShadowMultiplier(vWorld.xz,vWorld.y);
        float cover=clamp(.37+.49*thickness,0.,1.)*vCoord.z*(1.-.82*press);
        gl_FragColor=vec4(toLinear(c),cover);
        #include <colorspace_fragment>
      }`});
    const mesh=new T.Mesh(geom,material);mesh.frustumCulled=false;mesh.renderOrder=-1;mesh.name='Filtered light through bentgrass';scene.add(mesh);
  }
  canopyVolume();

  // Each tiller opens into a fan of ribbons. Rows follow the arch in side
  // view while their transverse axis rotates from folded base to soft tip.
  // Outside the resolving distance they sink back into the same turf volume.
  function foliage(span,grid,leaves,far){
    const g=new T.InstancedBufferGeometry(),verts=[],form=[],shade=[],idx=[],roots=[],seeds=[];
    for(let leaf=0;leaf<leaves;leaf++){
      const groupSize=far?3:5,crown=Math.floor(leaf/groupSize),bearing=crown*2.39996;
      const angle=bearing+(leaf%groupSize)*.90+(rand()-.5)*.70;
      const radius=far?.56*Math.sqrt((crown+.5)/Math.ceil(leaves/groupSize)):.15;
      const x=Math.cos(bearing)*radius+(rand()-.5)*.08,z=Math.sin(bearing)*radius+(rand()-.5)*.08;
      const length=.70+.82*rand(),reach=.38+rand()*.72,curl=(rand()-.5)*.56;
      const width=(.021+rand()*.022)*(far?1.28:1),tint=rand();
      let prev;
      for(const t of (far?[0,.57,1]:[0,.38,.72,1])){
        const w=width*(.72+.39*Math.sin(Math.PI*t))*(1-t*t);
        const first=verts.length/3;
        for(const side of (t===1?[0]:[-1,1])){
          verts.push(x,length,z);form.push(t,w*side,angle,reach);shade.push(curl,tint,side);
        }
        if(prev!==undefined){
          idx.push(prev,prev+1,first);
          if(t!==1)idx.push(prev+1,first+1,first);
        }
        prev=first;
      }
    }
    for(let j=0;j<grid;j++)for(let i=0;i<grid;i++){
      roots.push((i+.05+.90*rand())*span/grid,(j+.05+.90*rand())*span/grid);
      seeds.push(rand(),rand(),rand());
    }
    // Fisher-Yates shuffle instances once so dynamic instanceCount scaling thins blades uniformly across the meadow
    const totalInst=grid*grid;
    for(let k=totalInst-1;k>0;k--){
      const j=Math.floor(rand()*(k+1));
      let t0=roots[k*2],t1=roots[k*2+1];
      roots[k*2]=roots[j*2];roots[k*2+1]=roots[j*2+1];
      roots[j*2]=t0;roots[j*2+1]=t1;
      let s0=seeds[k*3],s1=seeds[k*3+1],s2=seeds[k*3+2];
      seeds[k*3]=seeds[j*3];seeds[k*3+1]=seeds[j*3+1];seeds[k*3+2]=seeds[j*3+2];
      seeds[j*3]=s0;seeds[j*3+1]=s1;seeds[j*3+2]=s2;
    }
    g.setAttribute('position',new T.Float32BufferAttribute(verts,3));
    g.setAttribute('aForm',new T.Float32BufferAttribute(form,4));g.setAttribute('aShade',new T.Float32BufferAttribute(shade,3));g.setIndex(idx);
    g.setAttribute('aRoot',new T.InstancedBufferAttribute(new Float32Array(roots),2));
    g.setAttribute('aSeed',new T.InstancedBufferAttribute(new Float32Array(seeds),3));
    g.instanceCount=totalInst;
    if(perf.registerScalable)perf.registerScalable(g,totalInst,isEco?.68:.52);
    const mat=new T.ShaderMaterial({side:T.DoubleSide,uniforms,vertexShader:`
      ${common} attribute vec4 aForm;attribute vec3 aShade,aSeed;attribute vec2 aRoot;varying vec3 vColour,vWorld;
      void main(){
        const float span=${span.toFixed(1)};
        vec2 cell=cameraPosition.xz+mod(aRoot-cameraPosition.xz+span*.5,span)-span*.5;
        if(outsideMeadowView(cell,1.8)){gl_Position=vec4(2.,2.,2.,1.);return;}
        float rotation=6.283185*aSeed.x, ca=cos(rotation),sa=sin(rotation);
        vec2 p=cell+mat2(ca,sa,-sa,ca)*position.xz;
        float dist=length(p-cameraPosition.xz),phase=aForm.z+rotation;
        float until=span*(.40+.085*aSeed.z);
        float fade=1.-smoothstep(until-span*.14,until,dist);
        ${far?'fade*=smoothstep(7.,16.,dist+(aSeed.x-.5)*6.);':''}
        if(fade<.015){gl_Position=vec4(2.,2.,2.,1.);return;}
        float grown=pastureDrift(cell),light=meadowLight(cell);
        float soil=terrainHeight(p);
        float snow=snowCover(p,soil);
        float h=grassHeight(p,grown,light)*position.y*(.88+.28*aSeed.y)*(1.-smoothstep(.08,.62,snow));
        if(h<.016){gl_Position=vec4(2.,2.,2.,1.);return;}
        float t=aForm.x;vec2 dir=vec2(cos(phase),sin(phase)),across=vec2(-dir.y,dir.x);
        float wave=windfront(cell,uTime);
        vec4 pressed=wheelTrace(p);float crush=smoothstep(.06,.78,pressed.z);
        vec2 wind=bendingWind(p,uTime,t,aShade.y,wave);
        // Tilt at emergence, increasingly soft bend near the tip.
        vec2 lay=normalize(dir+uWeatherWind*(.38+.46*wave));
        vec2 curve=dir*(.16*t)+lay*aForm.w*(1.02*t*t)+across*aShade.x*t*t;
        vec2 reach=h*mix(curve+wind*(.58*t*t),pressed.xy*(.22*t+1.05*t*t),crush)*mix(.55,1.,fade);
        float twist=(aShade.y-.5)*1.55*t+.33*sin(t*2.3+aSeed.z*6.28);
        vec2 section=across*cos(twist)+dir*sin(twist);
        vec2 top=p+reach+section*aForm.y;
        float droop=.24+.16*aShade.y+.12*wave;
        float y=h*(t-droop*t*t*t*(.51+.63*aForm.w))*(1.-.10*wave)*fade*(1.-.966*crush);
        float form=.18*dot(dir,vec2(.64,.77))+.095*aShade.z*(.36+.64*t);
        float glint=smoothstep(.50,.92,wave)*t*.26;
        float sunlight=.08+.22*light+.62*smoothstep(.08,.86,t)+form+.19*(wave-.38)+.11*(aShade.y-.5)+glint;
        // Narrow distant ribbons share the value of the mass behind them.
        // Subpixel roots then resolve into a meadow instead of black pins.
        float resolved=1.-smoothstep(8.,38.,dist);
        sunlight=mix(.42+.18*light+.14*t,sunlight,.22+.78*resolved);
        vec3 c=meadowReflectance(sunlight,aShade.y,grown);
        // Subtle frost dusting on sparse alpine blades near the snowline.
        c=mix(c,vec3(.82,.88,.94),smoothstep(.05,.55,snow)*.55*t);
        vColour=foliageShade(c,top,crush,worldBiomes(cell));vWorld=vec3(top.x,y,top.y);
        // Roots and collapsed tips follow the very same slope as the wheels.
        gl_Position=projectionMatrix*viewMatrix*vec4(top.x,mix(soil,terrainHeight(top),crush)+y-.017,top.y,1.);
      }`,fragmentShader:`uniform vec2 uRider;varying vec3 vColour,vWorld;${glsl.shadow}${glsl.display}
      void main(){vec3 c=vColour*grassShadowMultiplier(vWorld.xz,vWorld.y);gl_FragColor=vec4(toLinear(c),1.);
        #include <colorspace_fragment>
      }`});
    const stand=new T.Mesh(g,mat);stand.name=far?'Tall meadow leaf silhouettes':'Arched fine fescue at wheel height';stand.frustumCulled=false;scene.add(stand);
  }
  foliage(36,isEco?50:64,isEco?15:20,false);
  foliage(88,isEco?52:68,isEco?13:17,true);
};
