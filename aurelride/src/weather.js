/* Cloud cover lives on a wind-advected world plane. The sky, nearby light
   and hills all sample the same density map in metres. */
(function (root) {
  'use strict';

  const alongX=.86815,alongZ=-.49630;
  const tileMetres=1460,mapSize=256,shared=new WeakMap(),treated=new WeakSet();
  function smooth(a,b,x) {
    const s=Math.max(0,Math.min(1,(x-a)/(b-a)));
    return s*s*(3-2*s);
  }
  function flowAt(t,result) {
    // The derivatives of these two distances are the wind components. A
    // seek or a dropped frame therefore moves a cloud to the same position.
    const a=t*.053,b=t*.027,c=t*.037,d=t*.079;
    const dx=3.65+1.07*Math.sin(a)+.51*Math.sin(b);
    const dz=2.12*Math.sin(c)-1.25*Math.sin(d);
    const along=3.65*t+1.07*(1-Math.cos(a))/.053+.51*(1-Math.cos(b))/.027;
    const across=2.12*(1-Math.cos(c))/.037-1.25*(1-Math.cos(d))/.079;
    const speed=Math.hypot(dx,dz);
    result.windX=(alongX*dx-alongZ*dz)/speed;result.windZ=(alongZ*dx+alongX*dz)/speed;
    result.windSpeed=speed;
    result.driftX=alongX*along-alongZ*across;result.driftZ=alongZ*along+alongX*across;
  }
  function frontAt(x,z,t,w) {
    const along=x*w.windX+z*w.windZ,cross=-x*w.windZ+z*w.windX;
    const phase=along*.198-t*1.34+1.41*Math.sin(cross*.082+t*.13)
      +.63*Math.sin(cross*.19+along*.032-t*.09);
    const squall=.5+.5*Math.sin(along*.054+cross*.063-t*.44);
    return .065+smooth(-.53,.93,Math.sin(phase))*(.62+.305*squall);
  }
  const probe={};
  function windAt(x,z,t) {
    flowAt(t,probe);return frontAt(x,z,t,probe);
  }

  // Tileable noise stores the cloud column and the shape of its edges.
  function makeAtlas(T) {
    const data=new Uint8Array(mapSize*mapSize*4);
    function lattice(seed,n,m) {
      const values=new Float32Array(n*m);
      for(let i=0;i<values.length;i++) {
        seed=(Math.imul(1664525,seed)+1013904223)>>>0;values[i]=seed/4294967296;
      }
      return (x,y)=>{
        const px=x*n,py=y*m,ix=Math.floor(px),iy=Math.floor(py);
        const u=smooth(0,1,px-ix),v=smooth(0,1,py-iy);
        const x0=(ix%n+n)%n,y0=((iy%m+m)%m)*n,x1=(x0+1)%n,y1=(y0+n)%(n*m);
        const lo=values[y0+x0]+u*(values[y0+x1]-values[y0+x0]);
        const hi=values[y1+x0]+u*(values[y1+x1]-values[y1+x0]);
        return lo+v*(hi-lo);
      };
    }
    const macro=lattice(137,4,5), lobes=lattice(901,9,11), detail=lattice(51225,23,26);
    const grit=lattice(827,59,62),warp=lattice(91322,3,4);
    for(let j=0;j<mapSize;j++)for(let i=0;i<mapSize;i++) {
      const x=(i+.5)/mapSize,y=(j+.5)/mapSize,idx=4*(j*mapSize+i);
      const p=x+.10*warp(x,y),q=y+.095*warp(y+.41,x+.18);
      const coarse=macro(p,q), mid=lobes(p,q),fine=detail(p,q),small=grit(p,q);
      data[idx]=Math.round(255*(.49*coarse+.31*mid+.15*fine+.05*small));
      data[idx+1]=Math.round(255*(.47*mid+.37*fine+.16*small));
      data[idx+2]=0;
      data[idx+3]=255;
    }
    const texture=new T.DataTexture(data,mapSize,mapSize,T.RGBAFormat);
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.generateMipmaps=true;
    texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
    texture.name='Advected cloud layers';texture.needsUpdate=true;
    return texture;
  }
  function uniforms(T) {
    if(!shared.has(T))shared.set(T,{
      uWeatherMap:{value:makeAtlas(T)},uWeatherDrift:{value:new T.Vector2()},
      uWeatherWind:{value:new T.Vector2(alongX,alongZ)},uWeatherStrength:{value:.54},
      uWeatherTime:{value:0},uWeatherCloud:{value:0},uWeatherRain:{value:0},
      uWeatherWet:{value:0},uWeatherHaze:{value:0}
    });
    return shared.get(T);
  }
  function groundDensity(px,pz,u) {
    const wrap=n=>(n%mapSize+mapSize)%mapSize;
    const data=u.uWeatherMap.value.image.data;
    const x=(px-u.uWeatherDrift.value.x+172)/tileMetres*mapSize-.5;
    const y=(pz-u.uWeatherDrift.value.y+217)/tileMetres*mapSize-.5;
    const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy;
    const x0=wrap(ix),x1=wrap(ix+1),y0=wrap(iy)*mapSize,y1=wrap(iy+1)*mapSize;
    const low=(1-a)*data[4*(y0+x0)]+a*data[4*(y0+x1)];
    const high=(1-a)*data[4*(y1+x0)]+a*data[4*(y1+x1)];
    return (low+b*(high-low))/255;
  }
  function cycleStart(i) {return i*157+10*Math.sin(i*1.33)+7*Math.sin(i*2.149);}
  function weatherAt(x,z,t,state,u) {
    flowAt(t,state);
    state.gust=frontAt(x,z,t,state);
    state.windStrength=Math.max(.22,Math.min(.99,.15+.104*state.windSpeed+.15*state.gust));
    u.uWeatherDrift.value.set(state.driftX*1.88,state.driftZ*1.88);
    let cycle=Math.floor(t/157);
    if(t<cycleStart(cycle))cycle--;
    else if(t>=cycleStart(cycle+1))cycle++;
    const clock=157*(t-cycleStart(cycle))/(cycleStart(cycle+1)-cycleStart(cycle));
    const shift=Math.sin(cycle*1.492)*8.0;
    const bank=smooth(11,46+shift,clock)*(1-smooth(89+shift,137,clock));
    const shower=smooth(54+shift,69+shift,clock)*(1-smooth(83+shift,100+shift,clock));
    const cover=bank*(.61+.18*Math.sin((clock-27)*.037)+.18*shower);
    state.cloud=Math.max(0,Math.min(1,cover));
    const density=groundDensity(x,z,u);
    state.cloudShade=cover*smooth(.68-.25*cover,.83-.25*cover,density);
    state.rain=shower*(.32+.68*smooth(.27,.64,density));
    state.wetness=smooth(55+shift,76+shift,clock)*(1-smooth(91+shift,133+shift*.3,clock))
      *(.55+.45*smooth(.24,.67,density));
    state.haze=.31*cover+.46*shower;
    state.breakLight=cover*smooth(87+shift,112+shift,clock);
    state.phase=clock<13||clock>=137?'sunny':clock<54+shift?'cloud':clock<96+shift?'shower':'clearing';
    u.uWeatherWind.value.set(state.windX,state.windZ);u.uWeatherStrength.value=state.windStrength;
    u.uWeatherTime.value=t;u.uWeatherCloud.value=state.cloud;u.uWeatherRain.value=state.rain;
    u.uWeatherWet.value=state.wetness;u.uWeatherHaze.value=state.haze;
  }

  const glsl=`
    #ifndef RIDE_WEATHER_FIELD
    #define RIDE_WEATHER_FIELD
    uniform sampler2D uWeatherMap;
    uniform vec2 uWeatherDrift,uWeatherWind;
    uniform float uWeatherStrength,uWeatherTime,uWeatherCloud,uWeatherRain,uWeatherWet,uWeatherHaze;
    float rideWindFront(vec2 p,float t) {
      float along=dot(p,uWeatherWind),crosswind=dot(p,vec2(-uWeatherWind.y,uWeatherWind.x));
      float phase=along*.198-t*1.34+1.41*sin(crosswind*.082+t*.13)
        +.63*sin(crosswind*.19+along*.032-t*.09);
      float squall=.5+.5*sin(along*.054+crosswind*.063-t*.44);
      return .065+smoothstep(-.53,.93,sin(phase))*(.62+.305*squall);
    }
    float rideCloudShade(vec2 p) {
      if(uWeatherCloud<.001)return 0.;
      float column=texture2D(uWeatherMap,(p-uWeatherDrift+vec2(172.,217.))/1460.).r;
      return uWeatherCloud*smoothstep(.68-.25*uWeatherCloud,.83-.25*uWeatherCloud,column);
    }
    vec3 rideCloudSky(vec3 color,vec3 worldRay,vec3 eye) {
      if(uWeatherCloud<.001)return color;
      vec3 ray=normalize(worldRay);
      float h=max(0.,ray.y);
      float haze=(1.-smoothstep(.01,.32,h))*.30*uWeatherHaze;
      vec3 clear=mix(color,vec3(.77,.83,.88),haze);
      // The map also supplies the cloud shadow on the ground. Keep only
      // the broad cloud body and the variation from its sunward side.
      vec2 base=(eye.xz+ray.xz*(269.-eye.y)/max(.065,h)-uWeatherDrift)/1460.;
      float column=texture2D(uWeatherMap,base).r;
      float towardSun=texture2D(uWeatherMap,base+vec2(.036,.045)).r;
      float edge=.728-.29*uWeatherCloud;
      float cover=smoothstep(edge-.06,edge+.14,column)*smoothstep(.025,.18,h);
      float light=clamp(.65+2.*(column-towardSun),0.,1.);
      vec3 shade=mix(vec3(.78,.835,.88),vec3(.61,.69,.765),uWeatherRain);
      vec3 cloud=mix(shade,vec3(.956,.964,.963),light*(1.-.49*uWeatherRain));
      return mix(clear,cloud,cover*uWeatherCloud*.83);
    }
    #endif
  `;

  function shadeMaterial(T,material) {
    if(!material||treated.has(material))return material;
    treated.add(material);
    const before=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,renderer) {
      before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms(T));
      shader.vertexShader='varying vec3 rideWeatherCoord;\n'+shader.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        vec4 ridePoint=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          ridePoint=instanceMatrix*ridePoint;
        #endif
        rideWeatherCoord=vec3((modelMatrix*ridePoint).xz,-mvPosition.z);`);
      shader.fragmentShader='varying vec3 rideWeatherCoord;\n'+glsl+shader.fragmentShader.replace('#include <opaque_fragment>',`
        outgoingLight*=mix(vec3(1.),vec3(.61,.69,.84),rideCloudShade(rideWeatherCoord.xy));
        #ifndef USE_FOG
          outgoingLight=mix(outgoingLight,vec3(.55,.61,.76),
            .24*uWeatherHaze*smoothstep(340.,1750.,rideWeatherCoord.z));
        #endif
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>key+'-cloudfield2';material.needsUpdate=true;return material;
  }

  function precipitation(T,scene,u,reduced) {
    let seed=942703;
    function random() {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const count=reduced?410:1040;
    const ends=new Float32Array(count*6),seeds=new Float32Array(count*8);
    for(let i=0;i<count;i++) {
      const a=random(),b=random(),c=random(),d=random();
      ends[6*i+3]=1;
      seeds.set([a,b,c,d,a,b,c,d],8*i);
    }
    const rainGeom=new T.BufferGeometry();
    rainGeom.setAttribute('position',new T.BufferAttribute(ends,3));
    rainGeom.setAttribute('dropSeed',new T.BufferAttribute(seeds,4));
    const speed={value:0},waterSpeed={value:0};
    const rainMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
      ...u,uRainWindSpeed:speed,uRainFade:{value:reduced?.62:1}
    },vertexShader:`
      attribute vec4 dropSeed;
      uniform float uWeatherTime,uWeatherRain,uRainWindSpeed,uRainFade;
      uniform vec2 uWeatherDrift,uWeatherWind;
      varying float opacity;
      void main() {
        vec3 volume=vec3(29.,16.,29.);
        float fall=9.+dropSeed.w*4.6;
        vec3 drift=vec3(uWeatherDrift.x*.40,-uWeatherTime*fall,uWeatherDrift.y*.40);
        vec3 delta=mod(dropSeed.xyz*volume+drift-cameraPosition+.5*volume,volume)-.5*volume;
        vec3 tail=vec3(-uWeatherWind.x*uRainWindSpeed*.752,fall,-uWeatherWind.y*uRainWindSpeed*.752);
        vec3 world=cameraPosition+delta+tail*(position.x*.0155)*(1.+dropSeed.y*.62);
        float fade=smoothstep(.75,2.3,length(delta))*(1.-smoothstep(9.,14.,length(delta.xz)));
        fade*=1.-smoothstep(6.45,7.94,abs(delta.y));
        float appears=smoothstep(dropSeed.w*.72,dropSeed.w*.72+.24,uWeatherRain);
        opacity=appears*fade*(.23+.36*dropSeed.y)*uRainFade;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
      }`,
      fragmentShader:`varying float opacity;void main(){
        gl_FragColor=vec4(.73,.83,.96,opacity);
        #include <colorspace_fragment>
      }`});
    const rain=new T.LineSegments(rainGeom,rainMat);
    rain.name='Sunshower in moving air';rain.frustumCulled=false;rain.visible=false;rain.renderOrder=8;
    scene.add(rain);

    const drops=reduced?34:77,bits=new Float32Array(drops*3),attr=new Float32Array(drops*4);
    for(let i=0;i<attr.length;i++)attr[i]=random();
    const sprayGeom=new T.BufferGeometry();
    sprayGeom.setAttribute('position',new T.BufferAttribute(bits,3));
    sprayGeom.setAttribute('splashSeed',new T.BufferAttribute(attr,4));
    const axle={value:new T.Vector3()},back={value:new T.Vector2(0,1)};
    const sprayMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
      ...u,uRearAxle:axle,uBicycleBack:back,uRoadSpeed:waterSpeed
    },vertexShader:`
      attribute vec4 splashSeed;
      uniform vec3 uRearAxle;uniform vec2 uBicycleBack,uWeatherWind;
      uniform float uRoadSpeed,uWeatherRain,uWeatherTime;
      varying float opacity;
      void main(){
        float life=.14+.23*splashSeed.y;
        float age=fract(uWeatherTime/life+splashSeed.x), t=age*life;
        float lift=(1.15+1.44*splashSeed.z)*smoothstep(2.,13.,uRoadSpeed);
        vec2 side=vec2(-uBicycleBack.y,uBicycleBack.x);
        vec2 offset=uBicycleBack*(.18+t*(1.25+uRoadSpeed*(.18+.13*splashSeed.w)));
        offset+=side*((splashSeed.z-.5)*(.035+.9*t))+uWeatherWind*.24*t;
        vec3 p=uRearAxle+vec3(offset.x,-.265+lift*t-4.90*t*t,offset.y);
        vec4 view=viewMatrix*vec4(p,1.);
        opacity=(1.-age*age)*smoothstep(.0,.15,age)*smoothstep(.02,.65,uWeatherRain)
          *smoothstep(2.,7.,uRoadSpeed)*(.32+.45*splashSeed.z);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((4.+2.7*splashSeed.w)*projectionMatrix[1][1]/max(1.,-view.z),1.,3.);
      }`,
      fragmentShader:`varying float opacity;void main(){
        float r=length(gl_PointCoord-.5);if(r>.5)discard;
        gl_FragColor=vec4(.74,.83,.94,(1.-smoothstep(.08,.5,r))*opacity);
        #include <colorspace_fragment>
      }`});
    const spray=new T.Points(sprayGeom,sprayMat);
    spray.name='Water shed by rear tire';spray.frustumCulled=false;spray.visible=false;spray.renderOrder=9;
    scene.add(spray);
    function follow(axles) {if(axles&&axles.rear)axle.value.copy(axles.rear);}
    function update(w,ride) {
      speed.value=w.windSpeed;rain.visible=w.rain>.025;
      waterSpeed.value=ride?.speed||0;
      spray.visible=rain.visible&&waterSpeed.value>2&&Boolean(ride?.axles?.rear);
      if(spray.visible){
        const heading=ride.heading||0;back.value.set(-Math.sin(heading),Math.cos(heading));
        follow(ride.axles);
      }
    }
    return {update,follow};
  }

  function create(T,scene,settings={}) {
    const u=uniforms(T),state={},sun=settings.sun,fog=scene.fog;
    const rain=precipitation(T,scene,u,Boolean(settings.reducedMotion));
    const startingSun=sun?.intensity||0;
    const clearFog=fog?.color.clone(),mist=new T.Color(0xb6c9d8),warmAir=new T.Color(0xe3dbcf);
    const fogEnd=fog?.far,fogStart=fog?.near;
    function update(x,z,t,camera,ride) {
      weatherAt(x,z,Math.max(0,Number.isFinite(t)?t:0),state,u);
      // Follow the local clearing under the rider. Architecture and terrain
      // use the corresponding field at their own positions across the valley.
      if(sun)sun.intensity=startingSun*(1-.28*state.cloudShade-.045*state.rain);
      if(fog){
        fog.color.copy(clearFog).lerp(mist,state.haze*.72).lerp(warmAir,state.breakLight*.22);
        if(Number.isFinite(fogEnd)){
          fog.far=fogEnd*(1-.26*state.haze);fog.near=fogStart*(1-.40*state.haze);
        }
      }
      rain.update(state,ride);return state;
    }
    update(0,0,0);
    return {update,follow:rain.follow,state};
  }
  root.RideWeather={create,uniforms,glsl,shadeMaterial,windAt};
})(globalThis);
