/* The timber crossing and its cast shadow. */
(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const palettes={
    iron:0x455663, brass:0xe8bc79, oak:0xeaebdf, aged:0xa99e91, dark:0x756e68
  };

  // Batch the deck, rails and posts by material. Keeping UVs in
  // metres gives both the big beams and the handrails the same grain size.
  function workshop(T,parent,materials,label){
    const batches=new Map(),cube=new T.BoxGeometry(1,1,1),cylinders=new Map();
    const matrix=new T.Matrix4(),normals=new T.Matrix3(),position=new T.Vector3(),scale=new T.Vector3();
    const vector=new T.Vector3(),normal=new T.Vector3(),white=new T.Color();
    const up=new T.Vector3(0,1,0),rotation=new T.Quaternion(),identity=new T.Quaternion();
    function batch(k){if(!batches.has(k))batches.set(k,{p:[],n:[],uv:[],c:[]});return batches.get(k);}
    function stamp(k,geometry,center,size,q,color){
      const b=batch(k),P=geometry.attributes.position,N=geometry.attributes.normal,U=geometry.attributes.uv;
      white.setHex(color);matrix.compose(position.set(...center),q,scale.set(...size));normals.getNormalMatrix(matrix);
      const ix=geometry.index;
      for(let j=0;j<(ix?ix.count:P.count);j++){
        const i=ix?ix.getX(j):j;
        vector.fromBufferAttribute(P,i);normal.fromBufferAttribute(N,i);
        let u,v;
        if(k==='wood'){
          if(Math.abs(normal.y)>.85){u=vector.x*size[0]/1.75;v=vector.z*size[2]/2.2;}
          else{u=(Math.abs(normal.x)>.65?vector.z*size[2]:vector.x*size[0])/1.75;v=vector.y*size[1]/5.4;}
          u+=(center[0]*.129+center[2]*.079)%1;v+=(center[2]*.081)%1;
        }else if(k==='stone'){
          u=(Math.abs(normal.x)>.7?vector.z*size[2]:vector.x*size[0])/8;
          v=(Math.abs(normal.y)>.7?vector.z*size[2]:vector.y*size[1])/5.5;
        }else{u=U.getX(i);v=U.getY(i);}
        vector.applyMatrix4(matrix);normal.applyMatrix3(normals).normalize();
        b.p.push(vector.x,vector.y,vector.z);b.n.push(normal.x,normal.y,normal.z);b.uv.push(u,v);
        b.c.push(white.r,white.g,white.b);
      }
    }
    function box(k,x,y,z,w,h,d,color){stamp(k,cube,[x,y,z],[w,h,d],identity,color);}
    function between(k,a,b,w,d,color,round=0,ratio=1){
      const delta=vector.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]),len=delta.length();if(len<.001)return;
      rotation.setFromUnitVectors(up,delta.multiplyScalar(1/len));
      let g=cube;
      if(round){
        const key=round+'/'+ratio;
        if(!cylinders.has(key))cylinders.set(key,new T.CylinderGeometry(ratio*.5,.5,1,round));
        g=cylinders.get(key);
      }
      stamp(k,g,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[w,len,d],rotation,color);
    }
    function finish(){
      for(const [k,b] of batches){
        const geo=new T.BufferGeometry();
        for(const [attr,arr,dim] of [['position',b.p,3],['normal',b.n,3],['uv',b.uv,2],['color',b.c,3]])
          geo.setAttribute(attr,new T.Float32BufferAttribute(arr,dim));
        geo.computeBoundingSphere();
        const mesh=new T.Mesh(geo,materials[k]);mesh.name=label+' / '+k;parent.add(mesh);
      }
      cube.dispose();for(const g of cylinders.values())g.dispose();
    }
    return {box,between,finish};
  }

  function bridgework(w,B,deck,riverY,obstacle){
    const {oak,aged,dark,iron,brass}=palettes;
    const beam=w.between,edge=B.railStart??23.6;
    for(let i=0;i<100;i++){
      const s=-26+(i+.5)*.52,y=deck(s);
      const tint=[0xf0e9d4,0xdddfd3,0xd1c7b8,0xe6d9bc,0xf1e7d2][(i*13+Math.floor(i*.37))%5];
      beam('wood',[s,y-.10,-2.3],[s,y-.10,2.3],.508,.20,tint);
      if(i%2===0)for(const side of [-1,1])
        w.box('plain',s,y+.001,side*1.82,.038,.012,.06,iron);
    }
    for(const side of [-1,1]){
      const z=side*2.15,span=edge*2/12;
      for(let j=0;j<=12;j++){
        const s=-edge+j*span,y=deck(s);
        beam('wood',[s,y-.72,z],[s,y+1.20,z],.23,.23,aged);
        w.box('plain',s,y+1.19,z,.27,.085,.27,iron);
        if(j===0||j===12)w.box('plain',s,y+1.27,z,.18,.095,.18,brass);
        if(j===12)continue;
        const ss=s+span,yy=deck(ss);
        beam('wood',[s,y+1.10,z],[ss,yy+1.10,z],.16,.19,oak);
        beam('wood',[s,y+.46,z],[ss,yy+.46,z],.09,.13,aged);
        beam('wood',[s,y-.55,z],[ss,yy-.55,z],.56,.31,aged);
        if(j%2===0)beam('wood',[s+.14,y+.16,z],[ss-.18,yy+.91,z],.105,.08,aged);
        obstacle((s+ss)/2,z,span*.5,.105,Math.min(y,yy)-.62,Math.max(y,yy)+1.2);
      }
    }
    for(const s of [-20,-9,4,16]){
      const y=deck(s);
      for(const side of [-1,1]){
        const z=side*1.72;
        beam('wood',[s,riverY-3.3,z+.15*side],[s,y-.21,z],.47,.47,dark,10,.90);
        w.box('plain',s,y-.77,z,.48,.16,.48,iron);
        beam('wood',[s,riverY-.4,z],[s-2.1,y-.48,z],.20,.22,aged);
        beam('wood',[s,riverY-.4,z],[s+2.1,y-.48,z],.20,.22,aged);
      }
      beam('wood',[s,y-.58,-2.38],[s,y-.58,2.38],.46,.50,aged);
    }
  }

  function groundShadows(T,group,land,river,bridge){
    const P=[],C=[],I=[],columns=52,rows=22;
    function softBox(x,z,x0,x1,z0,z1,feather){
      const d=Math.min(x-x0,x1-x,z-z0,z1-z);
      const t=clamp((d+feather)/(2*feather),0,1);return t*t*(3-2*t);
    }
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const xx=-34+i*67/columns,zz=-12+j*23/rows,x=xx+bridge.x,z=zz+bridge.z;
      const r=river(z),soil=land.height(x,z),wet=Math.abs(x-r.x)<r.halfWidth,y=wet?Math.max(r.y,soil):soil;
      const deckH=bridge.at(clamp(xx,-26,26),0,land.height).y;
      const a=softBox(xx+(deckH-y)*.54,zz+(deckH-y)*.78,-26,26,-2.42,2.42,.86)*.19;
      P.push(xx,y+(wet?.058:.082),zz);C.push(a);
      if(i<columns&&j<rows){const v=j*(columns+1)+i;I.push(v,v+1,v+columns+1,v+1,v+columns+2,v+columns+1);}
    }
    const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(P,3));
    geom.setAttribute('shade',new T.Float32BufferAttribute(C,1));geom.setIndex(I);
    const mat=new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
      blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
      blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
      vertexShader:'attribute float shade;varying float ink;void main(){ink=shade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying float ink;void main(){if(ink<.007)discard;gl_FragColor=vec4(.039,.069,.117,ink);\n#include <colorspace_fragment>\n}'
    });
    const mesh=new T.Mesh(geom,mat);mesh.name='Timber bridge / cast shadow';mesh.renderOrder=2;group.add(mesh);
  }

  function build(T,scene,land,trails){
    const river=root.RideWorld.river,B=trails.bridge;
    const group=new T.Group();group.name='Silver Bend timber crossing';group.position.set(B.x,0,B.z);scene.add(group);
    const mats={},pending=[];
    for(const [key,src] of Object.entries({wood:'art/mill-oak.webp',plain:null})){
      const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
      if(src)pending.push(new Promise(resolve=>{
        const img=new T.TextureLoader().load(src,()=>{material.needsUpdate=true;resolve(true);},undefined,()=>resolve(false));
        img.colorSpace=T.SRGBColorSpace;img.wrapS=img.wrapT=T.RepeatWrapping;img.anisotropy=4;material.map=img;
      }));
      if(root.RideWeather?.shadeMaterial)root.RideWeather.shadeMaterial(T,material);
      mats[key]=material;
    }
    const boxes=[];
    const obstacle=(x,z,rx,rz,low,high)=>boxes.push({x:x+B.x,z:z+B.z,rx,rz,low,high});
    const bridge=workshop(T,group,mats,'Bridge');
    bridgework(bridge,B,s=>B.at(s,0,land.height).y,river(B.z).y,obstacle);bridge.finish();
    groundShadows(T,group,land,river,B);
    function blocked(x,z,r=.60,y){
      const h=y??trails.rideHeight(x,z,land.height)+1;
      return boxes.some(b=>Math.abs(x-b.x)<b.rx+r&&Math.abs(z-b.z)<b.rz+r&&h>b.low-r&&h<b.high+r);
    }
    function cameraFraction(from,to,margin=.27){
      let fraction=1;
      const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
      for(const b of boxes){
        let lo=0,hi=fraction;
        function slab(s,d,min,max){
          if(Math.abs(d)<1e-8)return s>=min&&s<=max;
          const a=(min-s)/d,c=(max-s)/d;
          lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));return lo<=hi;
        }
        if(slab(from.x,dx,b.x-b.rx-margin,b.x+b.rx+margin)
          &&slab(from.z,dz,b.z-b.rz-margin,b.z+b.rz+margin)
          &&slab(from.y,dy,b.low-margin,b.high+margin))fraction=lo;
      }
      return fraction;
    }
    return {group,ready:Promise.all(pending).then(values=>values.every(Boolean)),blocked,cameraFraction};
  }
  root.RideTimberBridge={build};
})(globalThis);
