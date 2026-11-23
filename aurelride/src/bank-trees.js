/* Riparian tree groups around the timber bridge and the western towpath. */
(() => {
  'use strict';
  const tau=Math.PI*2,maskBox=[-921,-668,314,365],maskSize=1024,shared=new WeakMap();
  function shadowUniforms(T){
    if(!shared.has(T))shared.set(T,{uBankCanopy:{value:null},uBankShadow:{value:0}});
    return shared.get(T);
  }
  const shadowGLSL=`
    uniform sampler2D uBankCanopy;uniform float uBankShadow;
    float bankTreeShade(vec2 p){
      vec2 uv=(p-vec2(-921.,-668.))/vec2(314.,365.);
      if(uBankShadow<.001||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return 0.;
      return texture2D(uBankCanopy,uv).r*uBankShadow;
    }`;
  function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
  function layout(T,land,trails) {
    const world=globalThis.RideWorld,trees=[],routes=[];
    for(const path of [...world.routes,trails.route]){
      const curve=new T.CatmullRomCurve3(path.points.map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal');
      const n=Math.ceil(curve.getLength()/3.6);
      for(let k=0;k<n;k++){
        const point=curve.getPointAt(k/n);
        if(point.x>maskBox[0]-10&&point.x< -608&&point.z>maskBox[1]-10&&point.z< -300)routes.push(point);
      }
    }
    // Offset from the varying channel centre, Z, mature height, willow flag.
    // The break at the bridge axis keeps the crossing and the distant arch in view.
    const positions=[
      [-46,-363,8.8,1],[-34,-375,7.6,1],[-58,-372,10.2,0],[-70,-386,8.0,0],
      [-33,-429,8.4,1],[-42,-436,10.1,0],[-31,-448,6.5,1],
      [-89,-459,8.6,0],[-115,-480,10.9,0],[-126,-491,7.3,0],
      [-39,-506,7.4,1],[-35,-516,8.2,0],[-49,-557,9.3,0],[-65,-593,7.5,1],
      [-117,-352,8.2,0],[-137,-343,10.1,0],[-153,-348,8.3,0],
      [38,-350,10.0,0],[32,-360,7.3,1],[42,-456,7.5,0]
    ];
    for(const [index,[offset,z,h,willow]] of positions.entries()){
      const ch=world.river(z);let x=ch.x+offset;
      // Allow for the whole spread of a bough, plus space for a chase camera.
      for(let k=0;k<4&&routes.some(p=>(p.x-x)**2+(p.z-z)**2<6.7**2);k++)x+=Math.sign(offset)*4;
      if(routes.some(p=>(p.x-x)**2+(p.z-z)**2<6.7**2))continue;
      trees.push({x,y:land.height(x,z),z,h,willow:!!willow,seed:83941+index*5473});
    }
    return trees;
  }
  function batch(){return {p:[],c:[],uv:[],bend:[],ix:[]};}
  function vertex(b,p,c,u,v,bend,origin){
    b.p.push(p.x,p.y,p.z);b.c.push(c.r,c.g,c.b);b.uv.push(u,v);b.bend.push(bend,origin.x,origin.z);
  }
  function geometry(T,b) {
    const g=new T.BufferGeometry();
    for(const [key,arr,n] of [['position',b.p,3],['color',b.c,3],['uv',b.uv,2],['bankBend',b.bend,3]])
      g.setAttribute(key,new T.Float32BufferAttribute(arr,n));
    g.setIndex(b.ix);g.computeBoundingSphere();return g;
  }
  function branch(T,b,t,points,radii,facets,color,stamps) {
    const origin=b.p.length/3,dir=new T.Vector3(),normal=new T.Vector3();
    const a=new T.Vector3(),c=new T.Vector3(),p=new T.Vector3(),tone=new T.Color();
    const light=new T.Vector3(.51,.76,.41),reference=new T.Vector3(.93,.0,.37);
    for(let j=0;j<points.length;j++){
      dir.subVectors(points[Math.min(points.length-1,j+1)],points[Math.max(0,j-1)]).normalize();
      a.crossVectors(dir,reference).normalize();c.crossVectors(dir,a).normalize();
      const h=(points[j].y-t.y)/t.h;
      for(let k=0;k<=facets;k++){
        const angle=tau*k/facets,rad=radii[j]*(1+.075*Math.cos(3*angle+j*.27));
        normal.copy(a).multiplyScalar(Math.cos(angle)).addScaledVector(c,Math.sin(angle));
        p.copy(points[j]).addScaledVector(normal,rad);
        const lit=.47+.53*Math.max(0,normal.dot(light))+.12*Math.max(0,h);
        tone.copy(color).multiplyScalar(lit*(.95+.055*Math.cos(5*angle+.83*j)));
        vertex(b,p,tone,k/facets,j/3,.09*Math.max(0,h*h),t);
        if(j&&k){const q=origin+j*(facets+1)+k;b.ix.push(q-facets-2,q-facets-1,q,q-facets-2,q,q-1);}
      }
      if(j)stamps.push({a:points[j-1],b:points[j],radius:radii[j-1],ground:t.y});
    }
  }
  function foliage(T,b,t,root,top,width,yaw,tile,tone,stamps,r) {
    const starting=b.p.length/3,side=new T.Vector3(Math.cos(yaw),.08*(r()-.5),Math.sin(yaw));
    const outward=new T.Vector3(-side.z,0,side.x),point=new T.Vector3(),c=new T.Color();
    const corners=[],h=(root.y-t.y)/t.h;
    for(let j=0;j<3;j++)for(let k=0;k<3;k++){
      const u=k/2,v=j/2;
      point.lerpVectors(root,top,v).addScaledVector(side,(u-.5)*width)
        .addScaledVector(outward,width*(.15+.19*v)*(1-(2*u-1)**2));
      point.y+=width*(.06+.08*v)*(1-(2*u-1)**2);
      c.copy(tone).multiplyScalar(.84+.23*v);
      const col=tile%2,row=tile>>1;
      vertex(b,point,c,(col+.009+.982*u)*.5,(1-row+.009+.982*v)*.5,
        .09*h*h+.13*v+.26*v*v,t);
      if((j===0||j===2)&&(k===0||k===2))corners.push(point.clone());
      if(j&&k){const q=starting+j*3+k;b.ix.push(q-4,q-3,q,q-4,q,q-1);}
    }
    stamps.push({corners,tile,ground:t.y});
  }

  function grow(T,t,wood,leaves,stamps) {
    const r=random(t.seed),h=t.h,willow=t.willow,angle=tau*r();
    const point=(x,y,z)=>new T.Vector3(t.x+x*h,t.y+y*h,t.z+z*h);
    const trunkTone=new T.Color(willow?0x8c8768:0x888173),twigTone=new T.Color(willow?0x9b9871:0x888465);
    const shade=new T.Color(0x9ab8a0),sun=new T.Color(0xffffcc),color=new T.Color();
    const leanX=.072*Math.cos(angle),leanZ=.072*Math.sin(angle);
    const stem=q=>point(leanX*q+.021*Math.sin(4*q)*Math.sin(angle),q,leanZ*q+.026*Math.sin(2.6*q)*Math.cos(angle));
    branch(T,wood,t,[point(0,-.012,0),stem(.10),stem(.26),stem(.48),stem(.68),stem(.91)],
      [.047,.035,.029,.021,.013,.003].map(n=>n*h),10,trunkTone,stamps);
    for(let k=0;k<5;k++){
      const a=angle+tau*k/5+.27*r(),ex=Math.cos(a),ez=Math.sin(a);
      branch(T,wood,t,[stem(.071),point(ex*.062,.015,ez*.06),point(ex*.105,-.009,ez*.103)],
        [.022*h,.014*h,.002*h],6,trunkTone,stamps);
    }
    for(let k=0;k<14;k++){
      const level=k/13,az=angle+k*2.39996+.36*(r()-.5),cx=Math.cos(az),cz=Math.sin(az);
      const start=.22+.57*level+.045*r(),base=stem(start);
      // Alder has a continuous rising leader. Willow scaffolds arch out and
      // carry hanging branchlets from the elbow as well as the branch end.
      const extent=(willow?.35:.282)*Math.sqrt(1-level*.88)*(.82+.28*r());
      const climb=(willow?.225:.25)*(.84+.34*r())*(1-level*.57);
      const mid=base.clone().add(new T.Vector3(cx*extent*.49,climb*.83,cz*extent*.49).multiplyScalar(h));
      const end=base.clone().add(new T.Vector3(cx*extent,climb*(willow?.87:1.10),cz*extent).multiplyScalar(h));
      branch(T,wood,t,[base,mid,end],[.016*h*(1-.42*level),.010*h,.0034*h],7,trunkTone,stamps);
      for(let j=0;j<4;j++){
        const a=az+(j-1.5)*.60+(r()-.5)*.43,dx=Math.cos(a),dz=Math.sin(a),spread=.073+.082*r();
        const joint=mid.clone().lerp(end,.22+.76*r());
        const tip=joint.clone().add(new T.Vector3(dx*spread,(willow?-.016:.026)+.061*r(),dz*spread).multiplyScalar(h));
        branch(T,wood,t,[joint,tip],[.0046*h,.0016*h],5,twigTone,stamps);
        for(let l=0;l<4;l++){
          const yaw=a+l*1.62+(r()-.5)*.47,vx=Math.cos(yaw),vz=Math.sin(yaw);
          const bottom=tip.clone().add(new T.Vector3(vx*.022,.012*r(),vz*.022).multiplyScalar(h));
          const reach=(willow?.055:.08)+r()*.068;
          const dy=willow?-(.105+.19*r()):.056+.142*r();
          const top=bottom.clone().add(new T.Vector3(vx*reach,dy,vz*reach).multiplyScalar(h));
          const illumination=Math.min(1,Math.max(0,.34+.25*(cx*.59+cz*.79)+.37*level+.20*r()));
          color.copy(shade).lerp(sun,illumination).multiplyScalar(.97+.49*illumination+.11*r());
          foliage(T,leaves,t,bottom,top,h*(willow?.12+.12*r():.15+.13*r()),yaw+Math.PI/2+.35*(r()-.5),
            (willow?2:0)+(r()<.5?0:1),color,stamps,r);
        }
      }
    }
  }
  function shadeGround(T,stamps,image,uniforms,land) {
    const mask=document.createElement('canvas');mask.width=mask.height=maskSize;
    const ink=mask.getContext('2d');
    ink.fillStyle='black';ink.fillRect(0,0,maskSize,maskSize);
    const white=document.createElement('canvas');white.width=image.width;white.height=image.height;
    const brush=white.getContext('2d');brush.drawImage(image,0,0);
    brush.globalCompositeOperation='source-in';brush.fillStyle='white';brush.fillRect(0,0,white.width,white.height);
    const dx=maskSize/maskBox[2],dz=maskSize/maskBox[3],tile=white.width/2;
    function project(p,base){
      let rise=p.y-base;
      rise=p.y-land.height(p.x-.643*rise,p.z-.81*rise);
      return [(p.x-.643*rise-maskBox[0])*dx,(p.z-.81*rise-maskBox[1])*dz];
    }
    for(const mark of stamps){
      if(mark.corners){
        const [bot,,top,right]=mark.corners,a=project(top,mark.ground),b=project(right,mark.ground),c=project(bot,mark.ground);
        ink.setTransform(b[0]-a[0],b[1]-a[1],c[0]-a[0],c[1]-a[1],a[0],a[1]);
        ink.globalAlpha=.53;ink.drawImage(white,(mark.tile%2)*tile,(mark.tile>>1)*tile,tile,tile,0,0,1,1);
      }else{
        const a=project(mark.a,mark.ground),b=project(mark.b,mark.ground);
        ink.setTransform(1,0,0,1,0,0);ink.globalAlpha=.58;ink.strokeStyle='white';ink.lineCap='round';
        ink.lineWidth=Math.max(.45,2*mark.radius*dx);ink.beginPath();ink.moveTo(...a);ink.lineTo(...b);ink.stroke();
      }
    }
    const map=new T.CanvasTexture(mask);map.flipY=false;map.minFilter=T.LinearMipmapLinearFilter;
    map.name='Bank trees in sunlight';uniforms.uBankCanopy.value=map;uniforms.uBankShadow.value=1;
  }
  function build(T,scene,land,trails) {
    const group=new T.Group();group.name='Riverbank alders and willows';scene.add(group);
    const trees=layout(T,land,trails),stamps=[],uniforms=shadowUniforms(T),weather=globalThis.RideWeather;
    let loaded;
    const loadedMap=new Promise(resolve=>{loaded=resolve;});
    const texture=new T.TextureLoader().load('art/bank-leaves.webp',map=>loaded(map),undefined,()=>loaded(null));
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    function material(leaves){
      const m=new T.MeshBasicMaterial({map:leaves?texture:null,side:T.DoubleSide,vertexColors:true,
        alphaTest:leaves?.22:0,fog:true});
      m.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,weather.uniforms(T));
        shader.vertexShader='attribute vec3 bankBend;\n'+weather.glsl+shader.vertexShader.replace('#include <begin_vertex>',`
          #include <begin_vertex>
          float load=rideWindFront(bankBend.yz,uWeatherTime);
          float movement=uWeatherStrength*(.17+.56*load+.23*sin(uWeatherTime*1.94+dot(position.xz,vec2(.36,.21))));
          transformed.xz+=uWeatherWind*bankBend.x*movement;
          transformed.y+=bankBend.x*.16*sin(uWeatherTime*2.7+position.z*.73+position.x*.47);
        `);
      };
      m.customProgramCacheKey=()=>leaves?'riparian-sprays':'riparian-wood';
      return weather.shadeMaterial(T,m);
    }
    const bark=material(false),leaves=material(true);
    // Independent stream reaches let the renderer skip trees behind the rider.
    const groups=new Map();
    for(const tree of trees){
      const key=Math.floor((tree.z+670)/90);
      if(!groups.has(key))groups.set(key,[batch(),batch()]);
      const pair=groups.get(key);grow(T,tree,...pair,stamps);
    }
    for(const pair of groups.values())for(let k=0;k<2;k++){
      const mesh=new T.Mesh(geometry(T,pair[k]),k?leaves:bark);
      mesh.name=k?'Leaf-bearing riparian branches':'Trunks and riverbank branches';group.add(mesh);
    }
    const ready=loadedMap.then(map=>{
      if(map)shadeGround(T,stamps,map.image,uniforms,land);
      stamps.length=0;return Boolean(map);
    });
    function close(x,z,r){
      return x>maskBox[0]-r&&x<maskBox[0]+maskBox[2]+r&&z>maskBox[1]-r&&z<maskBox[1]+maskBox[3]+r;
    }
    function blocked(x,z,r=.6,y) {
      if(!close(x,z,r))return false;
      return trees.some(t=>(y===undefined||y>=t.y-.5&&y<t.y+t.h*.43)
        &&Math.hypot(x-t.x,z-t.z)<r+.043*t.h);
    }
    function cameraFraction(a,b,r=.26){
      const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
      if(len<.00001||!close(a.x,a.z,r+Math.sqrt(len)))return 1;
      let nearest=1;
      for(const t of trees){
        const x=a.x-t.x,z=a.z-t.z,radius=r+.045*t.h,along=x*dx+z*dz;
        const disc=along*along-len*(x*x+z*z-radius*radius);if(disc<=0)continue;
        const root=Math.sqrt(disc),entry=Math.max(0,(-along-root)/len);
        if(entry>=nearest||(-along+root)/len<0)continue;
        const y=a.y+(b.y-a.y)*entry;if(y>=t.y-r&&y<t.y+.44*t.h+r)nearest=entry;
      }
      return nearest;
    }
    function update(x,z,time,w){
      group.visible=close(x,z,1050);
      if(uniforms.uBankCanopy.value)uniforms.uBankShadow.value=1-.55*(w?.rain||0);
    }
    return {ready,blocked,cameraFraction,update};
  }
  globalThis.RideBankTrees={build,shadowUniforms,shadowGLSL};
})();
