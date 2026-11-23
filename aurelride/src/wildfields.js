/* Seeded banks of timothy, wild lavender and canola. A plant keeps the same roots
   through every level of detail; only its representation changes with distance. */
((root)=>{
  'use strict';
  const tau=Math.PI*2;
  const bounds=[-1056,-100,286,1032],maskSize=[704,608],tile=12;
  function smooth(a,b,v){const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);}
  function bed(x,z,cx,cz,rx,rz,angle,wobble){
    const dx=x-cx,dz=z-cz,c=Math.cos(angle),s=Math.sin(angle);
    const u=(dx*c-dz*s)/rx,v=(dx*s+dz*c)/rz;
    const d=u*u+v*v;
    return 1-smooth(.31+wobble,1.05+wobble,d);
  }
  const empty=Object.freeze({grass:0,lavender:0,canola:0});
  function sample(x,z){
    if(x<bounds[0]||x>bounds[2]||z<bounds[1]||z>bounds[3])return empty;
    const warp=.13*Math.sin(x*.056+z*.024)+.085*Math.sin(x*.044-z*.065);
    let grass=0,lavender=0,canola=0;
    if(x< -670){
      grass=Math.max(bed(x,z,-783,249,72,103,-.54,warp),bed(x,z,-755,329,83,58,.18,warp)*.82,
        bed(x,z,-933,28,49,90,-.28,warp)*.86,bed(x,z,-818,311,42,62,.55,warp)*.74);
      lavender=Math.max(bed(x,z,-843,145,59,65,-.48,warp),bed(x,z,-887,48,85,72,-.54,warp),
        bed(x,z,-940,-5,52,42,.37,warp)*.91,bed(x,z,-788,156,33,55,-.71,warp)*.79);
    }else if(z>445&&x> -395){
      // Shallow bands follow the rolling southern hills. A golden lower slope
      // turns into amethyst terraces across the saddle and the eastern return.
      canola=Math.max(bed(x,z,-133,769,129,119,-.41,warp),bed(x,z,-194,647,96,90,.25,warp),
        bed(x,z,-19,848,110,59,-.07,warp),bed(x,z,128,688,83,55,-.45,warp)*.92);
      lavender=Math.max(bed(x,z,-108,569,93,64,-.36,warp),bed(x,z,-7,592,98,57,-.16,warp),
        bed(x,z,65,669,71,76,.62,warp),bed(x,z,43,778,73,50,-.70,warp));
      const furrow=.5+.5*Math.cos(.39*x+.11*z+.00031*(z-660)*(z-660)+1.7*Math.sin(x*.024));
      canola*=.71+.29*smooth(.22,.62,furrow);
      lavender*=1-.85*canola;
    }else if(x> -530&&z>160){
      lavender=Math.max(bed(x,z,-405,372,51,55,-.31,warp),bed(x,z,-454,303,36,49,-.5,warp)*.86);
      grass=Math.max(bed(x,z,-286,307,42,70,.45,warp)*.84,bed(x,z,-234,202,31,43,.35,warp)*.70);
      // Timothy and lavender survive in the sunny clearings at the forest
      // edge. Their dense meadow stands stop underneath the closed crowns.
      const clearing=1-smooth(.03,.57,root.RideOrchard.coverage(x,z));
      lavender*=clearing;grass*=clearing;
    }
    if(Math.max(grass,lavender,canola)<=0)return empty;
    const ribbons=.64+.18*Math.sin(x*.23-z*.113+.96*Math.sin(z*.048)+.63*Math.sin(x*.093))
      +.13*Math.sin(z*.127+x*.034)+.07*Math.sin(x*.47-z*.21);
    lavender*=.012+.988*smooth(.45,.70,ribbons);
    grass*=1-.77*lavender;
    const surface=root.RideTrails.surfaceAt(x,z);
    const verge=(1-surface.weight)*(root.RideWorld.waterDepth(x,z)>.008||root.RideTrails.isDeck(x,z)?0:1);
    return {grass:grass*verge,lavender:lavender*verge,canola:canola*verge};
  }
  const cached=new WeakMap();
  function uniforms(T){
    if(cached.has(T))return cached.get(T);
    const [w,h]=maskSize,map=new Uint8Array(w*h*4);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const x=bounds[0]+(i+.5)*(bounds[2]-bounds[0])/w,z=bounds[1]+(j+.5)*(bounds[3]-bounds[1])/h;
      const f=sample(x,z),k=(j*w+i)*4;map[k]=Math.round(255*f.grass);map[k+1]=Math.round(255*f.lavender);map[k+2]=Math.round(255*f.canola);
    }
    const texture=new T.DataTexture(map,w,h,T.RGBAFormat);
    texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
    const u={uWildCover:{value:texture}};cached.set(T,u);return u;
  }
  const glsl=`
    uniform sampler2D uWildCover;
    vec3 fieldCover(vec2 p){
      vec2 uv=(p-vec2(-1056.,-100.))/vec2(1342.,1132.);
      if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec3(0.);
      return texture2D(uWildCover,uv).rgb;
    }
    vec2 wildCover(vec2 p){vec3 s=fieldCover(p);return vec2(s.r,max(s.g,s.b));}`;
  function generator(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
  // Close grasses have a bent, three-sided stem and individual radial spikelets.
  // The lavender inflorescences form separated, toothed calyx whorls on each stem.
  function specimen(T,species){
    const isLavender=species===1,rapeseed=species===2;
    const rand=generator(rapeseed?57923:isLavender?38631:8357),p=[],rgb=[],index=[];
    const tip=(x,y,z,c)=>{p.push(x,y,z);rgb.push(...c);return p.length/3-1;};
    function strip(a,b,c,d){index.push(a,b,c,c,b,d);}
    function tube(axis,t0,t1,r0,r1,n,color,phase=0){
      const a=axis(t0),b=axis(t1);let prev;
      for(let i=0;i<=n;i++){
        const phi=phase+tau*(i%n)/n,dx=Math.cos(phi),dz=Math.sin(phi);
        const light=.85+.15*dx-.05*dz;
        const shade=color.map(c=>c*light);
        const pair=[tip(a[0]+dx*r0,a[1],a[2]+dz*r0,shade),tip(b[0]+dx*r1,b[1],b[2]+dz*r1,shade)];
        if(i)strip(prev[0],prev[1],pair[0],pair[1]);
        prev=pair;
      }
    }
    function leaf(a,angle,length,width,dx,height,ink){
      const ca=Math.cos(angle),sa=Math.sin(angle),side=[-sa,ca],row=[];
      for(const t of [0,.46,.78,1]){
        const w=width*(t===0?.16:Math.pow(Math.sin(t*Math.PI),.60));
        const xx=a[0]+ca*(dx*t+.22*length*t*t),zz=a[2]+sa*(dx*t+.22*length*t*t);
        const yy=a[1]+height*t-length*.23*t*t;
        const L=tip(xx+side[0]*w,yy,zz+side[1]*w,ink);
        const M=tip(xx,yy+w*.52,zz,ink.map(c=>Math.min(1,c*1.14)));
        const R=tip(xx-side[0]*w,yy,zz-side[1]*w,ink.map(c=>c*.84));
        if(row.length){const [l,m,r]=row.at(-1);strip(l,m,L,M);strip(m,r,M,R);}
        row.push([L,M,R]);
      }
    }
    if(rapeseed){
      const olive=[.35,.55,.28],sage=[.38,.59,.45],bud=[.69,.72,.25];
      function flower(x,y,z,r,bearing,tilt){
        const co=Math.cos(bearing),si=Math.sin(bearing),up=Math.cos(tilt),out=Math.sin(tilt);
        const pt=(u,v,h,ink)=>tip(x+co*u-si*(v*up-h*out),y+h*up+v*out,z+si*u+co*(v*up-h*out),ink);
        const middle=pt(0,0,.002,[.88,.58,.10]),phase=rand()*tau;
        for(let k=0;k<4;k++){
          const a=phase+k*tau/4,c=Math.cos(a),s=Math.sin(a);
          const petal=(d,w,h,ink)=>pt(r*(c*d-s*w),r*(s*d+c*w),h*r,ink);
          const one=petal(.61,-.31,.14,[.94,.69,.08]),two=petal(.62,.33,.16,[1,.84,.16]);
          const lip=petal(1.,-.12,.23,[1,.90,.31]),rim=petal(.96,.21,.25,[1,.91,.35]);
          index.push(middle,one,two,one,lip,two,lip,rim,two);
        }
      }
      const main=t=>[.036*t+.033*t*t,t*.99,-.048*t*t];
      for(let k=0;k<3;k++)tube(main,k/3,(k+1)/3,.010-k*.002,.008-k*.002,4,olive);
      for(let k=0;k<6;k++){
        const a=2.42*k+.52,base=.12+.09*k,size=1-.081*k;
        leaf(main(base),a,.24*size,.043*size,.22*size,.08+.044*k,sage);
      }
      for(let j=0;j<7;j++){
        const k=j/7,ang=2.4*j+.19,dx=Math.cos(ang),dz=Math.sin(ang),ht=.25-.055*k;
        const foot=main(.38+.081*j),spread=(.25-.19*k)*(1+.20*rand());
        const arm=t=>[foot[0]+dx*spread*t*(1.33-.33*t),foot[1]+ht*t+.042*t*t,foot[2]+dz*spread*t*(1.33-.33*t)];
        tube(arm,0,.67,.0049,.0038,3,olive);tube(arm,.67,1,.0038,.0024,3,olive);
        for(let n=0;n<6;n++){
          const s=.56+.079*n,base=arm(s),aa=ang+n*2.39,reach=.046-.0040*n;
          const xv=Math.cos(aa)*reach,zv=Math.sin(aa)*reach;
          const stem=t=>[base[0]+xv*t,base[1]+.038*t,base[2]+zv*t];
          if(n<5){
            tube(stem,0,1,.0024,.0014,3,olive);
            flower(...stem(1),.025+rand()*.007,aa, .32+rand()*.71);
          }else tube(stem,.55,1,.006,.0023,4,bud);
        }
      }
    }
    const stalks=rapeseed?0:isLavender?6:5;
    for(let i=0;i<stalks;i++){
      const a=tau*(i/stalks+.114*rand()),ca=Math.cos(a),sa=Math.sin(a),base=.018+.05*rand();
      const h=(isLavender?.49:.90)+(isLavender?.28:.28)*rand(),reach=(isLavender?.12:.08)+rand()*(isLavender?.17:.15);
      const axis=t=>[ca*(base+reach*t*t)+.035*t, h*t,sa*(base+reach*t*t)];
      const green=isLavender?[.40,.56,.42]:[.51,.65,.25];
      tube(axis,0,.55,.0078,.0058,3,green);tube(axis,.55,.83,.0058,.0039,3,green);
      if(isLavender){
        const offset=.735+.045*rand(),n=5;
        for(let q=0;q<n;q++){
          const t=offset+q*.042,w=.0215*(1-.11*q),pt=axis(t);
          const dark=[.31,.18,.45],lilac=[.65+.12*rand(),.40+.12*rand(),.88];
          tube(axis,t,t+.027,w*.64,w,5,dark,q*.72);
          for(let j=0;j<5;j++){
            const angle=tau*j/5+q*.59,dx=Math.cos(angle),dz=Math.sin(angle);
            const k=tip(pt[0]+w*dx-.009*dz,pt[1]+.010,pt[2]+w*dz+.009*dx,lilac);
            const l=tip(pt[0]+w*dx+.009*dz,pt[1]+.010,pt[2]+w*dz-.009*dx,dark);
            const m=tip(pt[0]+w*1.48*dx,pt[1]+.032-.003*q,pt[2]+w*1.48*dz,[.77,.60,.96]);
            index.push(k,l,m);
          }
        }
        for(let j=0;j<4;j++)leaf(axis(.10+j*.09),a+j*2.72,.19,.011,.07+.05*rand(),.105+.025*rand(),[.39,.55,.43]);
      }else{
        const ear=.79+.025*rand();tube(axis,ear,1,.0125,.008,5,[.75,.70,.38],a);
        for(let j=0;j<14;j++){
          const t=.805+j*.0135,b=axis(t),o=a+j*2.40,dx=Math.cos(o),dz=Math.sin(o);
          const k=tip(b[0]-.012*dz,b[1],b[2]+.012*dx,[.53,.55,.27]);
          const l=tip(b[0]+.012*dz,b[1],b[2]-.012*dx,[.81,.76,.40]);
          const m=tip(b[0]+.024*dx,b[1]+.022,b[2]+.024*dz,[.87,.80,.48]);
          const n=tip(b[0]+.030*dx,b[1]+.048,b[2]+.030*dz,[.91,.84,.57]);index.push(k,l,m,k,m,n);
        }
        leaf(axis(.08),a+.12,.72,.022,.16,.65,[.46,.62,.22]);leaf(axis(.29),a+2.4,.47,.014,.13,.39,[.57,.69,.31]);
      }
    }
    const geometry=new T.InstancedBufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
    geometry.setIndex(index);return geometry;
  }
  function cards(T,far){
    const p=[],uv=[],index=[];
    const layers=far?1:2,rows=far?2:3;
    // The two offset sheets separate in parallax when riding through a clump.
    // Distant heads share one simpler sheet that faces partway toward the eye.
    for(let k=0;k<layers;k++){
      const angle=k*1.28,ca=Math.cos(angle),sa=Math.sin(angle);
      for(let i=0;i<=rows;i++)for(let j=0;j<=1;j++){
        const t=i/rows,width=(j-.5)*(.58+.42*Math.sin(.42+t*1.58));
        p.push(ca*width+(k-.5)*.13,t,sa*width+(k-.5)*.16);uv.push(j,t);
        if(i<rows&&j===0){const a=k*(rows+1)*2+i*2;index.push(a,a+1,a+2,a+2,a+1,a+3);}
      }
    }
    const g=new T.InstancedBufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);return g;
  }
  // The distant cards show the same branching racemes as the close mesh.
  // Painting two silhouettes onto a transparent sheet avoids allocating
  // individual petals for the tens of thousands of stems on the far slope.
  function canolaAtlas(T){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const pen=canvas.getContext('2d');
    const rnd=generator(636339);
    function line(a,b,ink,width){
      pen.strokeStyle=ink;pen.lineWidth=width;pen.beginPath();pen.moveTo(a[0],a[1]);pen.lineTo(b[0],b[1]);pen.stroke();
    }
    function leaf(x,y,dx,dy,breadth){
      const d=Math.hypot(dx,dy),nx=-dy/d*breadth,ny=dx/d*breadth;
      pen.fillStyle=['#527f46','#729153','#648b60','#739863'][Math.floor(4*rnd())];
      pen.beginPath();pen.moveTo(x,y);
      for(let i=1;i<=8;i++){
        const t=i/8,w=Math.sin(Math.PI*t)*(i%2?.72:1);
        pen.lineTo(x+dx*t+nx*w,y+dy*t+ny*w);
      }
      for(let i=7;i>0;i--){const t=i/8,w=Math.sin(Math.PI*t)*(i%2?.64:.93);pen.lineTo(x+dx*t-nx*w,y+dy*t-ny*w);}
      pen.closePath();pen.fill();line([x,y],[x+dx*.88,y+dy*.88],'#8fa871',1.15);
    }
    function corolla(x,y,r,angle,tilt){
      const palette=['#f2b817','#ffd323','#ffde31','#fbd22d','#ffe351','#ffeb72'];
      pen.save();pen.translate(x,y);pen.rotate(angle-.75);pen.scale(1,tilt);pen.rotate(angle);
      for(let k=0;k<4;k++){
        pen.rotate(Math.PI/2);pen.fillStyle=palette[Math.floor(rnd()*palette.length)];
        pen.beginPath();pen.moveTo(.02*r,0);pen.bezierCurveTo(.33*r,-.18*r,.77*r,-.55*r,1.00*r,-.23*r);
        pen.bezierCurveTo(1.19*r,.17*r,.90*r,.44*r,.65*r,.32*r);pen.closePath();pen.fill();
      }
      pen.fillStyle='#d2a329';pen.beginPath();pen.arc(0,0,r*.155,0,tau);pen.fill();pen.restore();
    }
    for(let cell=0;cell<2;cell++){
      pen.save();pen.translate(cell*512,0);pen.beginPath();pen.rect(2,3,508,508);pen.clip();
      for(let i=0;i<11;i++){
        const rootX=70+(i+.35*rnd())*35,tipY=32+88*rnd();
        const lean=(rnd()-.5)*91,stalk=t=>[rootX+lean*t*t,509-(509-tipY)*t];
        for(let k=0;k<3;k++)line(stalk(k/3),stalk((k+1)/3),i%2?'#678947':'#79954d',4-k*.7);
        for(let k=0;k<5;k++){
          const s=.12+k*.12,base=stalk(s),flip=(k+i)%2?1:-1;
          leaf(...base,flip*(26+24*rnd())*(1-.55*s),-3-20*rnd(),8.4-4.3*s);
        }
        for(let j=0;j<7;j++){
          const a=stalk(.43+j*.073),b=stalk(.66+j*.051);
          b[0]+=(j%2?1:-1)*(27+24*rnd())*(1-j*.12);
          line(a,b,'#819646',2.2);const h=16+16*rnd(),cx=b[0]+(rnd()-.5)*8;
          line(b,[cx,b[1]-h],'#8b9c46',1.8);
          for(let k=0;k<7;k++){
            const s=k/7,x=cx+(k%2?1:-1)*(7.2-3.8*s)*(.68+.6*rnd()),y=b[1]-s*h;
            line([cx,y+5],[x,y],'#a3aa4c',1.13);corolla(x,y,4.4+rnd()*2.7,rnd()*tau,.57+.43*rnd());
          }
          for(let k=0;k<3;k++){
            pen.fillStyle=k%2?'#dcd24c':'#c0be43';pen.beginPath();pen.ellipse(cx+(rnd()-.5)*7,b[1]-h+2*k,2.8,2.05,-.5,0,tau);pen.fill();
          }
        }
      }
      pen.restore();
    }
    const tex=new T.CanvasTexture(canvas);
    tex.anisotropy=6;tex.premultiplyAlpha=true;return tex;
  }
  function build(T,scene,land,u,sources){
    const tex=new T.TextureLoader(),atlas={value:null},rapeseedAtlas={value:canolaAtlas(T)};let resolveReady;
    const ready=new Promise(resolve=>{resolveReady=resolve;});
    atlas.value=tex.load('art/field-specimens.webp',()=>{resolveReady(true);},undefined,()=>resolveReady(false));
    atlas.value.anisotropy=6;
    const batches=[];
    function add(isCard,species,range,spacing,width,isFar=false){
      const geom=isCard?cards(T,isFar):specimen(T,species);
      const count=Math.ceil((2*range+4*tile)/spacing)**2;
      const positions=new T.InstancedBufferAttribute(new Float32Array(count*4),4);
      const variants=new T.InstancedBufferAttribute(new Float32Array(count*4),4);
      positions.setUsage(T.DynamicDrawUsage);variants.setUsage(T.DynamicDrawUsage);
      geom.setAttribute('iRoot',positions);geom.setAttribute('iVariant',variants);geom.instanceCount=0;
      const material=new T.ShaderMaterial({
        side:T.DoubleSide,depthWrite:true,uniforms:{...u,uAtlas:atlas,uCanolaAtlas:rapeseedAtlas},
        vertexShader:`
          attribute vec4 iRoot,iVariant;
          ${isCard?'varying vec2 vUv;varying float vCanola;':'attribute vec3 color;varying vec3 vColor;'}
          uniform vec2 uRider;uniform float uTime;
          ${sources.pressure}${sources.noise}${sources.paint}
          varying vec4 vLight;varying vec3 vGround;
          void main(){
            vec2 anchor=iRoot.xz;float range=length(anchor-uRider);
            float visibility=${isFar?'smoothstep(32.,56.,range)*(1.-smoothstep(97.,133.,range))':
              isCard?'1.-smoothstep(36.,63.,range)':'1.-smoothstep(7.5,12.5,range)'};
            if(visibility<.02){gl_Position=vec4(2.,2.,2.,1.);return;}
            float ca=cos(iVariant.x),sa=sin(iVariant.x),canola=step(1.5,iVariant.w);
            float lavender=step(.5,iVariant.w)*(1.-canola);
            float clusterHeight=iRoot.w;
            // A low side camera can sit inside the herbs on the uphill side.
            // Taper the small corridor immediately in front of the lens;
            // roots next to the axles still respond to the actual wheels.
            vec2 sight=uRider-cameraPosition.xz;
            float boom=max(.01,length(sight));sight/=boom;
            vec2 fromEye=anchor-cameraPosition.xz;
            float reach=clamp(dot(fromEye,sight),0.,min(2.75,boom*.69));
            float clearance=length(fromEye-sight*reach);
            float low=1.-smoothstep(iRoot.w+.35,iRoot.w+1.26,cameraPosition.y-iRoot.y);
            float margin=mix(1.20,.57,smoothstep(.15,2.75,reach));
            float inView=1.-low*(1.-smoothstep(.12,margin,clearance));
            if(inView<.06){gl_Position=vec4(2.,2.,2.,1.);return;}
            clusterHeight*=mix(.19,1.,inView);
            float t=position.y*clusterHeight;
            vec2 spread=mat2(ca,-sa,sa,ca)*position.xz*
              ${isCard?'mix(.88,1.08,lavender)*'+width.toFixed(3)+'*(.80+.40*iVariant.y)':'iRoot.w'};
            ${isFar?'vec2 right=normalize(vec2(viewMatrix[0][0],viewMatrix[2][0]));spread=mix(spread,right*position.x*3.05*sign(dot(right,vec2(ca,-sa))),.77);':''}
            vec2 p=anchor+spread;
            vec3 track=${isFar?'vec3(0.)':'wheelImprint(p)'};
            vec2 axis=uAxle[0]-uAxle[1];axis/=max(.10,length(axis));
            vec2 side=vec2(-axis.y,axis.x);
            float along=dot(p-uAxle[0],axis),across=dot(p-uAxle[0],side);
            float brush=(1.-smoothstep(.24,.80,abs(across)))*(1.-smoothstep(.0,.58,max(along,-along-1.12)))
              *max(uAxleGround.x,uAxleGround.y)*(1.-smoothstep(1.7,2.5,range));
            vec2 part=side*clamp(across/.23,-1.,1.)+axis*.20;
            float pressed=max(smoothstep(.08,.80,track.z),brush*.67),stem=clamp(position.y,0.,1.2);
            float curve=stem*(.19+.81*stem);
            float front=windfront(anchor,uTime);
            vec2 wind=bendingWind(anchor,uTime,stem,iVariant.y,front)*(.28-.13*lavender+.078*canola);
            p+=clusterHeight*curve*(wind*(1.-.87*pressed)+track.xy*1.28+part*brush*.76*(1.-track.z*.55));
            float y=iRoot.y-.038+t*(1.-pressed*.968);
            float sun=.90+.10*sin(iVariant.z*7.)+.12*front*stem;
            vLight=vec4(sun*(1.-.55*pressed),visibility,rideCloudShade(anchor),treeShade(anchor));
            vGround=vec3(p,max(.0,y-iRoot.y));
            ${isCard?`float column=step(.5,iVariant.z);vec2 cell=vec2(column,1.-lavender);
              vec2 tileUv=vec2(mix(uv.x,1.-uv.x,step(.5,iVariant.y)),uv.y);
              tileUv=mix(vec2(.008),vec2(.992),tileUv);vCanola=canola;
              vUv=canola>.5?vec2((column+tileUv.x)*.5,tileUv.y):(cell+tileUv)*.5;`:'vColor=color*(.90+.13*iVariant.y);'}
            gl_Position=projectionMatrix*viewMatrix*vec4(p.x,y,p.y,1.);
          }`,
        fragmentShader:`uniform vec2 uRider;uniform float uWeatherWet;
          ${isCard?'uniform sampler2D uAtlas,uCanolaAtlas;varying vec2 vUv;varying float vCanola;':'varying vec3 vColor;'}
          varying vec4 vLight;varying vec3 vGround;
          ${sources.display}${sources.cast}
          void main(){
            ${isCard?'vec4 leaf=vCanola>.5?texture2D(uCanolaAtlas,vUv):texture2D(uAtlas,vUv);if(leaf.a*vLight.y<.23)discard;vec3 pigment=vCanola>.5?leaf.rgb/max(.01,leaf.a):leaf.rgb;':
              'if(vLight.y<.22)discard;vec3 pigment=vColor;'}
            pigment*=vLight.x*mix(vec3(1.),vec3(.70,.77,.86),vLight.z)*
              mix(vec3(1.),vec3(.59,.69,.79),vLight.w)*mix(vec3(1.),vec3(.84,.88,.90),uWeatherWet);
            pigment*=grassShadowMultiplier(vGround.xy,vGround.z);
            gl_FragColor=vec4(toLinear(pigment),1.);
            #include <colorspace_fragment>
          }`
      });
      const mesh=new T.Mesh(geom,material);mesh.name=isCard?(isFar?'Wild herbs / slopes':'Wild herbs / leafy clumps'):
        (species===2?'Canola / four-petal racemes and glaucous leaves':species===1?'Lavender / calyx whorls and silvery leaves':'Timothy / culms and foxtail ears');
      mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
      batches.push({mesh,positions,variants,range,spacing,species,isCard,isFar,cache:new Map()});
    }
    add(false,0,13,1.12,1);add(false,1,13,1.22,1);add(false,2,13,1.19,1);
    add(true,-1,64,.84,1.25);add(true,-1,134,2.35,3.05,true);
    function roots(b,tx,tz){
      const key=tx*16384+tz,old=b.cache.get(key);if(old)return old;
      const n=Math.round(tile/b.spacing),rnd=generator(Math.imul(tx,73856093)^Math.imul(tz,19349663)^(b.isFar?83911:47713));
      const data=[];
      for(let j=0;j<n;j++)for(let i=0;i<n;i++){
        const x=(tx+(i+.13+.74*rnd())/n)*tile,z=(tz+(j+.13+.74*rnd())/n)*tile;
        const roll=rnd(),kind=rnd(),a=rnd()*tau,scale=rnd(),tint=rnd();
        const f=sample(x,z),gold=f.canola||0,total=f.grass+f.lavender+gold,choice=kind*total;
        const species=choice<gold?2:choice<gold+f.lavender?1:0;
        const cover=species===2?gold:species===1?f.lavender:f.grass;
        if(cover<=0||roll>cover||(b.species>=0&&species!==b.species))continue;
        const h=species===2?.91+.34*scale:species===1?(.61+.20*scale)*(b.isCard?1.:1.04/.73):.92+.34*scale;
        data.push(x,land(x,z),z,h,a,scale,tint,species);
      }
      b.cache.set(key,data);return data;
    }
    let oldX=Infinity,oldZ=Infinity,wasNear=false;
    function update(x,z){
      const near=(x> -1150&&x< -565&&z> -210&&z<530)||(x> -650&&x< -80&&z>64&&z<620)
        ||(x> -525&&x<425&&z>280&&z<1165);
      if(!near){if(wasNear)for(const b of batches)b.mesh.visible=false;wasNear=false;return;}
      const step=tile/2,sx=Math.floor(x/step),sz=Math.floor(z/step);
      if(wasNear&&sx===oldX&&sz===oldZ)return;oldX=sx;oldZ=sz;wasNear=true;
      const tx=Math.floor(x/tile),tz=Math.floor(z/tile);
      for(const b of batches){
        let n=0;const reach=b.range+tile*1.42,k=Math.ceil(reach/tile);
        // Rebuild a compact instance list when the rider enters the next tile.
        // Empty tiles are cached too, making a return ride deterministic.
        const active=new Set();
        for(let j=tz-k;j<=tz+k;j++)for(let i=tx-k;i<=tx+k;i++){
          if(Math.hypot((i-tx)*tile,(j-tz)*tile)>reach)continue;
          const key=i*16384+j;active.add(key);
          const seed=roots(b,i,j);
          for(let l=0;l<seed.length;l+=8){
            if((seed[l]-x)**2+(seed[l+2]-z)**2>(b.range+step*1.42)**2)continue;
            b.positions.setXYZW(n,seed[l],seed[l+1],seed[l+2],seed[l+3]);
            b.variants.setXYZW(n,seed[l+4],seed[l+5],seed[l+6],seed[l+7]);n++;
          }
        }
        for(const key of b.cache.keys())if(!active.has(key))b.cache.delete(key);
        b.mesh.geometry.instanceCount=n;b.mesh.visible=n>0;
        for(const buffer of [b.positions,b.variants]){
          if(n){buffer.clearUpdateRanges();buffer.addUpdateRange(0,n*4);buffer.needsUpdate=true;}
        }
      }
    }
    return {ready,update};
  }
  root.RideWildfields={uniforms,glsl,sample,build};
})(globalThis);
