/* The two worn tracks share a single world-space field with the plants. */
(() => {
  'use strict';
  const cache=new WeakMap();
  function pathField(T,trails){
    const paths=trails.paths.filter(p=>p.samples.length>1&&(p.surface==='gravel'||p.surface==='earth')),margin=8;
    const cherryTrail=globalThis.RideOrchard?.trail(T);
    if(cherryTrail)paths.push(cherryTrail);
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for(const path of paths)for(const [x,z] of path.samples){
      minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z);
    }
    if(!paths.length){minX=minZ=0;maxX=maxZ=1;}
    minX-=margin;minZ-=margin;maxX+=margin;maxZ+=margin;
    const resolution=Math.max(.285,(maxX-minX)/3072,(maxZ-minZ)/2048);
    const w=Math.ceil((maxX-minX)/resolution),h=Math.ceil((maxZ-minZ)/resolution);
    const data=new Uint8Array(w*h*2);
    for(const path of paths){
      const {samples,width,closed}=path,half=width*.5,radius=half*1.6,channel=path.surface==='gravel'?1:0;
      const total=samples.length-(closed?0:1);
      for(let k=0;k<total;k++){
        const [ax,az]=samples[k],[bx,bz]=samples[(k+1)%samples.length];
        const dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz;
        if(len2<.00001)continue;
        const l=Math.max(0,Math.floor((Math.min(ax,bx)-radius-minX)/resolution));
        const r=Math.min(w-1,Math.ceil((Math.max(ax,bx)+radius-minX)/resolution));
        const b=Math.max(0,Math.floor((Math.min(az,bz)-radius-minZ)/resolution));
        const t=Math.min(h-1,Math.ceil((Math.max(az,bz)+radius-minZ)/resolution));
        for(let j=b;j<=t;j++)for(let i=l;i<=r;i++){
          const px=minX+(i+.5)*resolution-ax,pz=minZ+(j+.5)*resolution-az;
          const u=Math.max(0,Math.min(1,(px*dx+pz*dz)/len2));
          const nearest=Math.hypot(px-dx*u,pz-dz*u);if(nearest>=radius)continue;
          const v=Math.round(255*(1-nearest/radius)),index=(j*w+i)*2;
          if(v>data[index+channel])data[index+channel]=v;
        }
      }
    }
    const map=new T.DataTexture(data,w,h,T.RGFormat);map.generateMipmaps=true;map.anisotropy=2;
    map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.needsUpdate=true;
    return {map,bounds:new T.Vector4(minX,minZ,1/(w*resolution),1/(h*resolution))};
  }

  // Red holds exposed soil, green is stone coverage, blue is its sunlit facet.
  // Mipmapping keeps the aggregate stable at grazing angles and at riding speed.
  function aggregate(T){
    const n=256,data=new Uint8Array(n*n*4);let seed=64755;
    const rnd=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const u=x/n*6.2832,v=y/n*6.2832,k=(y*n+x)*4;
      data[k]=98+53*rnd()+11*Math.sin(3*u+v+Math.cos(5*v))+9*Math.cos(5*v-3*u);
      data[k+3]=128;
    }
    for(let j=0;j<4700;j++){
      const cx=rnd()*n,cy=rnd()*n,size=.46+3.65*Math.pow(rnd(),3.4),slim=.46+.50*rnd();
      const angle=6.283*rnd(),sn=Math.sin(angle),cs=Math.cos(angle),tint=Math.floor(255*rnd());
      const reach=Math.ceil(size+1);
      for(let y=Math.floor(cy)-reach;y<=cy+reach;y++)for(let x=Math.floor(cx)-reach;x<=cx+reach;x++){
        const dx=x+.5-cx,dy=y+.5-cy;
        const u=(dx*cs+dy*sn)/size,v=(-dx*sn+dy*cs)/(size*slim),r2=u*u+v*v;
        if(r2>1.15)continue;
        const k=(((y+n)%n)*n+(x+n)%n)*4,coverage=Math.min(1,(1.15-r2)*size*1.55);
        const light=Math.min(1,Math.max(0,.25+.46*Math.sqrt(Math.max(0,1-r2))+.30*(dy*.78-dx*.48)/size));
        data[k+1]=Math.round(255*coverage);data[k+2]=Math.round(255*light);data[k+3]=tint;
      }
    }
    const texture=new T.DataTexture(data,n,n,T.RGBAFormat);texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=true;
    texture.anisotropy=4;texture.needsUpdate=true;return texture;
  }
  function uniforms(T){
    if(!cache.has(T)){
      const trails=globalThis.RideTrails,{map,bounds}=pathField(T,trails),deck=trails.bridge;
      cache.set(T,{uFootpathMap:{value:map},uFootpathBounds:{value:bounds},uFootpathStone:{value:aggregate(T)},
        uFootpathBridge:{value:new T.Vector4(deck.x,deck.z,deck.halfLength,deck.halfWidth)}});
    }
    return cache.get(T);
  }
  const glsl=`
    uniform sampler2D uFootpathMap;
    uniform vec4 uFootpathBounds,uFootpathBridge;
    // x = exposed earth, y = gravel share, z = low central and roadside turf,
    // w = bare footprint under the raised bridge and its abutments.
    vec4 footpath(vec2 p){
      vec2 uv=(p-uFootpathBounds.xy)*uFootpathBounds.zw;
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec4(0.);
      vec4 field=texture2D(uFootpathMap,uv);
      float nearby=max(field.r,field.g);
      vec2 edge=abs(p-uFootpathBridge.xy)-uFootpathBridge.zw;
      float deck=1.-smoothstep(-.04,.27,max(edge.x,edge.y));
      if(nearby<.10)return vec4(0.,0.,0.,deck);
      float q=(1.-nearby)*1.6;
      float gravel=smoothstep(-.09,.09,field.g-field.r);
      // Slow variation in separation and width records different wheel lines.
      float wobble=sin(dot(p,vec2(.78,.37))+.37*sin(p.x*.71))*.045+sin(p.y*.26-p.x*.19)*.034;
      float wear=.42+.58*noise2(p*.43+vec2(5.4,1.9));
      float lane=1.-smoothstep(.045+.035*wear,.235+.065*wear,abs(q-(.404+.027*gravel+wobble)));
      float body=1.-smoothstep(.65,1.12+.045*wobble,q);
      float base=body*(.15+.155*gravel+.20*smoothstep(.57,.85,wear));
      float earth=clamp(base+lane*(.88+.12*wear),0.,1.);
      // Shelter and regular foot traffic expose a single continuous bed of
      // earth on the woodland loop, including the strip between wheel lines.
      if(p.y>0.&&p.x> -550.&&p.x< -150.)earth=max(earth,body*(.89+.10*wear));
      return vec4(earth,gravel,body,deck);
    }
    float footpathGrass(vec4 path){
      return (1.-path.w)*mix(1.,.006,smoothstep(.16,.96,path.x))*(1.-.33*path.z);
    }
  `;
  const groundGLSL=`
    uniform sampler2D uFootpathStone;
    float fallenPetal(vec2 cell,float threshold){
      vec2 id=floor(cell),offset=fract(cell)-.5;
      float pick=h21(id+vec2(43.12,5.27));
      if(pick<threshold)return 0.;
      float direction=6.28*h21(id+vec2(71.36,16.6)),cs=cos(direction),sn=sin(direction);
      offset=mat2(cs,sn,-sn,cs)*offset;
      offset+=vec2(h21(id+4.32)-.5,h21(id+17.28)-.5)*.27;
      vec2 oval=offset/vec2(.12+.05*pick,.22);
      oval.x+=.21*oval.y*oval.y;
      return 1.-smoothstep(.47,1.,dot(oval,oval));
    }
    vec3 pathGround(vec3 turf,vec4 road,vec2 p,float light,float face,float dist){
      vec3 wood=cherryField(p);
      if(wood.g>.02){
        float luma=dot(turf,vec3(.25,.56,.19));
        turf=mix(turf,vec3(.164,.252,.136)+vec3(.46,.51,.37)*luma,.48*wood.g);
      }
      if((road.x<.008&&wood.g<.02)||road.w>.99)return turf;
      float fleck=noise2(p*.82+vec2(1.7,4.1));
      vec2 grainUV=(p+vec2(noise2(p*.20),noise2(p*.19+3.1))*.08)*.34;
      vec4 stone=texture2D(uFootpathStone,grainUV);
      vec3 earth=mix(vec3(.385,.337,.221),vec3(.664,.541,.369),fleck*.59+.41*stone.r);
      vec3 silt=mix(earth,vec3(.603,.555,.443)+vec3(.105,.099,.079)*(fleck-.48),.65*road.y);
      vec3 pebble=mix(vec3(.390,.367,.307),vec3(.756,.714,.618),stone.b);
      pebble+=vec3(.075,.043,-.023)*(stone.a-.5);
      vec3 aggregate=mix(silt,pebble,stone.g*(.43+.53*road.y));
      aggregate*=.86+.105*face+.095*light;
      aggregate*=mix(vec3(1.),vec3(.69,.73,.79),uWeatherWet*(.65+.35*road.x));
      float exposed=road.x*(1.-road.w)*(.83+.16*smoothstep(.23,.64,stone.r));
      // A distant two-track merges into one soft line as its gravel loses contrast.
      vec3 result=mix(turf,aggregate,exposed*(1.-.28*smoothstep(48.,240.,dist)));
      if(wood.g>.02){
        float density=wood.b*(.26+.74*smoothstep(.24,.72,fleck))*(.26+.74*road.z);
        vec3 strawEarth=vec3(.714,.587,.478)+vec3(.195,.173,.138)*(fleck-.44);
        result=mix(result,strawEarth,road.x*wood.g*(.34+.13*light));
        vec3 blossom=mix(vec3(.88,.685,.725),vec3(.997,.91,.896),stone.r);
        float scatter=0.;
        if(dist<27.){
          scatter=fallenPetal(p*7.4,.95-.62*density)+.72*fallenPetal(mat2(.86,.51,-.51,.86)*p*10.5+5.13,.98-.33*density);
          scatter*=1.-smoothstep(11.,27.,dist);
        }
        result=mix(result,blossom,min(.93,density*(.16+.38*road.z)+scatter*.87*wood.g));
      }
      return result;
    }
  `;
  globalThis.RidePathSurface={uniforms,glsl,groundGLSL};
})();
