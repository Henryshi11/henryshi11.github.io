(() => {
  // A few wind-borne oat husks give the player a close parallax cue even on
  // an open slope. They live in world space and settle behind a passing wheel.
  function looseSeeds(T, scene, height) {
    const ambientCount = 76, wakeCount = 24, count = ambientCount + wakeCount;
    const radius = 21;
    let noise = 41803;
    function random() {
      noise = (Math.imul(1664525, noise) + 1013904223) >>> 0;
      return noise / 4294967296;
    }
    const states = Array.from({length:count}, () => ({
      x:0, z:0, y:0, age:4, life:1, vx:0, vz:0, vy:0,
      size:.034+random()*.044, phase:random()*Math.PI*2, lift:.34+1.36*random()**2
    }));
    const positions = new Float32Array(count*3), appearance = new Float32Array(count*3);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('seedStyle',new T.BufferAttribute(appearance,3).setUsage(T.DynamicDrawUsage));
    const material = new T.ShaderMaterial({
      transparent:true, depthWrite:false,
      uniforms:{ viewportHeight:{value:720} },
      vertexShader:`attribute vec3 seedStyle;
        uniform float viewportHeight;
        varying float opacity;
        varying vec2 axis;
        void main() {
          vec4 eye=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*eye;
          float size=seedStyle.x*.5*projectionMatrix[1][1]*viewportHeight/max(.1,-eye.z);
          gl_PointSize=clamp(size,1.,16.);
          opacity=seedStyle.y*smoothstep(.75,2.0,size)*smoothstep(.18,.62,-eye.z);
          vec3 grassAxis=vec3(.868*cos(seedStyle.z),sin(seedStyle.z),-.497*cos(seedStyle.z));
          vec2 projected=(mat3(viewMatrix)*grassAxis).xy;
          axis=normalize(vec2(projected.x,-projected.y)+vec2(.0001));
        }`,
      fragmentShader:`varying float opacity;
        varying vec2 axis;
        void main(){
          vec2 p=gl_PointCoord-vec2(.5);
          p=vec2(dot(p,axis),dot(p,vec2(-axis.y,axis.x)));
          float belly=1.-smoothstep(.62,1.,length((p-vec2(-.08,0.))*vec2(3.3,8.9)));
          float awn=(1.-smoothstep(.014,.064,abs(p.y-.09*p.x)))*(1.-smoothstep(.15,.5,p.x))*smoothstep(-.09,.11,p.x);
          float alpha=opacity*(belly+.66*awn*(1.-belly));
          if(alpha<.014)discard;
          gl_FragColor=vec4(mix(vec3(.43,.36,.13),vec3(.96,.88,.59),smoothstep(-.40,.18,p.x)+.12*awn),alpha);
          #include <colorspace_fragment>
        }`
    });
    const mesh = new T.Points(geometry,material);
    mesh.name='Drifting grass seed and wheel wake';mesh.frustumCulled=false;
    const viewport = new T.Vector2();
    mesh.onBeforeRender = renderer => {
      renderer.getDrawingBufferSize(viewport);
      material.uniforms.viewportHeight.value=viewport.y;
    };
    scene.add(mesh);
    let initialized=false, lastTime=0, lastTravel=0, nextBrush=0, wakeCursor=0;
    function reset(x,z,travel) {
      for(let i=0;i<ambientCount;i++) {
        states[i].x=x+(random()*2-1)*radius;
        states[i].z=z+(random()*2-1)*radius;
      }
      for(let i=ambientCount;i<count;i++)states[i].age=states[i].life;
      nextBrush=travel+2.2+random()*3;wakeCursor=0;initialized=true;
    }
    function scatter(x,z,heading,speed) {
      const side=random()<.5?-1:1, fx=Math.sin(heading), fz=-Math.cos(heading);
      const total=2+Math.floor(random()*3);
      for(let i=0;i<total;i++) {
        const s=states[ambientCount+wakeCursor], offset=side*(.10+random()*.36);
        wakeCursor=(wakeCursor+1)%wakeCount;
        s.age=0; s.life=.82+random()*.74;
        s.x=x+fx*.50-fz*offset; s.z=z+fz*.50+fx*offset;
        s.y=height(s.x,s.z)+.18+random()*.12;
        const sweep=side*(.47+random()*1.25), carry=speed*(.11+random()*.12);
        s.vx=fx*carry-fz*sweep; s.vz=fz*carry+fx*sweep;
        s.vy=1.0+random()*.90+Math.min(1,speed/24)*.48;
      }
    }
    return function update(x,z,heading,travel,time,weather) {
      const dt=Math.max(0,Math.min(.12,time-lastTime));
      if(!initialized||travel<lastTravel||Math.abs(travel-lastTravel)>18)reset(x,z,travel);
      const speed=dt>0?(travel-lastTravel)/dt:0;
      if(travel>nextBrush && speed>2.5&&!RideTrails.isDeck(x,z)) {
        scatter(x,z,heading,speed);
        nextBrush=travel+4+random()*8;
      }
      lastTime=time;lastTravel=travel;
      const air=.18+weather.windSpeed*.34,wx=weather.windX,wz=weather.windZ;
      const dryAir=1-.82*weather.rain;
      const width=2*radius, drag=1-Math.exp(-2.9*dt);
      for(let i=0;i<count;i++) {
        const s=states[i], k=i*3, wave=time*(.93+.24*s.size)+s.phase;
        let opacity;
        if(i<ambientCount) {
          s.x+=dt*(wx*air+.18*Math.sin(wave));
          s.z+=dt*(wz*air+.11*Math.cos(wave));
          // Wrap only in the invisible rim; small camera/orbit movements never respawn a seed.
          s.x-=width*Math.floor((s.x-x+radius)/width);
          s.z-=width*Math.floor((s.z-z+radius)/width);
          s.y=height(s.x,s.z)+s.lift+.14*Math.sin(wave+s.z*.12);
          const rim=Math.max(Math.abs(s.x-x),Math.abs(s.z-z));
          opacity=.67*dryAir*Math.min(1,Math.max(0,(radius-rim)/4));
        } else {
          if(s.age>=s.life){appearance[k+1]=0;continue;}
          s.age+=dt;
          s.vx+=(air*wx-s.vx)*drag;s.vz+=(air*wz-s.vz)*drag;
          s.vy-=dt*3.75;s.x+=s.vx*dt;s.z+=s.vz*dt;s.y+=s.vy*dt;
          const above=s.y-height(s.x,s.z);
          opacity=.84*Math.max(0,Math.min(1,s.age*16,(s.life-s.age)*4,above*4.5));
        }
        positions[k]=s.x;positions[k+1]=s.y;positions[k+2]=s.z;
        appearance[k]=s.size;appearance[k+1]=opacity;
        appearance[k+2]=s.phase+.69*Math.sin(wave*1.53)+.29*Math.sin(wave*3.16);
      }
      geometry.attributes.position.needsUpdate=true;
      geometry.attributes.seedStyle.needsUpdate=true;
    };
  }

  window.RideMeadowLife = function(T,scene,height) {
    const updateSeeds=looseSeeds(T,scene,height);
    const birdCount=15,birdPositions=new Float32Array(birdCount*9*2);
    const birdsGeom=new T.BufferGeometry();
    birdsGeom.setAttribute('position',new T.BufferAttribute(birdPositions,3).setUsage(T.DynamicDrawUsage));
    const birds=new T.Mesh(birdsGeom,new T.MeshBasicMaterial({color:0xfff5db,side:T.DoubleSide,fog:true}));
    birds.name='Swifts above the meadow';birds.frustumCulled=false;scene.add(birds);
    function update(x,z,heading,travel,seconds,weather){

      updateSeeds(x,z,heading,travel,seconds,weather);
      for(let i=0;i<birdCount;i++){
        const a=i*2.39996,t=seconds*.10+a,px=-145+Math.cos(t*.38)*34+Math.sin(a)*i*5,py=189+Math.sin(t)*5+Math.sin(a*4)*i*2.8,pz=-665+Math.sin(t*.4)*53+i*5;
        const wing=.7*Math.sin(seconds*(3.9+i*.17)+a);
        for(let j=0;j<2;j++){
          const s=j?1:-1,k=i*18+j*9;
          birdPositions[k]=px;birdPositions[k+1]=py;birdPositions[k+2]=pz;
          birdPositions[k+3]=px+s*.85;birdPositions[k+4]=py+.33;birdPositions[k+5]=pz-.32;
          birdPositions[k+6]=px+s*1.95;birdPositions[k+7]=py+wing;birdPositions[k+8]=pz+.48;
        }
      }
      birdsGeom.attributes.position.needsUpdate=true;
    }
    return {update};
  };
})();
