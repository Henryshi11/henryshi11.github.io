/* Glacier-fed river, both shallows and deep reaches use the same surveyed section. */
(function(root){
  'use strict';
  function flowTexture(T){
    const size=256, heights=new Float32Array(size*size),data=new Uint8Array(size*size*4);
    const tau=Math.PI*2;
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const x=tau*i/size,y=tau*j/size;
      const a=x+.53*Math.sin(2*y+.72*Math.cos(x))+.33*Math.cos(x-y);
      const b=y+.19*Math.sin(2*x+y)+.14*Math.cos(3*y-x);
      heights[j*size+i]=.44*Math.sin(3*a+4*b)+.32*Math.sin(7*b-a+.72*Math.sin(x+3*y))+.22*Math.cos(5*a-9*b+.93*Math.cos(y))+.14*Math.sin(14*b+3*a)+.09*Math.cos(8*a-19*b);
    }
    const at=(i,j)=>heights[((j+size)%size)*size+(i+size)%size];
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const k=(j*size+i)*4,dx=at(i+1,j)-at(i-1,j),dz=at(i,j+1)-at(i,j-1);
      data[k]=Math.round(127.5+127.5*Math.tanh(dx*3.7));data[k+1]=Math.round(127.5+127.5*Math.tanh(dz*2.3));
      data[k+2]=Math.round(127.5+127.5*Math.tanh(at(i,j)));data[k+3]=255;
    }
    const tex=new T.DataTexture(data,size,size);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.minFilter=T.LinearMipmapLinearFilter;
    tex.magFilter=T.LinearFilter;tex.generateMipmaps=true;tex.anisotropy=4;tex.needsUpdate=true;return tex;
  }

  function makeWheelWake(T,scene,world){
    const marks=Array.from({length:16},()=>new T.Vector4(0,0,-100,0)),last=[new T.Vector2(1e6,1e6),new T.Vector2(1e6,1e6)];
    const origin={value:new T.Vector2()},strength={value:0},clock={value:0};let next=0,previous=-1,lastStamp=-10,lastMark=-10;
    // Sparkling water spray plumes thrown outward from both tires when blasting through the river!
    const count=128,pos=new Float32Array(count*3),seed=new Float32Array(count*4);
    let s=918273;const rnd=()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);
    for(let i=0;i<count;i++)seed.set([rnd(),rnd(),rnd(),rnd()],i*4);
    const sg=new T.BufferGeometry();
    sg.setAttribute('position',new T.BufferAttribute(pos,3));
    sg.setAttribute('aSeed',new T.BufferAttribute(seed,4));
    const uSprayPos={value:new T.Vector3()},uSprayDir={value:new T.Vector2(0,1)},uSpraySpeed={value:0},uSprayOn={value:0};
    const sm=new T.ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{uTime:clock,uPos:uSprayPos,uDir:uSprayDir,uSpeed:uSpraySpeed,uOn:uSprayOn},
      vertexShader:`
        attribute vec4 aSeed;
        uniform float uTime,uSpeed,uOn;
        uniform vec3 uPos;uniform vec2 uDir;
        varying float vA;
        void main(){
          if(uOn<.02||uSpeed<1.2){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;vA=0.;return;}
          float life=.30+.38*aSeed.y;
          float age=fract(uTime/life+aSeed.x),t=age*life;
          vec2 side=vec2(-uDir.y,uDir.x);
          float sideSign=aSeed.z>.5?1.:-1.;
          float spd=smoothstep(1.2,18.,uSpeed);
          // Classic V-shaped hydroplane spray wings bursting out to left & right + trailing rooster tail!
          vec2 spread=side*sideSign*(.18+t*(1.4+2.6*spd*(.4+.6*aSeed.w))) - uDir*(.12+t*(1.1+uSpeed*.28*aSeed.w));
          float vy=(1.8+2.8*spd*(.5+.5*aSeed.z));
          vec3 p=uPos+vec3(spread.x,vy*t-4.8*t*t,spread.y);
          vec4 view=viewMatrix*vec4(p,1.);
          vA=uOn*spd*(1.-age*age)*smoothstep(0.,.12,age)*(.55+.45*aSeed.w);
          gl_Position=projectionMatrix*view;
          gl_PointSize=clamp((6.+10.*aSeed.w+age*6.)*projectionMatrix[1][1]*300./max(.8,-view.z),2.,18.);
        }`,
      fragmentShader:`
        varying float vA;
        void main(){
          float r=length(gl_PointCoord*2.-1.);
          float a=vA*(1.-smoothstep(.2,1.,r));
          if(a<.01)discard;
          gl_FragColor=vec4(.88,.97,1.,a*.86);
          #include <colorspace_fragment>
        }`
    });
    const sprayMesh=new T.Points(sg,sm);
    sprayMesh.name='High-speed river crossing water spray';sprayMesh.frustumCulled=false;sprayMesh.renderOrder=7;
    scene.add(sprayMesh);

    function update(x,z,time,speed,axles){
      if(time<previous||(x-origin.value.x)**2+(z-origin.value.y)**2>225){for(const m of marks)m.w=0;lastStamp=lastMark=-10;for(const a of last)a.set(1e6,1e6);}
      previous=time;clock.value=time;origin.value.set(x,z);strength.value=time-lastMark<2.4?1:0;
      const wd=world.waterDepth(x,z);
      const onDeck=root.RideTrails?.isDeck(x,z)||false;
      const splashing=!onDeck&&wd>.015&&(!axles?.rear||axles.rear.y-world.river(z).y<.55);
      uSprayOn.value=splashing?Math.min(1,wd*5+.35):0;
      sprayMesh.visible=uSprayOn.value>.02&&speed>1.2;
      if(sprayMesh.visible){
        const rY=world.river(z).y;
        uSprayPos.value.set(x,rY+.06,z);
        if(axles?.front&&axles?.rear){
          const dx=axles.front.x-axles.rear.x,dz=axles.front.z-axles.rear.z,dl=Math.hypot(dx,dz)||1;
          uSprayDir.value.set(dx/dl,dz/dl);
        }
        uSpraySpeed.value=speed;
      }
      if(!axles||time-lastStamp<.075||speed<.23)return;
      const hubs=[axles.front,axles.rear];let emitted=false;
      for(let i=0;i<2;i++){
        const a=hubs[i];if(!a||world.waterDepth(a.x,a.z)<.015||Math.hypot(a.x-last[i].x,a.z-last[i].y)<.30)continue;
        const deck=root.RideTrails?.bridge;
        if(Number.isFinite(a.y)?a.y-world.river(a.z).y>.48:
          deck&&Math.abs(a.x-deck.x)<=deck.halfLength&&Math.abs(a.z-deck.z)<=deck.halfWidth)continue;
        marks[next].set(a.x,a.z,time,Math.min(1.25,.38+speed*.078)*(i===0?.85:1.15));next=(next+1)%marks.length;
        last[i].set(a.x,a.z);lastMark=time;emitted=true;
      }
      if(emitted){lastStamp=time;strength.value=1;}
    }
    return {uniforms:{uSplash:{value:marks},uWakeFocus:origin,uWakeActive:strength,uWakeTime:clock},update};
  }

  function gravelShoals(T,scene,world,weather,height){
    const pebble=new T.IcosahedronGeometry(1,1),vertex=pebble.getAttribute('position');let seed=78613;
    const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
    const material=new T.ShaderMaterial({uniforms:weather.uniforms(T),
      vertexShader:`attribute vec3 aStone;varying vec3 vInk;${weather.glsl}
        void main(){float shade=rideCloudShade(position.xz);vInk=aStone*mix(vec3(1.),vec3(.66,.72,.82),shade);
          gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 vInk;void main(){gl_FragColor=vec4(pow(vInk,vec3(2.2)),1.);
        #include <colorspace_fragment>
      }`});
    for(const fordZ of [-645,335]){
      const pos=[],ink=[];
      for(let patch=0;patch<15;patch++){
        const z0=fordZ+((patch%2)*2-1)*(3+random()*20),section=world.river(z0);
        const x0=section.x+(random()*2-1)*section.halfWidth*1.12;
        for(let stone=0,count=7+random()*15;stone<count;stone++){
          const x=x0+(random()+random()-1)*3.6,z=z0+(random()+random()-1)*2.5;
          const ground=height(x,z),level=world.river(z).y;
          const scale=.045+.28*Math.pow(random(),2.4),sz=scale*(.55+random()*.39),sy=scale*(.28+.24*random());
          const a=random()*6.28,c=Math.cos(a),s=Math.sin(a),skew=(random()-.5)*.28;
          const tone=.38+random()*.27,submerged=ground<level? .81:1;
          const khaki=.74+random()*.20;
          for(let k=0;k<vertex.count;k++){
            const i=vertex.getX(k),j=vertex.getY(k),l=vertex.getZ(k),dx=(i+skew*l)*scale,dz=l*sz;
            const nx=c*i+s*l,nz=c*l-s*i;
            pos.push(x+c*dx+s*dz,ground+sy*(j+.07),z+c*dz-s*dx);
            const light=.61+.39*Math.max(0,nx*.46+j*.75+nz*.46),v=tone*light*submerged;
            ink.push(v,v*.98,v*khaki);
          }
        }
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
      g.setAttribute('aStone',new T.Float32BufferAttribute(ink,3));g.computeBoundingSphere();
      const gravel=new T.Mesh(g,material);gravel.name='Rounded ford shingle';scene.add(gravel);
    }
    pebble.dispose();
  }

  function build(T,scene,terrainHeight){
    const world=root.RideWorld, weather=root.RideWeather;
    if(!world||!weather)return;
    const wake=makeWheelWake(T,scene,world);
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
      uniforms:{...weather.uniforms(T),...wake.uniforms,uWaterGrain:{value:flowTexture(T)}},
      vertexShader:`attribute vec4 aRiver;attribute float aAcross;varying float vAcross;varying vec4 vRiver;varying vec3 vPos,vSky;
        ${weather.glsl}
        void main(){
          vec3 p=position;float t=uWeatherTime;
          float swell=sin(p.z*.39+p.x*.27+t*1.26)+.47*sin(p.z*.57-p.x*.32+t*1.91);
          p.y+=.026*swell*smoothstep(.045,.60,aRiver.y);
          vec3 eye=normalize(cameraPosition-p);vec3 skyRay=reflect(-eye,vec3(0.,1.,0.));
          vec3 clear=mix(vec3(.72,.80,.86),vec3(.21,.51,.88),smoothstep(.001,.65,skyRay.y));
          vSky=rideCloudSky(clear,skyRay,cameraPosition);
          vPos=p;vRiver=aRiver;vAcross=aAcross;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        }`,
      fragmentShader:`uniform vec4 uSplash[16];uniform vec2 uWakeFocus;uniform float uWakeActive,uWakeTime;uniform sampler2D uWaterGrain;varying float vAcross;varying vec4 vRiver;varying vec3 vPos,vSky;
        ${weather.glsl}
        float hsh(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
        float gr(vec2 p){vec2 q=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(q),hsh(q+vec2(1,0)),f.x),mix(hsh(q+vec2(0,1)),hsh(q+vec2(1,1)),f.x),f.y);}
        vec3 linearWater(vec3 c){return mix(c/12.92,pow((max(c,vec3(0.))+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
        void main(){
          vec2 p=vPos.xz;float t=uWeatherTime,depth=vRiver.y,bank=vRiver.x,ford=vRiver.z,distanceCam=distance(cameraPosition,vPos);
          float shade=rideCloudShade(p),cloud=clamp(uWeatherCloud,0.,1.);
          // The water level gradually falls toward the north, along negative Z.
          vec2 flow=normalize(vec2(-vRiver.w,-1.)),crossing=vec2(flow.y,-flow.x);
          float s=-p.y,u=vAcross,wash=gr(p*.17+vec2(.052*t,.14*t));
          vec2 stretch=vec2(u*.066,s*.109);
          vec3 waterA=texture2D(uWaterGrain,stretch+vec2(.003*t,-.11*t)+vec2(wash*.053)).rgb;
          vec3 waterB=texture2D(uWaterGrain,mat2(.82,-.55,.55,.82)*stretch*2.67+vec2(.052*t,-.025*t)+waterA.rg*.13).rgb;
          vec2 chop=(waterA.rg-.5)*.33+(waterB.rg-.5)*.135;
          float grain=1.-smoothstep(.008,.16,length(fwidth(p)));
          float fine=waterB.b*2.-1.;
          vec2 slope=flow*chop.y+crossing*chop.x+uWeatherWind*(waterB.r-.5)*.079*uWeatherStrength;
          float wakeWash=0.;
          if(uWakeActive>.5&&distance(p,uWakeFocus)<42.){
            for(int i=0;i<16;i++){
              float age=uWakeTime-uSplash[i].z;if(age<0.||age>2.3||uSplash[i].w<.01)continue;
              vec2 delta=p-uSplash[i].xy-flow*age*.38;float rad=length(delta),phase=rad-(.14+age*1.32);
              float envelope=exp(-40.*phase*phase)*exp(-1.45*age)*uSplash[i].w;
              slope+=delta/max(.07,rad)*cos(phase*24.)*envelope*.38;
              wakeWash=max(wakeWash,envelope*(.50+.50*cos(phase*24.)));
            }
          }
          vec3 n=normalize(vec3(-slope.x,1.,-slope.y)),v=normalize(cameraPosition-vPos);
          float incidence=clamp(dot(n,v),0.,1.);float fres=.06+.76*pow(1.-incidence,3.3);
          vec3 shallow=mix(vec3(.29,.61,.51),vec3(.38,.77,.65),wash);
          vec3 pool=mix(vec3(.055,.449,.456),vec3(.09,.585,.545),wash);
          vec3 body=mix(shallow,pool,smoothstep(.15,1.85,depth));
          body*=mix(vec3(1.),vec3(.64,.75,.84),shade*.87+cloud*.11);
          vec3 surface=mix(body,vSky,clamp(fres+.046*fine,0.,.88));
          surface+=vec3(.070,.089,.064)*(waterA.b-.5)+vec3(.029,.040,.035)*(waterB.b-.5);
          // Fine pale crests follow currents around submerged gravel. Break up the
          // rim into brief wash lines so it never becomes an outlined shoreline.
          float ridge=smoothstep(.58,.84,waterB.b),crest=smoothstep(.52,.87,waterA.b);
          float cavities=smoothstep(.48,.8,gr(p*.76-flow*t*.63));
          float edge=(1.-smoothstep(.1,1.15,bank))*(.18+.60*cavities);
          float riffle=ford*(1.-smoothstep(.015,.41,depth))*(.14+.65*cavities);
          surface=mix(surface,vec3(.795,.915,.834),ridge*(edge+riffle)*(.45+.55*crest));
          // Material in the current follows a curved river station. A broad
          // smooth central velocity keeps foam recognisable as it drifts north.
          float station=s-t*1.36;
          float bend=texture2D(uWaterGrain,vec2(u*.044,station*.027)).b-.50;
          vec2 tracerUv=vec2((u+1.8*bend)*.174,station*.042);
          vec3 trail=texture2D(uWaterGrain,tracerUv).rgb;
          float lines=1.-smoothstep(.031,.13,abs(trail.b-.58));
          float breaks=smoothstep(.56,.78,texture2D(uWaterGrain,tracerUv*.54+vec2(.39,.04)).b);
          float tracers=lines*breaks*(.46+.54*crest);
          vec3 scum=mix(vec3(.67,.835,.744),vec3(.925,.963,.873),trail.r);
          surface=mix(surface,scum,tracers*.26);
          float caustic=(1.-smoothstep(.019,.058,abs(waterA.g-.51)))*crest*(1.-smoothstep(.28,1.24,depth));
          surface+=vec3(.092,.117,.060)*caustic*(1.-shade);
          surface=mix(surface,vec3(.84,.93,.90),wakeWash*.39);
          vec3 sun=normalize(vec3(.45,.75,.50));float halfDot=max(0.,dot(n,normalize(sun+v)));
          float glitter=pow(halfDot,135.)*(.3+.7*grain)*(1.-.92*shade);
          surface+=vec3(.80,.71,.45)*glitter+vec3(.048,.062,.05)*crest*grain*(1.-cloud);
          float atmospheric=smoothstep(190.,1280.,distanceCam)*(.31+.31*uWeatherHaze);
          surface=mix(surface,vec3(.64,.73,.79),atmospheric);
          float opacity=clamp(.49+.40*smoothstep(.04,1.66,depth)+.29*fres+edge*ridge*.19,.43,.985);
          opacity*=smoothstep(-.04,.15,bank);
          gl_FragColor=vec4(linearWater(surface),opacity);
          #include <colorspace_fragment>
        }`});
    material.forceSinglePass=true;
    const columns=20;
    for(let from=-5376;from<5376;from+=256){
      const step=from>=-2560&&from<2560?4:32;
      const pos=[],props=[],offsets=[],indices=[];
      for(let row=0;row<=256/step;row++){
        const z=from+row*step,r=world.river(z),dx=(world.river(z+1).x-world.river(z-1).x)*.5;
        for(let i=0;i<=columns;i++){
          const s=2*i/columns-1,offset=s*r.halfWidth,x=r.x+offset;
          pos.push(x,r.y+.018,z);
          props.push(r.halfWidth-Math.abs(offset),Math.max(0,r.y-terrainHeight(x,z)),r.fordWeight,dx);offsets.push(offset);
          if(i<columns&&row<256/step){const a=row*(columns+1)+i,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
        }
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
      g.setAttribute('aRiver',new T.Float32BufferAttribute(props,4));g.setAttribute('aAcross',new T.Float32BufferAttribute(offsets,1));g.setIndex(indices);g.computeBoundingSphere();
      const mesh=new T.Mesh(g,material);mesh.name='Turquoise river reach';mesh.renderOrder=1;scene.add(mesh);
    }
    gravelShoals(T,scene,world,weather,terrainHeight);
    return wake;
  }
  root.RideWater={build};
})(globalThis);
