/* Rideable river aqueduct and its shadow over the banks. */
(() => {
  'use strict';
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));

  function stoneworks(T,group,world,ground) {
    const p=[],rgb=[],uv=[],indices=[],boxes=[];
    const colors=new Map();
    function ink(s){if(!colors.has(s))colors.set(s,new T.Color(s));return colors.get(s);}
    function tint(a,b,t){return ink(a).clone().lerp(ink(b),clamp(t));}
    function quad(a,b,c,d,base,second=base) {
      const s=p.length/3,one=typeof base==='object'?base:ink(base),two=typeof second==='object'?second:ink(second);
      const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
      const nx=Math.abs(u[1]*v[2]-u[2]*v[1]),ny=Math.abs(u[2]*v[0]-u[0]*v[2]),nz=Math.abs(u[0]*v[1]-u[1]*v[0]);
      for(const [pt,k] of [[a,one],[b,two],[c,two],[d,one]]){
        p.push(...pt);rgb.push(k.r,k.g,k.b);
        if(ny>Math.max(nx,nz))uv.push(pt[0]/12,pt[2]/9);
        else uv.push((nx>nz?pt[2]:pt[0])/12,pt[1]/9);
      }
      indices.push(s,s+1,s+2,s,s+2,s+3);
    }
    const ivory=0xffedcc,pale=0xf0e4d0,lavender=0xb5c4e0,shadow=0x829ac7,inside=0x738fb9;
    function lining(a,b,c,d,color){quad(a,b,c,d,color);}
    // Coordinates in each bay are aligned with the axis of the canal.
    function axis(x0,z0,x1,z1){
      const len=Math.hypot(x1-x0,z1-z0),dx=(x1-x0)/len,dz=(z1-z0)/len;
      return {length:len,at:(s,h,w)=>[x0+s*dx-w*dz,h,z0+s*dz+w*dx]};
    }
    function beam(ax,l,r,lo,hi,d,front=ivory,back=lavender,under=inside) {
      const a=ax.at;
      quad(a(l,lo,d),a(r,lo,d),a(r,hi,d),a(l,hi,d),front);
      quad(a(r,lo,-d),a(l,lo,-d),a(l,hi,-d),a(r,hi,-d),back);
      quad(a(l,hi,-d),a(r,hi,-d),a(r,hi,d),a(l,hi,d),ivory);
      quad(a(l,lo,d),a(r,lo,d),a(r,lo,-d),a(l,lo,-d),under);
      quad(a(l,lo,-d),a(l,lo,d),a(l,hi,d),a(l,hi,-d),shadow);
      quad(a(r,lo,d),a(r,lo,-d),a(r,hi,-d),a(r,hi,d),pale);
    }
    function pier(ax,s,y0,y1,r0,r1,d0,d1,front,back) {
      const a=ax.at;
      for(const sign of [-1,1])quad(a(s-r0,y0,sign*d0),a(s+r0,y0,sign*d0),
        a(s+r1,y1,sign*d1),a(s-r1,y1,sign*d1),sign===1?front:back);
      quad(a(s-r0,y0,-d0),a(s-r0,y0,d0),a(s-r1,y1,d1),a(s-r1,y1,-d1),shadow);
      quad(a(s+r0,y0,d0),a(s+r0,y0,-d0),a(s+r1,y1,-d1),a(s+r1,y1,d1),pale);
    }
    function arch(ax,center,half,spring,rise,roof,depth,rim,steps,major) {
      const a=ax.at;
      function fringe(t,rel,side,f){
        const angle=Math.PI*t, x=center+(half+rel)*Math.cos(angle);
        return a(x,spring+(rise+rel*.84)*Math.sin(angle),side*(depth+f));
      }
      for(let i=0;i<steps;i++){
        const u=i/steps,v=(i+1)/steps;
        const shadowDepth=tint(0x8aa9d5,0x657fae,Math.sin((u+v)*.5*Math.PI));
        quad(fringe(u,0,1,0),fringe(v,0,1,0),fringe(v,0,-1,0),fringe(u,0,-1,0),shadowDepth);
        for(const side of [-1,1]){
          const lit=side===1;
          const edge=fringe(u,rim,side,0),edge2=fringe(v,rim,side,0);
          const squash=major?.30:.13,belly=major?.64:.24;
          quad(edge,edge2,[edge2[0],roof,edge2[2]],[edge[0],roof,edge[2]],lit?0xf2e3c9:0xb9c8e6);
          const warm=(i%3)*.085;
          const stone=lit?tint(0xffefcf,0xe5cfac,warm):tint(0xdfdded,0xb4c5e2,warm);
          lining(fringe(u,0,side,0),fringe(v,0,side,0),fringe(v,rim*.24,side,squash),fringe(u,rim*.24,side,squash),lit?pale:shadow);
          lining(fringe(u,rim*.24,side,squash),fringe(v,rim*.24,side,squash),fringe(v,rim*.77,side,squash),fringe(u,rim*.77,side,squash),stone);
          lining(fringe(u,rim*.77,side,squash),fringe(v,rim*.77,side,squash),fringe(v,rim,side,belly),fringe(u,rim,side,belly),lit?ivory:lavender);
          lining(fringe(u,rim,side,belly),fringe(v,rim,side,belly),edge2,edge,lit?0xadabc2:inside);
        }
      }
    }
    function barrier(cx,cz,rx,rz,base,top){boxes.push({cx,cz,rx,rz,base,top});}
    function buildAqueduct(){
      const riverWalk=globalThis.RideWhiteBridge.aqueduct;
      const {cx,pierStations:limits,crown}=riverWalk,curve=x=>riverWalk.center(x-cx);
      const head=crown+11.1;
      for(let i=0;i<limits.length-1;i++){
        const x=cx+limits[i],next=cx+limits[i+1],z=curve(x),ax=axis(x,z,next,curve(next)),L=ax.length;
        const major=L>80,r=major?3.9:3.0,d=major?4.9:4.1;
        const roof=crown-.9,rise=major?27.8:20.7,spring=roof-rise-4.5;
        const half=L/2-r;
        arch(ax,L*.5,half,spring,rise,roof,d,major?2.65:1.8,major?38:25,true);
        // Short masonry strips close the spandrel at the line of adjacent
        // piers; the broad central, east-bank and west-bank arches stay open.
        for(const side of [0,1]){
          const s=side*L,w=side?-.5*r:.5*r;
          beam(ax,Math.min(s,s+w),Math.max(s,s+w),spring,roof,d,ivory,lavender);
        }
        beam(ax,0,L,roof-.55,roof+.65,d+.68,ivory,0xd6d8e9,shadow);
        beam(ax,0,L,roof+.65,roof+1.22,d+.78,0xfff0cc,0xd6d9e9);
        const n=major?7:5,span=L/n,base=roof+1.18,cap=head-.85;
        for(let k=0;k<n;k++){
          const s=(k+.5)*span,hh=span*.5-.86,top=base+3.1;
          arch(ax,s,hh,top,cap-top-1.1,cap,d*.62,.58,14,false);
          pier(ax,k*span,base,top+.10,.89,.83,d*.64,d*.62,0xf1e4cd,0xb9c8e3);
        }
        const terminal=i===limits.length-2;
        beam(ax,0,terminal?L+3.8:L,cap,head+.28,d*.69,ivory,0xdadddf);
        beam(ax,0,terminal?L+5.7:L,head+.28,head+.82,d*.71,0xf7e4bf,0xc8d1e5);
        if(terminal){
          pier(ax,L,base,cap,1.6,2.1,d*.66,d*.7,pale,lavender);
          beam(ax,L-1.7,L+2.7,cap-.95,cap,d*.70,ivory,0xcbd2e2);
        }
        for(const s of [0,...(i===limits.length-2?[L]:[])]){
          const c=ax.at(s,0,0),y=ground(c[0],c[2])-1.7;
          const footW=r*1.56,footD=d*1.41,shoulder=spring+1.4;
          if(shoulder>y){
            const plinth=Math.min(y+3.3,shoulder-.35);
            pier(ax,s,y,plinth,footW,footW*.95,footD,footD*.95,pale,lavender);
            pier(ax,s,plinth,shoulder,footW*.95,r,r*1.70,d,pale,0xc2cce3);
            beam(ax,s-r-.48,s+r+.48,shoulder-.5,shoulder+.38,d+.54,ivory,0xd2d6e8);
          }
          pier(ax,s,Math.min(shoulder,roof-.1),roof,r,r,d,d,pale,lavender);
          barrier(c[0],c[2],footW+1,footD+1,y,roof);
        }
        // A rider may pass directly under the span. The camera will still
        // meet its barrel if it rises toward a low part of the arch.
        for(let k=0;k<12;k++){
          const s=(k+.5)*L/12,pt=ax.at(s,0,0);
          const h=spring+rise*Math.sqrt(Math.max(0,1-((s-L*.5)/half)**2));
          barrier(pt[0],pt[2],L/24+.2,d+.72,h,head+.82);
        }
      }
    }
    function buildHillsideWall(){
      // Solid, monolithic dressed-limestone curtain wall deeply anchored 14m below the hillside on BOTH sides
      // (zero bridge-arch clutter, zero stair-steps, zero gaps or holes!), matching the White River Aqueduct stone material.
      const ew=globalThis.RideWhiteBridge.eastWall;
      const wallX=ew.centerX,topHalf=ew.width+.14,baseHalf=ew.width+1.45;
      function roundTower(cx,cz,baseY,topY,rad){
        const sides=18,tau=Math.PI*2;
        const corbelY=topY-1.7,parapetY=topY+1.5,corbelR=rad+.52;
        for(let i=0;i<sides;i++){
          const a0=tau*i/sides,a1=tau*(i+1)/sides,am=.5*(a0+a1);
          const sunLit=Math.cos(am+.6)>.05;
          const col=sunLit?ivory:lavender;
          const colHi=sunLit?0xfff3d8:pale;
          const c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
          quad([cx+rad*c0,baseY,cz+rad*s0],[cx+rad*c1,baseY,cz+rad*s1],
               [cx+rad*c1,corbelY,cz+rad*s1],[cx+rad*c0,corbelY,cz+rad*s0],col);
          quad([cx+rad*c0,corbelY,cz+rad*s0],[cx+rad*c1,corbelY,cz+rad*s1],
               [cx+corbelR*c1,topY,cz+corbelR*s1],[cx+corbelR*c0,topY,cz+corbelR*s0],sunLit?pale:shadow);
          quad([cx+corbelR*c0,topY,cz+corbelR*s0],[cx+corbelR*c1,topY,cz+corbelR*s1],
               [cx+corbelR*c1,parapetY,cz+corbelR*s1],[cx+corbelR*c0,parapetY,cz+corbelR*s0],colHi);
          quad([cx,topY+.2,cz],[cx+corbelR*c0,topY+.2,cz+corbelR*s0],
               [cx+corbelR*c1,topY+.2,cz+corbelR*s1],[cx,topY+.2,cz],pale);
          if(i%2===0){
            const mh=1.22;
            quad([cx+corbelR*c0,parapetY,cz+corbelR*s0],[cx+corbelR*c1,parapetY,cz+corbelR*s1],
                 [cx+corbelR*c1,parapetY+mh,cz+corbelR*s1],[cx+corbelR*c0,parapetY+mh,cz+corbelR*s0],colHi);
          }
        }
        barrier(cx,cz,rad+.5,rad+.5,baseY,parapetY+1.4);
      }

      // Sleek twin gatehouse bastions framing the open East Gate Plaza (z = 82..118)
      for(const gz of [78,122]){
        const gx=wallX(gz),gy=ground(gx,gz);
        const topH=Math.max(ew.deckY(gz,0),gy+ew.rise*.6)+4.2;
        roundTower(gx-topHalf-3.1,gz,gy-14,topH,3.6);
        roundTower(gx+topHalf+3.1,gz,gy-14,topH,3.6);
      }

      // Smooth continuous solid battered stone wall sections supporting the rideable paved top
      const sections=[[ew.first,82],[118,ew.end]];
      const segLen=10;
      let distSinceTower=0;
      for(const [zA,zB] of sections){
        const steps=Math.max(1,Math.ceil((zB-zA)/segLen));
        for(let i=0;i<steps;i++){
          const z0=zA+(zB-zA)*i/steps,z1=zA+(zB-zA)*(i+1)/steps;
          const x0=wallX(z0),x1=wallX(z1);
          const f0=ew.factor(z0),f1=ew.factor(z1);
          // Slight outward batter (wider at base, sleeker at top) deeply buried 14m below ground!
          const yTop0L=ew.deckY(z0,-ew.width)-.25,yTop0R=ew.deckY(z0,ew.width)-.25;
          const yTop1L=ew.deckY(z1,-ew.width)-.25,yTop1R=ew.deckY(z1,ew.width)-.25;
          const yBase0=Math.min(ground(x0-baseHalf,z0),ground(x0+baseHalf,z0))-14;
          const yBase1=Math.min(ground(x1-baseHalf,z1),ground(x1+baseHalf,z1))-14;

          // West (meadow-facing sunlit) solid battered limestone wall face
          quad([x0-baseHalf,yBase0,z0],[x1-baseHalf,yBase1,z1],
               [x1-topHalf,yTop1L,z1],[x0-topHalf,yTop0L,z0],ivory,pale);
          // East (snowfield-facing cool shaded) solid battered limestone wall face
          quad([x1+baseHalf,yBase1,z1],[x0+baseHalf,yBase0,z0],
               [x0+topHalf,yTop0R,z0],[x1+topHalf,yTop1R,z1],lavender,shadow);

          // Continuous molded cornice string-course running cleanly just beneath the battlements
          if(f0>.15||f1>.15){
            const cOut=topHalf+.38,cDrop=.95;
            quad([x0-cOut,yTop0L-cDrop,z0],[x1-cOut,yTop1L-cDrop,z1],
                 [x1-cOut,yTop1L+.08,z1],[x0-cOut,yTop0L+.08,z0],0xfff3d6);
            quad([x1+cOut,yTop1R-cDrop,z1],[x0+cOut,yTop0R-cDrop,z0],
                 [x0+cOut,yTop0R+.08,z0],[x1+cOut,yTop1R+.08,z1],pale);
          }

          // Solid side collision ONLY below the deck surface (so riders glide freely on top & ramps!)
          const topLow=Math.min(yTop0L,yTop1L,yTop0R,yTop1R);
          const groundHere=Math.min(ground(x0,z0),ground(x1,z1));
          if(topLow>groundHere+.42){
            barrier((x0+x1)*.5,(z0+z1)*.5,topHalf+.35,Math.abs(z1-z0)*.5+.4,yBase0,topLow-.35);
          }

          distSinceTower+=Math.hypot(x1-x0,z1-z0);
          if(distSinceTower>=165 && f1>.85){
            distSinceTower=0;
            // Clean outer bastion drum flush with the eastern wall flank (never blocks the rideable top!)
            const tx=x1+topHalf+2.4,ty=ground(tx,z1);
            roundTower(tx,z1,ty-14,ew.deckY(z1,0)+3.8,3.6);
          }
        }
      }
    }
    buildAqueduct();
    buildHillsideWall();
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
    const image=new T.TextureLoader().load(globalThis.RideAshlar);
    image.colorSpace=T.SRGBColorSpace;image.wrapS=image.wrapT=T.RepeatWrapping;image.anisotropy=4;
    const material=new T.MeshBasicMaterial({map:image,vertexColors:true,side:T.DoubleSide,fog:true});
    RideStoneFinish.limestone(material);
    if(globalThis.RideWeather?.shadeMaterial)RideWeather.shadeMaterial(T,material);
    const mesh=new T.Mesh(geometry,material);mesh.name='Two tiers of the white river aqueduct';group.add(mesh);
    return boxes;
  }

  function buildAqueductShade(T,group,world,ground) {
    const river=world.river(-205),bridge=globalThis.RideWhiteBridge.aqueduct;
    const {cx,pierStations:edges,crown}=bridge,curve=x=>bridge.center(x-cx);
    const roof=crown-.9,head=crown+11.92;
    // For each source-plane point, walk toward the shadow opposite the sun.
    // Sampling the receiver at that displaced X/Z bends the silhouette over
    // the actual banks, with a level section across the river surface.
    const p=[],data=[],rays=[],idx=[];
    const sunX=.25,sunZ=.82,dropMin=-15;
    for(let i=1;i<edges.length;i++){
      const x0=cx+edges[i-1],x1=cx+edges[i],z0=curve(x0),z1=curve(x1);
      const L=Math.hypot(x1-x0,z1-z0),major=L>80,r=major?3.9:3.0;
      const rise=major?27.8:20.7,d=major?4.9:4.1;
      const cols=Math.ceil(L/3.0),rows=24,start=p.length/3;
      const floorMin=Math.min(ground(x0,z0),ground(x1,z1),river.y);
      const dropMax=Math.max(21,head-floorMin+22);
      for(let a=0;a<=cols;a++){
        const u=a/cols,sourceX=x0+(x1-x0)*u,sourceZ=z0+(z1-z0)*u;
        for(let b=0;b<=rows;b++){
          const drop=dropMin+(dropMax-dropMin)*b/rows;
          const x=sourceX-sunX*drop,z=sourceZ-sunZ*drop,rvr=world.river(z);
          const bed=ground(x,z);
          const water=Math.abs(x-rvr.x)<=rvr.halfWidth;
          const h=water?Math.max(bed,rvr.y):bed;
          p.push(x,h+(water?.070:.094),z);
          data.push(u*L,L,r,d);
          rays.push(h+drop,drop,rise);
          if(a<cols&&b<rows){
            const v=start+a*(rows+1)+b,k=v+rows+1;
            idx.push(v,k,v+1,v+1,k,k+1);
          }
        }
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
    geometry.setAttribute('bay',new T.Float32BufferAttribute(data,4));
    geometry.setAttribute('lightRay',new T.Float32BufferAttribute(rays,3));
    geometry.setIndex(idx);geometry.computeBoundingSphere();
    const material=new T.ShaderMaterial({
      uniforms:{roofY:{value:roof},topY:{value:head}},transparent:true,depthWrite:false,
      side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
      // Preserve the postprocessor's alpha mask (only the cyclist writes that mask).
      blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
      blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
      vertexShader:`attribute vec4 bay;attribute vec3 lightRay;varying vec4 b;varying vec3 ray;
        void main(){b=bay;ray=lightRay;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float roofY,topY;varying vec4 b;varying vec3 ray;
        void main(){
          float s=b.x,L=b.y,r=b.z,d=b.w,hit=ray.x,travel=ray.y,rise=ray.z;
          float halfOpening=L*.5-r;
          float side=clamp(abs(s-L*.5)/halfOpening,0.,1.);
          float intrados=roofY-4.5-rise+rise*sqrt(max(0.,1.-side*side));
          float nearPier=min(s,L-s),soft=.42+.035*max(0.,travel);
          float upper=1.-smoothstep(topY+d*.78-soft,topY+d*.78+soft,hit);
          float span=smoothstep(intrados-d*.76-soft,intrados-d*.76+soft,hit);
          float pier=1.-smoothstep(r-.18-soft*.35,r+.12+soft*.42,nearPier);
          float closeRange=1.-smoothstep(0.,26.,max(0.,travel));
          float below=1.-smoothstep(roofY-2.2,roofY+2.2,hit);
          pier=max(pier,(1.-smoothstep(r*1.39-.43,r*1.39+.78,nearPier))*closeRange*below);
          float behind=smoothstep(-d*1.52-.80,-d*1.52+.65,travel);
          float shade=max(.16*span,.20*pier)*upper*behind;
          vec2 contact=vec2(nearPier/max(.1,r*2.22),travel/max(.1,d*2.0));
          float foot=(1.-smoothstep(.50,1.29,length(contact)))*.22;
          float a=max(shade,foot);
          if(a<.008)discard;
          gl_FragColor=vec4(.075,.125,.245,a);
          #include <colorspace_fragment>
        }`
    });
    const mesh=new T.Mesh(geometry,material);
    mesh.name='Aqueduct arches cast on the valley floor';mesh.renderOrder=2;group.add(mesh);
    return mesh;
  }
  function buildWallShade(T,group,ground){
    const ew=globalThis.RideWhiteBridge.eastWall;
    const wallX=ew.centerX;
    const p=[],a=[],idx=[],steps=160,zStart=ew.end,zEnd=ew.first;
    for(let i=0;i<=steps;i++){
      const z=zStart+(zEnd-zStart)*i/steps;
      const taper=ew.factor(z);
      const wx=wallX(z)-ew.width;
      for(let j=0;j<=3;j++){
        const off=[0,-5.5,-14.0,-24.0][j];
        const x=wx+off,y=ground(x,z)+.11;
        p.push(x,y,z);
        a.push((j===0?.44:j===1?.33:j===2?.14:0)*taper);
      }
      if(i<steps){
        for(let j=0;j<3;j++){
          const v=i*4+j,n=v+4;
          idx.push(v,n,v+1,v+1,n,n+1);
        }
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));
    g.setAttribute('aShade',new T.Float32BufferAttribute(a,1));
    g.setIndex(idx);g.computeBoundingSphere();
    const mat=new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
      blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
      blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
      vertexShader:`attribute float aShade;varying float vA;void main(){vA=aShade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying float vA;void main(){if(vA<.005)discard;gl_FragColor=vec4(.055,.115,.16,vA);
#include <colorspace_fragment>
}`
    });
    const m=new T.Mesh(g,mat);m.name='Hillside castle wall cast shadow';m.renderOrder=2;group.add(m);
  }
  function build(T,scene,world,terrain) {
    const group=new T.Group();group.name='River country and the Windward Heights';scene.add(group);
    const stone=stoneworks(T,group,world,terrain.height);
    const walks=globalThis.RideWhiteBridge.build(T,group);
    buildAqueductShade(T,group,world,terrain.height);
    buildWallShade(T,group,terrain.height);
    function blocked(x,z,r=.6,y) {
      const h=y??(terrain.height(x,z)+1);
      if(walks.blocked(x,z,r,h))return true;
      return stone.some(b=>Math.abs(x-b.cx)<b.rx+r&&Math.abs(z-b.cz)<b.rz+r&&h>=b.base-r&&h<=b.top+r);
    }
    function cameraFraction(from,to,margin=.28) {
      const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
      let limit=walks.cameraFraction(from,to,margin);
      for(const b of stone){
        let lo=0,hi=limit;
        const slab=(origin,dir,min,max)=>{
          if(Math.abs(dir)<1e-7)return origin>=min&&origin<=max;
          const a=(min-origin)/dir,c=(max-origin)/dir;
          lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));
          return lo<=hi;
        };
        if(slab(from.x,dx,b.cx-b.rx-margin,b.cx+b.rx+margin)&&
           slab(from.z,dz,b.cz-b.rz-margin,b.cz+b.rz+margin)&&
           slab(from.y,dy,b.base-margin,b.top+margin))limit=lo;
      }
      return limit;
    }
    return {group,blocked,cameraFraction};
  }
  globalThis.RideVistas={build};
})();
