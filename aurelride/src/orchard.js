/* A cherry wood with a continuous footpath. Mature trunks share a small
   family of branch meshes. Flowering limbs, fallen blossom, and live petal
   emission all use the same planted world locations. */
(() => {
  'use strict';
  const TAU=Math.PI*2,cache=new WeakMap(),surveys=new WeakMap();
  const area={left:-552,top:-22,width:452,height:555},bucket=12;
  const smooth=(a,b,x)=>{const f=Math.max(0,Math.min(1,(x-a)/(b-a)));return f*f*(3-2*f);};
  const key=(i,j)=>i+2048*j;
  // Overlapping stands follow the bends of the trail. Open meadow reaches
  // between the outer arms, so the skyline has gaps and individual trees.
  const stands=[
    [-415,356,105,124],[-311,299,94,68],[-263,231,72,79],
    [-409,189,81,105],[-419,99,73,66],[-345,66,86,60],
    [-266,129,56,79],[-484,262,49,75],[-388,457,39,51],
    [-284,365,37,49],[-201,192,33,52],[-476,391,40,41],
    [-148,213,20,17],[-248,397,24,14],[-393,10,15,18]
  ];
  function generator(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
  function coverage(x,z){
    if(x<area.left||x>area.left+area.width||z<area.top||z>area.top+area.height)return 0;
    let distance=2;
    for(const [cx,cz,rx,rz] of stands){
      const dx=(x-cx)/rx,dz=(z-cz)/rz;distance=Math.min(distance,dx*dx+dz*dz);
    }
    const edge=.085*Math.sin(x*.071+z*.049)+.06*Math.cos(z*.092-x*.037);
    const canopy=1-smooth(.51,1.32,distance+edge);
    if(canopy===0)return 0;
    // Meadow fingers expose the sides of groups. A rider looking across
    // the grove can see into it between one ridge of blossoms and the next.
    const first=((x+215)/69)**2+((z-170-.28*(x+215))/20)**2;
    const second=((x+273)/60)**2+((z-318+.22*(x+273))/22)**2;
    const third=((x+345)/25)**2+((z-386-.20*(x+345))/62)**2;
    return canopy*smooth(.58,1.16,Math.min(first,second,third)+edge);
  }
  function survey(T){
    if(surveys.has(T))return surveys.get(T);
    const world=globalThis.RideWorld,roads=new Map(),corridors=new Map();
    for(const id of ['flowers','grand','river']){
      const points=world.routes.find(r=>r.id===id).points;
      const spline=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal');
      spline.arcLengthDivisions=points.length*70;
      const length=spline.getLength(),n=Math.ceil(length/1.6),samples=[];
      for(let i=0;i<n;i++){
        const p=spline.getPointAt(i/n);samples.push([p.x,p.z]);
        if(coverage(p.x,p.z)<=0)continue;
        const k=key(Math.floor(p.x/bucket),Math.floor(p.z/bucket));
        if(!corridors.has(k))corridors.set(k,[]);corridors.get(k).push(p);
      }
      roads.set(id,{spline,length,samples});
    }
    const trail={id:'cherry-path',surface:'earth',width:4.55,closed:true,samples:roads.get('flowers').samples};
    const segments=new Map();let station=0;
    for(let i=0;i<trail.samples.length;i++){
      const [x,z]=trail.samples[i],[nx,nz]=trail.samples[(i+1)%trail.samples.length],dx=nx-x,dz=nz-z;
      const length=Math.hypot(dx,dz),cell=key(Math.floor(x/bucket),Math.floor(z/bucket));
      if(!segments.has(cell))segments.set(cell,[]);
      segments.get(cell).push({x,z,dx,dz,length,station});station+=length;
    }
    const result={...roads.get('flowers'),trail,corridors,segments};surveys.set(T,result);return result;
  }
  function nearby(grid,x,z,r,visit){
    for(let j=Math.floor((z-r)/bucket);j<=Math.floor((z+r)/bucket);j++){
      for(let i=Math.floor((x-r)/bucket);i<=Math.floor((x+r)/bucket);i++){
        const row=grid.get(key(i,j));if(row)for(const t of row)if(visit(t)===false)return false;
      }
    }return true;
  }
  function layout(T,land){
    const surveyData=survey(T),random=generator(71641),trees=[],grid=new Map();
    function plant(x,z,trail=false){
      const forest=coverage(x,z);
      if(forest<.035||random()>(trail?.62+.38*forest:.16+.84*forest))return false;
      if(globalThis.RideWorld.waterDepth(x,z)>.02)return false;
      const clearance=trail?4.15:5.2;
      if(!nearby(surveyData.corridors,x,z,clearance,p=>Math.hypot(p.x-x,p.z-z)>=clearance))return false;
      const age=random(),spread=random(),shape=Math.floor(random()*5);
      const standHeight=.5+.27*Math.sin(x*.034+z*.011)+.23*Math.cos(z*.038-x*.013);
      const heightScale=1.05+.67*age+.49*standHeight+.34*forest+(age>.88?.29:0);
      const scale=.85+.49*age+.45*spread+.20*standHeight;
      const spacing=5.25+1.8*scale+3.1*(1-forest);
      if(!nearby(grid,x,z,13,t=>Math.hypot(x-t.x,z-t.z)>.5*(spacing+t.spacing)))return false;
      const tree={x,z,y:land.height(x,z),scale,heightScale,spacing,angle:TAU*random(),shape,seed:random()};
      const k=key(Math.floor(x/bucket),Math.floor(z/bucket));
      if(!grid.has(k))grid.set(k,[]);grid.get(k).push(tree);trees.push(tree);
      return true;
    }
    // Boughs lean over the bends while the trunk clearance is independent
    // of the canopy radius. A bicycle still fits between adjacent trees.
    const {spline,length}=surveyData;
    for(const side of [-1,1]){
      let distance=side<0?1.9:6.6;
      while(distance<length){
        const t=distance/length,p=spline.getPointAt(t),v=spline.getTangentAt(t),offset=side*(4.4+random()*2.35);
        plant(p.x-v.z*offset,p.z+v.x*offset,true);
        distance+=8.2+8.7*random();
      }
    }
    for(let i=0;i<2700;i++)plant(area.left+random()*area.width,area.top+random()*area.height);
    return {trees,grid};
  }
  function surfaceAt(x,z){
    if(x<area.left||x>area.left+area.width||z<area.top||z>area.top+area.height)return null;
    const s=survey(globalThis.THREE);let best=2.84,station=0;
    nearby(s.segments,x,z,5,seg=>{
      const rx=x-seg.x,rz=z-seg.z,t=Math.min(1,Math.max(0,(rx*seg.dx+rz*seg.dz)/(seg.length**2)));
      const d=Math.hypot(rx-t*seg.dx,rz-t*seg.dz);if(d>=best)return;
      best=d;station=seg.station+t*seg.length;
    });
    const weight=1-smooth(s.trail.width*.5-.32,s.trail.width*.5+.42,best);
    return weight>0?{material:'earth',weight,station}:null;
  }
  function shadowUniforms(T){
    if(!cache.has(T))cache.set(T,{uOrchardMask:{value:null},uOrchardReady:{value:0},uCherrySway:{value:new T.Vector2()}});
    return cache.get(T);
  }
  const shadowGLSL=`
    uniform sampler2D uOrchardMask; uniform float uOrchardReady;uniform vec2 uCherrySway;
    vec3 cherryField(vec2 p){
      vec2 uv=(p-vec2(-552.,-22.))/vec2(452.,555.);
      if(uOrchardReady<.001||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return vec3(0.);
      return texture2D(uOrchardMask,uv).rgb;
    }
    float orchardShade(vec2 p){return cherryField(p+uCherrySway).r*uOrchardReady;}
    float orchardWoodland(vec2 p){return cherryField(p).g;}
  `;
  function paintFloor(T,trees,u){
    const n=960,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
    const ink=canvas.getContext('2d'),pixel=n/area.width;
    ink.setTransform(pixel,0,0,n/area.height,-area.left*pixel,-area.top*n/area.height);
    ink.fillStyle='#000';ink.fillRect(area.left,area.top,area.width,area.height);
    // Each red crown shadow contains small sun windows; ground litter (blue)
    // drifts further downwind. Green is the continuous extent of woodland.
    ink.globalCompositeOperation='screen';
    const gradient=(x,z,rad,inner,mid)=>{
      const g=ink.createRadialGradient(x,z,.08,x,z,rad);
      g.addColorStop(0,inner);g.addColorStop(.59,mid);g.addColorStop(1,'rgba(0,0,0,0)');
      ink.fillStyle=g;ink.fillRect(x-rad,z-rad,rad*2,rad*2);
    };
    for(const t of trees){
      gradient(t.x,t.z,15.4*t.scale,'rgb(0,249,0)','rgb(0,218,0)');
      gradient(t.x+2.0*t.scale,t.z-1.2*t.scale,8.3*t.scale,'rgb(0,0,205)','rgb(0,0,116)');
      const sx=t.x-3.9*t.heightScale,sz=t.z-2.4*t.heightScale;
      for(let j=0;j<5;j++){
        const a=t.angle+TAU*j/5,s=t.scale;
        gradient(sx+2.38*s*Math.cos(a),sz+2.38*s*Math.sin(a),3.8*s,'rgb(213,0,0)','rgb(151,0,0)');
      }
      ink.strokeStyle='rgb(105,0,0)';ink.lineWidth=.46*t.scale;
      ink.beginPath();ink.moveTo(t.x,t.z);ink.lineTo(sx,sz);ink.stroke();
    }
    // Openings in the blossom canopy project irregular shafts of sunlight.
    // Only the red shadow channel changes; the woodland and litter stay put.
    ink.globalCompositeOperation='multiply';
    for(const t of trees){
      const random=generator(Math.floor(t.seed*1e8)),cx=t.x-3.9*t.heightScale,cz=t.z-2.4*t.heightScale;
      for(let k=0;k<13;k++){
        const a=random()*TAU,r=Math.sqrt(random())*6.5*t.scale,xx=cx+r*Math.cos(a),zz=cz+r*Math.sin(a);
        const radius=(.61+1.46*random()**2)*t.scale;
        ink.save();ink.translate(xx,zz);ink.rotate(-.54+.46*random());ink.scale(1.35,.81);
        gradient(0,0,radius,'rgb(23,255,255)','rgb(89,255,255)');ink.restore();
      }
    }
    const map=new T.CanvasTexture(canvas);map.flipY=false;map.magFilter=T.LinearFilter;
    map.minFilter=T.LinearMipmapLinearFilter;map.anisotropy=2;u.uOrchardMask.value=map;u.uOrchardReady.value=1;
    const size=384,probe=document.createElement('canvas');probe.width=probe.height=size;
    const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,size,size);
    const colors=ctx.getImageData(0,0,size,size).data,shade=new Uint8Array(size*size);
    for(let i=0;i<shade.length;i++)shade[i]=colors[4*i];
    globalThis.RideOrchard.shadeAt=(x,z)=>{
      const px=(x+u.uCherrySway.value.x-area.left)*size/area.width-.5,pz=(z+u.uCherrySway.value.y-area.top)*size/area.height-.5;
      const ix=Math.floor(px),iz=Math.floor(pz);if(ix<0||iz<0||ix>=size-1||iz>=size-1)return 0;
      const fx=px-ix,fz=pz-iz,k=iz*size+ix;
      const a=shade[k]*(1-fx)+shade[k+1]*fx,b=shade[k+size]*(1-fx)+shade[k+size+1]*fx;
      return ((1-fz)*a+fz*b)*u.uOrchardReady.value/255;
    };
  }
  function batch(){return {verts:[],cols:[],uv:[],index:[]};}
  function vertex(batch,p,color,u,v){
    batch.verts.push(p.x,p.y,p.z);batch.cols.push(color.r,color.g,color.b);batch.uv.push(u,v);
  }
  function geometry(T,b){
    const g=new T.BufferGeometry();
    for(const [name,key,sz] of [['position','verts',3],['color','cols',3],['uv','uv',2]])
      g.setAttribute(name,new T.Float32BufferAttribute(b[key],sz));
    g.setIndex(b.index);g.computeBoundingSphere();return g;
  }
  function grow(T,id){
    const wood=batch(),flowers=batch(),rnd=generator(81373+13817*id),v=(x,y,z)=>new T.Vector3(x,y,z);
    const p=v(0,0,0),color=new T.Color(),axis=v(0,0,0),radial=v(0,0,0),side=v(0,0,0),across=v(0,0,0);
    function limb(points,radii,sides,steps,flare=false){
      const curve=new T.CatmullRomCurve3(points,false,'centripetal'),first=wood.verts.length/3;
      const startAngle=rnd()*TAU,offset=rnd()*2,repeat=Math.max(.19,radii[0]*6.6);
      const initial=curve.getTangent(0);side.set(Math.abs(initial.y)>.82?1:0,Math.abs(initial.y)>.82?0:1,0);
      side.addScaledVector(initial,-side.dot(initial)).normalize();
      let distance=0,last=null;
      for(let i=0;i<=steps;i++){
        const t=i/steps,position=curve.getPoint(t),at=t*(radii.length-1),lo=Math.floor(at);
        const r=T.MathUtils.lerp(radii[lo],radii[Math.min(lo+1,radii.length-1)],at-lo);
        if(last)distance+=last.distanceTo(position);last=position;
        axis.copy(curve.getTangent(t)).normalize();
        // Transport the preceding frame through the fork. Its bark fluting
        // and lenticels keep their orientation around the whole bend.
        side.addScaledVector(axis,-side.dot(axis)).normalize();across.crossVectors(axis,side).normalize();
        for(let k=0;k<=sides;k++){
          const a=k/sides*TAU+startAngle;
          radial.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(across,Math.sin(a));
          const ridge=.038*Math.cos(3*a+1.4*t)+.025*Math.sin(5*a-.8*t);
          const rootLobe=flare?.24*Math.exp(-10*t)*Math.cos(5*a+.3):0;
          p.copy(position).addScaledVector(radial,r*(1+ridge+rootLobe));
          const sun=Math.max(0,radial.x*.48+radial.y*.66+radial.z*.57);
          const sky=.5+.5*radial.y,base=.90+.06*Math.min(1,position.y*.34);
          const foot=smooth(-.02,.60,position.y);
          color.setRGB((.44+.58*sun+.14*sky)*base*(.84+.16*foot),(.49+.53*sun+.14*sky)*base,
            (.60+.41*sun+.13*sky)*base*(.89+.11*foot));
          vertex(wood,p,color,offset+k/sides*repeat,distance*.64+offset);
          if(i&&k){const q=first+i*(sides+1)+k;wood.index.push(q-sides-2,q-sides-1,q,q-sides-2,q,q-1);}
        }
      }
    }
    // Each spray wraps gently around its branch. Short terminal sprays sit
    // apart from the longer boughs and retain a view of the fork between them.
    function spray(center,azimuth,width,height,dip,bow,tilt,tint,tile){
      const first=flowers.verts.length/3,cs=Math.cos(azimuth),sn=Math.sin(azimuth),flip=rnd()<.5;
      const warm=.99+.025*rnd(),cols=4,rows=3;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const u=col/(cols-1),t=row/(rows-1),s=2*u-1;
        const arch=(1-s*s),offset=bow*arch*(.37+.63*Math.sin(Math.PI*t))+(t-.5)*tilt;
        const across=(u-.5)*width,edge=dip*s+(t*.08+.18)*arch;
        p.set(center.x+cs*across-sn*offset,center.y+(t-.5)*height+edge,center.z+sn*across+cs*offset);
        const light=smooth(3.3,7.15,p.y)*.62+t*.23+(.5+.5*Math.cos(azimuth-.75))*.15;
        color.setRGB(tint*warm*(.60+.47*light),tint*(.56+.47*light),tint*(.66+.40*light));
        vertex(flowers,p,color,(tile+.012+.976*(flip?1-u:u))/3,.012+.976*t);
        if(row&&col){const q=first+cols*row+col;flowers.index.push(q-cols-1,q-cols,q,q-cols-1,q,q-1);}
      }
    }
    const az=rnd()*TAU,nx=Math.cos(az),nz=Math.sin(az);
    const polar=(a,r,up)=>v(Math.cos(a)*r,up,Math.sin(a)*r);
    const lift=(base,a,r,h)=>base.clone().add(polar(a,r,h));
    const collar=v(-.13*nz,.48,.13*nx),trunkFork=v(.44*nx,1.73+.38*rnd(),.44*nz),upperFork=v(.12*nx-.38*nz,2.86+.38*rnd(),.12*nz+.38*nx);
    const leader=lift(upperFork,az-.43,.54,1.08),crest=lift(leader,az-.28,.76,1.17);
    limb([v(0,-.14,0),collar,trunkFork,upperFork,leader,crest],[.53,.342,.27,.204,.111,.041],10,12,true);
    for(let j=0;j<5;j++){
      const a=az+TAU*j/5+.39*(rnd()-.5),len=.54+.45*rnd();
      limb([v(.12*Math.cos(a),.36,.12*Math.sin(a)),polar(a,len*.63,.06),polar(a+.12,len,-.11)],[.120,.085,.011],5,4);
    }
    // Older limbs grow from different heights and run outward before raising
    // the last year's flowering twigs to the light.
    for(let j=0;j<6;j++){
      const a=az+j*2.40+.50*(rnd()-.5),start=j===0?trunkFork:j===1?trunkFork.clone().lerp(upperFork,.44):
        j===2?upperFork:j===3?upperFork.clone().lerp(leader,.42):j===4?leader:crest;
      const spread=j<3?1.06+.46*rnd():.46+.53*rnd(),h=j<2?.73+.38*rnd():.58+.32*rnd();
      const elbow=lift(start,a-.18,spread*.49,h*.54);
      const fork=lift(start,a,spread,h),entry=j===0?.195:j===1?.158:j===2?.138:j===3?.106:j===4?.085:.052;
      // Let the parent pass smoothly through a fork instead of ending it
      // flat under two equally thick children.
      const forward=lift(fork,a+.12,.46+.22*rnd(),.47+.40*rnd());
      limb([start,elbow,fork,forward],[entry,entry*.77,entry*.54,entry*.25],7,7);
      for(let k=0;k<3;k++){
        const d=a+(k-1)*(.64+.16*rnd())+.18*(rnd()-.5);
        const anchor=k===1?forward:fork.clone().lerp(forward,k===2?.65:.15);
        const reach=j<3?1.74+.83*rnd():1.25+.79*rnd();
        const end=lift(anchor,d,reach,(j<2?.65:.72)+.78*rnd());
        const bend=anchor.clone().lerp(end,.49);bend.add(polar(d+1.2,.28,-.22));
        const thickness=entry*(k===1?.31:.37);
        limb([anchor,bend,end],[thickness,thickness*.71,.013],5,4);
        const left=lift(end,d-.48,.59+.25*rnd(),.20+.31*rnd());
        const right=lift(end,d+.68,.49+.35*rnd(),-.09+.23*rnd());
        limb([bend,end,left],[thickness*.53,.016,.0035],4,3);
        limb([end.clone().lerp(bend,.14),end.clone().lerp(right,.53),right],[.022,.012,.0025],4,3);
        const width=2.13+.65*rnd(),height=1.50+.42*rnd(),tile=Math.floor(rnd()*3);
        const principal=end.clone().lerp(left,.20);principal.y+=.20;
        spray(principal,d-.22,width,height,.18+.13*rnd(),.29+.3*rnd(),.42+.74*rnd(),.96+.06*rnd(),tile);
        const spray2=right.clone().lerp(end,.12);spray2.y+=.11;
        spray(spray2,d+1.05,width*.68,height*.76,-.095,.22,.40+.24*rnd(),.92+.07*rnd(),(tile+1)%3);
        const high=left.clone();high.y+=.18;
        spray(high,d-.99,width*.75,height*.77,.12,.23,.59+.29*rnd(),1.00+.05*rnd(),(tile+2)%3);
        if((j+k)%3===1){
          const mid=anchor.clone().lerp(bend,.61);mid.add(polar(d+.72,.37,.13));
          spray(mid,d+1.55,width*.64,height*.59,.06,.19,.81,.93,(tile+2)%3);
        }
      }
    }
    // Intrinsically different crown architectures share exactly the same
    // transformation for their live near geometry and their distant portrait.
    const [breadth,rise,lean,twist]=[[1.12,.91,.10,.075],[.86,1.08,-.10,-.12],[.97,.96,.16,.08],
      [.92,1.03,-.14,.16],[1.08,1.03,-.05,-.10]][id];
    for(const part of [wood,flowers])for(let j=0;j<part.verts.length;j+=3){
      const x=part.verts[j],y=part.verts[j+1],z=part.verts[j+2],f=smooth(1.,6.6,y);
      part.verts[j]=x*(1+(breadth-1)*f)+lean*y*f;
      part.verts[j+1]=y*(1+(rise-1)*f)+twist*x*f;
      part.verts[j+2]=z*(1+(breadth-1)*f)-lean*.34*y*f;
    }
    return [geometry(T,wood),geometry(T,flowers)];
  }


  function petalDrift(T,group){
    const geom=new T.InstancedBufferGeometry(),capacity=4900,perTree=34;
    // One cupped, slightly notched cherry petal; alternating the faces as it
    // turns catches the light even in gaps between nearby crowns.
    const outline=[[0,-1],[.49,-.40],[.83,.25],[.72,.70],[.35,.95],[.08,.74],[-.25,1],[-.64,.81],[-.81,.37],[-.64,-.32]];
    const positions=[0,0,.29],indices=[];
    for(const [x,y] of outline)positions.push(x,y,.10*Math.abs(x)+.06*y);
    for(let i=0;i<outline.length;i++)indices.push(0,i+1,1+(i+1)%outline.length);
    geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));geom.setIndex(indices);
    const source=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);
    const phase=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);
    geom.setAttribute('releasePoint',source);geom.setAttribute('petalShape',phase);geom.instanceCount=0;
    const clock={value:0},strength={value:1},wind={value:new T.Vector2(.86,-.49)},rider={value:new T.Vector2()};
    const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{time:clock,gust:strength,drift:wind,rider},
      vertexShader:`
        attribute vec4 releasePoint,petalShape;
        uniform float time,gust;uniform vec2 drift,rider;
        varying float blush;varying float shaft;
        void main(){
          float seed=petalShape.y*6.28318,drop=fract(petalShape.x+time*(.53+.39*petalShape.z)/max(1.,releasePoint.w));
          float age=drop*releasePoint.w;
          vec2 origin=releasePoint.xz;
          vec2 curl=vec2(sin(time*1.05+seed+3.1*drop),cos(time*.83+seed*1.3-4.*drop));
          vec3 centre=releasePoint.xyz;
          centre.y-=age;centre.y+=.13*sin(time*1.24+seed+5.*drop)*sin(drop*3.1415);
          centre.xz+=drift*age*(.40+.53*gust)+curl*(.15+.56*drop);
          float proximity=distance(rider,centre.xz);
          float fade=smoothstep(0.,.09,drop)*(1.-smoothstep(.82,.998,drop))*(1.-smoothstep(26.,40.,proximity));
          float size=(.025+.030*petalShape.w)*sqrt(fade);
          float turn=time*(1.05+1.71*petalShape.y)+seed+2.2*sin(drop*6.28+seed);
          float pitch=sin(turn*.77+seed*2.8),yaw=turn*.68;
          vec3 leaf=position*size;
          leaf.yz=mat2(cos(pitch),sin(pitch),-sin(pitch),cos(pitch))*leaf.yz;
          leaf.xz=mat2(cos(yaw),sin(yaw),-sin(yaw),cos(yaw))*leaf.xz;
          leaf.xy=mat2(cos(turn),sin(turn),-sin(turn),cos(turn))*leaf.xy;
          blush=petalShape.z;shaft=.44+.38*position.y+.13*cos(turn);
          gl_Position=projectionMatrix*viewMatrix*vec4(centre+leaf,1.);
        }`,
      fragmentShader:`varying float blush,shaft;void main(){
        vec3 color=mix(vec3(.97,.72,.79),vec3(1.,.93,.90),blush*.56+shaft*.44);
        color*=gl_FrontFacing?1.:.93;gl_FragColor=vec4(color,1.);
      }`});
    const mesh=new T.Mesh(geom,material);mesh.name='Falling cherry petals';mesh.frustumCulled=false;group.add(mesh);
    function emit(x,z,grid){
      let count=0,emitters=0;
      nearby(grid,x,z,48,t=>{
        if((x-t.x)**2+(z-t.z)**2>47*47||count+perTree>capacity)return;
        emitters++;const r=generator(1+Math.floor(t.seed*1e8));
        for(let k=0;k<perTree;k++){
          const a=r()*TAU,rad=(.6+3.75*Math.sqrt(r()))*t.scale;
          const dx=Math.cos(a)*rad,dz=Math.sin(a)*rad,h=(4.0+.98*r()+.85*(1-rad/(4.4*t.scale)))*t.heightScale;
          source.setXYZW(count,t.x+dx,t.y+h,t.z+dz,h+.04);
          phase.setXYZW(count,r(),r(),r(),r());count++;
        }
      });
      source.needsUpdate=phase.needsUpdate=true;geom.instanceCount=count;return emitters;
    }
    return {emit,mesh,geom,update(x,z,time,w){
      rider.value.set(x,z);clock.value=time;strength.value=w?.windStrength??.55;
      wind.value.set(w?.windX??.86,w?.windZ??-.49);
      mesh.visible=geom.instanceCount>0;
    }};
  }
  function build(T,scene,land){
    const {trees,grid}=layout(T,land),group=new T.Group(),u=shadowUniforms(T);
    group.name='Flowering cherry wood';scene.add(group);paintFloor(T,trees,u);
    const rider={value:new T.Vector2()},clock={value:0},wind={value:.5};
    const loading=[],loader=new T.TextureLoader();
    function texture(path){
      let done;loading.push(new Promise(resolve=>{done=resolve;}));
      const map=loader.load(path,()=>done(true),undefined,()=>done(false));
      map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
    }
    const portraitInk=texture('art/cherry-crowns.webp'),flowerInk=texture('art/cherry-sprays.webp');
    function layer(map,kind){
      const isBark=kind==='bark',far=kind==='portrait';
      const material=new T.MeshBasicMaterial({map,side:far?T.FrontSide:T.DoubleSide,vertexColors:true,
        fog:true,alphaTest:isBark?0:.30});
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,{cherryRider:rider,cherryTime:clock,cherryWind:wind});
        const viewAttrs=far?'attribute float crownKind;varying float crownView,crownRow;\n':'';
        shader.vertexShader=viewAttrs+'uniform vec2 cherryRider;uniform float cherryTime,cherryWind;varying float cherryTransition;\n'+
          shader.vertexShader.replace('#include <begin_vertex>',`
            #include <begin_vertex>
            vec2 tree=instanceMatrix[3].xz;
            float stage=distance(cherryRider,tree)+4.*sin(tree.x*.17+tree.y*.24);
            cherryTransition=${far?'smoothstep(48.,61.,stage)':'smoothstep(60.,75.,stage)'};
            ${far?`vec2 towards=normalize(cameraPosition.xz-tree+vec2(.0001));
              vec2 look=vec2(dot(towards,normalize(instanceMatrix[0].xz)),dot(towards,normalize(instanceMatrix[2].xz)));
              transformed.xz=vec2(look.y,-look.x)*position.x;
              crownView=mod(atan(look.x,look.y)*1.27323954+8.,8.);crownRow=crownKind;`:
              (isBark?'':`float sway=sin(cherryTime*1.53+tree.x*.061-tree.y*.073)+.42*sin(cherryTime*2.+position.x+.72*position.z);
               transformed.xz+=vec2(.083,-.046)*cherryWind*sway*smoothstep(3.2,7.,position.y);`)}
          `);
        if(far)shader.fragmentShader='varying float crownView,crownRow;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
          vec2 inset=clamp(vMapUv,vec2(.0025),vec2(.9975));
          vec2 cell=vec2(floor(crownView),4.-crownRow), atlas=vec2(8.,5.);
          vec4 from=texture2D(map,(cell+inset)/atlas);
          vec4 to=texture2D(map,(vec2(mod(cell.x+1.,8.),cell.y)+inset)/atlas);
          float blend=smoothstep(.14,.86,fract(crownView));
          vec4 paint=mix(vec4(from.rgb*from.a,from.a),vec4(to.rgb*to.a,to.a),blend);
          diffuseColor*=vec4(paint.rgb/max(paint.a,.001),paint.a);
        `);
        shader.fragmentShader='varying float cherryTransition;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
          #include <alphatest_fragment>
          float samplePixel=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
          if(${far?'samplePixel>=cherryTransition':'samplePixel<cherryTransition'})discard;
        `);
      };
      material.customProgramCacheKey=()=>'cherry-wood-5-'+kind;
      return globalThis.RideWeather.shadeMaterial(T,material);
    }
    const barkInk=texture('art/cherry-bark.webp');barkInk.wrapS=barkInk.wrapT=T.RepeatWrapping;
    const woodMat=layer(barkInk,'bark'),bloomMat=layer(flowerInk,'crown'),farMat=layer(portraitInk,'portrait');
    const instance=new T.Object3D(),prototypes=[],variants=5;
    const instances=Array.from({length:variants},()=>[]);
    for(const tree of trees){
      instance.position.set(tree.x,tree.y,tree.z);instance.rotation.y=tree.angle;
      instance.scale.set(tree.scale,tree.heightScale,tree.scale);instance.updateMatrix();tree.matrix=instance.matrix.clone();
      instances[tree.shape].push(tree);
    }
    for(let k=0;k<variants;k++){
      const close=grow(T,k).map((shape,i)=>{
        const mesh=new T.InstancedMesh(shape,i?bloomMat:woodMat,instances[k].length);
        mesh.name=i?'Flowering boughs':'Cherry wood and spreading limbs';mesh.count=0;mesh.frustumCulled=false;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);return mesh;
      });
      prototypes.push(close);
    }
    const tileGroups=new Map();
    for(const t of trees){
      const id=key(Math.floor(t.x/135),Math.floor(t.z/135));
      if(!tileGroups.has(id))tileGroups.set(id,[]);tileGroups.get(id).push(t);
    }
    for(const members of tileGroups.values()){
      // Eight views of each actual branch mesh share its origin and bounds.
      // At distance, one six-index card replaces the entire mature tree.
      const b=batch();
      for(const [s,t] of [[0,0],[1,0],[1,1],[0,1]])
        vertex(b,new T.Vector3((s-.5)*18,t*10.5-.25,0),new T.Color(0xffffff),s,t);
      b.index.push(0,1,2,0,2,3);
      const shape=geometry(T,b);
      shape.setAttribute('crownKind',new T.InstancedBufferAttribute(Float32Array.from(members,t=>t.shape),1));
      const mesh=new T.InstancedMesh(shape,farMat,members.length);
      mesh.name='Distant cherry crowns';
      members.forEach((tree,index)=>mesh.setMatrixAt(index,tree.matrix));
      mesh.computeBoundingSphere();mesh.boundingSphere.radius+=16;group.add(mesh);
    }
    const petals=petalDrift(T,group),info={trees:trees.length,closeTrees:0,petalEmitters:0,petals:0,coverage:0,time:0};
    let refreshedX=Infinity,refreshedZ=Infinity;
    function update(x,z,time,w){
      clock.value=time;wind.value=.38+(w?.windStrength??.65);
      const breeze=.14*Math.sin(time*1.53)+.06*Math.sin(time*2.29);
      u.uCherrySway.value.set(breeze*(w?.windX??.86),breeze*(w?.windZ??-.49));
      rider.value.set(x,z);u.uOrchardReady.value=1-.36*(w?.rain||0);
      if(Math.hypot(x-refreshedX,z-refreshedZ)>4){
        refreshedX=x;refreshedZ=z;const counts=Array(variants).fill(0);
        nearby(grid,x,z,80,t=>{
          if((t.x-x)**2+(t.z-z)**2>80**2)return;
          const slot=counts[t.shape]++;
          for(const mesh of prototypes[t.shape])mesh.setMatrixAt(slot,t.matrix);
        });
        for(let k=0;k<variants;k++)for(const mesh of prototypes[k]){
          mesh.count=counts[k];mesh.visible=counts[k]>0;mesh.instanceMatrix.needsUpdate=true;
        }
        info.closeTrees=counts.reduce((a,b)=>a+b,0);
        info.petalEmitters=petals.emit(x,z,grid);info.petals=petals.geom.instanceCount;
      }
      info.coverage=coverage(x,z);info.time=time;petals.update(x,z,time,w);
      group.visible=x>area.left-1250&&x<area.left+area.width+1250&&z>area.top-1250&&z<area.top+area.height+1250;
    }
    function blocked(x,z,radius=.6,eye){
      return !nearby(grid,x,z,radius+1,t=>{
        if(eye!==undefined&&(eye<t.y-.3||eye>t.y+2.7*t.heightScale))return true;
        return (x-t.x)**2+(z-t.z)**2>(.36*t.scale+radius)**2;
      });
    }
    function cameraFraction(a,b,margin=.26){
      const dx=b.x-a.x,dz=b.z-a.z,ds=dx*dx+dz*dz;if(ds<.0001)return 1;
      let nearest=1;
      nearby(grid,(a.x+b.x)*.5,(a.z+b.z)*.5,Math.sqrt(ds)*.5+1.4,t=>{
        const x=a.x-t.x,z=a.z-t.z,r=.41*t.scale+margin,along=x*dx+z*dz;
        const disc=along*along-ds*(x*x+z*z-r*r);if(disc<=0)return;
        const f=Math.max(0,(-along-Math.sqrt(disc))/ds),exit=(-along+Math.sqrt(disc))/ds;
        if(exit<0||f>=nearest)return;
        const h=a.y+(b.y-a.y)*f;if(h>=t.y-margin&&h<t.y+2.85*t.heightScale+margin)nearest=f;
      });return nearest;
    }
    globalThis.RideOrchard.diagnostics=()=>({...info});
    update(0,0,0,null);return {ready:Promise.all(loading).then(result=>result.every(Boolean)),update,blocked,cameraFraction};
  }
  globalThis.RideOrchard={build,coverage,surfaceAt,shadeAt:()=>0,trail:T=>survey(T).trail,shadowUniforms,shadowGLSL};
})();
