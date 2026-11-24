/* Original traveler silhouettes and bicycle coachwork. All geometry shares the rider's paint material. */
(function (scope) {
  "use strict";
  const characters=[
    {id:"iris",name:"绯禾",description:"麦色短檐行帽、栗色短发与斜挎图囊",color:"#bd7552",skin:0xe3a477,shadow:0xce9073,hair:0x743d32,light:0xad6850,iris:0x487355},
    {id:"ren",name:"岚舟",description:"深靛短发、邮差肩带与黄铜信袋",color:"#41516a",skin:0xeabe99,shadow:0xd29d79,hair:0x293344,light:0x616f83,iris:0x596c80},
    {id:"orin",name:"朔岚",description:"银白高髻、青金发带与靛蓝护肩",color:"#9cb8be",skin:0xac7457,shadow:0x975e4a,hair:0xcdcebd,light:0xffefd6,iris:0x735833}
  ];
  const bikes=[
    {id:"road",name:"晴岚公路车",description:"靛蓝菱形车架、弯把与细胎",color:"#38568f"},
    {id:"step",name:"花径漫游车",description:"鼠尾草绿低跨车架、藤篮与奶油色挡泥板",color:"#86afa1"},
    {id:"gravel",name:"远行砾石车",description:"赭红宽胎车架、车架包与后载物架",color:"#bb664b"}
  ];
  function makeCharacters({T,V,batch,headGroup,bodyGroup}) {
    const tau=Math.PI*2,zero=V(0,0,0);
    // Ribbons have elliptical sections. Their painted ridge follows the strand along the curve.
    function lock(parts,coords,width,depth,base,glint) {
      const curve=new T.CatmullRomCurve3(coords.map(q=>V(...q))),steps=14,sides=8;
      const pos=[],colors=[],indices=[],p=V(),d=V(),u=V(),n=V(),q=V();
      const shade=new T.Color(base),bright=new T.Color(glint),mixed=new T.Color();
      const frames=curve.computeFrenetFrames(steps,false);
      for(let j=0;j<=steps;j++){
        const t=j/steps;
        curve.getPointAt(t,p);curve.getTangentAt(t,d);
        // Parallel transport keeps the broad face of the lock from twisting at its tip.
        u.copy(frames.normals[j]);n.crossVectors(d,u).normalize();
        const r=(.07+.93*Math.pow(Math.sin(Math.PI*(.12+.87*t)),.69))*(1-.47*t);
        for(let k=0;k<sides;k++){
          const a=k*tau/sides,cs=Math.cos(a),sn=Math.sin(a);
          q.copy(p).addScaledVector(u,width*r*cs).addScaledVector(n,depth*r*sn);
          pos.push(q.x,q.y,q.z);
          mixed.copy(shade).lerp(bright,(.17+.41*Math.pow(.5+.5*sn,3))*(1-.34*t));
          colors.push(mixed.r,mixed.g,mixed.b);
          if(j){const v=(j-1)*sides+k,w=(j-1)*sides+(k+1)%sides;
            indices.push(v,w,w+sides,v,w+sides,v+sides);}
        }
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
      g.setAttribute("color",new T.Float32BufferAttribute(colors,3));g.setIndex(indices);
      g.computeVertexNormals();parts.geo(g,zero,0xffffff);g.dispose();
    }
    function hairCap(parts,style){
      const pos=[],cols=[],ix=[],steps=15,sides=48;
      const aCol=new T.Color(style.hair),bCol=new T.Color(style.light),c=new T.Color();
      for(let j=0;j<=steps;j++)for(let i=0;i<sides;i++){
        const a=tau*i/sides,back=(1+Math.cos(a))/2,t=j/steps;
        const edge=1.28+back*(style.id==="ren"?1.12:.95)+.075*Math.sin(5*a+1)+.065*Math.sin(9*a-.4);
        const phi=.006+(edge-.006)*t,sn=Math.sin(phi);
        const strand=Math.cos(10*a+1.9*t+.32*Math.sin(4*a));
        const r=sn*(1+.021*strand*t);
        pos.push(.121*r*Math.sin(a),1.693+.139*Math.cos(phi),-.151+.128*r*Math.cos(a));
        c.copy(aCol).lerp(bCol,.09+.22*(1-t)+.17*(.5+.5*strand)*sn);
        cols.push(c.r,c.g,c.b);
        if(j){const v=(j-1)*sides+i,w=(j-1)*sides+(i+1)%sides;
          ix.push(v,v+sides,w+sides,v,w+sides,w);}
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
      g.setAttribute("color",new T.Float32BufferAttribute(cols,3));g.setIndex(ix);g.computeVertexNormals();parts.geo(g,zero,0xffffff);g.dispose();
    }
    function travelHat(parts){
      // A pinched felt crown and a short oval brim. The front shades the brow;
      // the turned-up sides reveal the face in both profile and three-quarter views.
      const sides=48,cz=-.150,ochre=new T.Color(0xc3a068),oat=new T.Color(0xf1d9a2),c=new T.Color();
      function surface(rings,point){
        const pos=[],cols=[],ix=[];
        for(let j=0;j<rings.length;j++)for(let i=0;i<sides;i++){
          const a=tau*i/sides,[x,y,z,light]=point(rings[j],a);
          pos.push(x,y,z);c.copy(ochre).lerp(oat,light);cols.push(c.r,c.g,c.b);
          if(j){const v=(j-1)*sides+i,w=(j-1)*sides+(i+1)%sides;
            ix.push(v,w,w+sides,v,w+sides,v+sides);}
        }
        const g=new T.BufferGeometry();
        g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
        g.setAttribute("color",new T.Float32BufferAttribute(cols,3));g.setIndex(ix);
        g.computeVertexNormals();parts.geo(g,zero,0xffffff);g.dispose();
      }
      const crown=[[.131,.139,1.729,.03],[.134,.144,1.753,.51],[.132,.143,1.777,.64],
        [.125,.135,1.817,.77],[.112,.126,1.849,.83],[.095,.109,1.861,.82],
        [.068,.083,1.855,.70],[.040,.048,1.842,.61],[.002,.003,1.841,.61]];
      function crownPoint([rx,rz,level,light],a){
        const x=Math.sin(a),z=Math.cos(a),top=Math.max(0,(level-1.777)/.084),front=Math.max(0,-z);
        const pinch=1-.17*top*front*Math.abs(x);
        return [rx*x*pinch-.008*top,level+.010*top*z-.006*top*x,
          cz+rz*z+.012*top,light-.10*front*top];
      }
      surface(crown,crownPoint);
      function brimPoint([t,thickness,light],a){
        const x=Math.sin(a),z=Math.cos(a),front=Math.max(0,-z),back=Math.max(0,z);
        const sideCurl=x*x*(.017+.012*x);
        return [(.130+.049*t)*x,1.737+.008*z+t*t*(sideCurl-.019*front+.009*back)+thickness,
          cz+(.138+t*(.046+.024*front))*z,light-.09*back];
      }
      surface([[0,-.003,.22],[.53,-.003,.28],[.96,-.003,.37],[1,0,.66],
        [.97,.002,.79],[.52,.004,.72],[0,.002,.55]],brimPoint);
      // A chestnut grosgrain binding, piped on both sides, wraps the crown.
      const bandPoint=(a,h)=>V((.136-.003*h)*Math.sin(a),1.745+.019*h+.003*Math.cos(a),
        cz+(.145-.002*h)*Math.cos(a));
      const band=new T.BufferGeometry(),p=[],ix=[];
      for(let j=0;j<=1;j++)for(let i=0;i<sides;i++){
        const v=bandPoint(tau*i/sides,j);p.push(v.x,v.y,v.z);
        if(j){const a=i,b=(i+1)%sides;ix.push(a,b,b+sides,a,b+sides,a+sides);}
      }
      band.setAttribute("position",new T.Float32BufferAttribute(p,3));band.setIndex(ix);band.computeVertexNormals();
      parts.geo(band,zero,0x944d37);band.dispose();
      for(const h of [0,1]){
        const curve=[];for(let i=0;i<=32;i++)curve.push(bandPoint(tau*i/32,h));
        parts.cable(curve,.0017,h?0xc78352:0x673e34);
      }
      const pin=bandPoint(-1.38,.55);
      parts.ball(pin,V(.004,.009,.008),0xdcb56d,[.2,0,-.15]);
      // Tailored grosgrain bow knot at the back of the hatband where the twin wind ribbons emerge
      for(const s of [-1,1]){
        parts.ball(V(s*.017,1.749,-.004),V(.013,.0075,.006),0x9b3e2c,[0,s*.25,s*.18]);
      }
      parts.ball(V(0,1.748,-.003),V(.007,.007,.006),0xc78352);
    }
    return characters.map((c,index)=>{
      const hair=batch(),outfit=batch(),jewels=batch();
      const head=new T.Group(),torso=new T.Group();headGroup.add(head);bodyGroup.add(torso);
      const H=(coords,w,d)=>lock(hair,coords,w,d,c.hair,c.light);
      hairCap(hair,c);
      // Almond-shaped eyes share a face plane with brows, eyelid, iris and catchlight.
      for(const s of [-1,1]){
        const eyeX=index===1?.046:.048,tilt=-s*.42;
        hair.ball(V(s*eyeX,1.673,-.262),V(.026,.0125,.0085),0xfcf0d9,[0,tilt,s*.08]);
        hair.ball(V(s*(eyeX-.001),1.674,-.269),V(.010,.012,.0037),c.iris,[0,tilt,0]);
        hair.ball(V(s*(eyeX-.001),1.675,-.272),V(.0055,.008,.0023),0x332e32,[0,tilt,0]);
        hair.ball(V(s*eyeX-.003,1.680,-.274),V(.0032,.0033,.0017),0xffefce);
        hair.cable([V(s*.022,1.674,-.272),V(s*.042,1.686,-.270),V(s*.059,1.684,-.261),V(s*.073,1.681,-.251)],.0029,0x563b36);
        hair.cable([V(s*.023,1.699,-.269),V(s*.046,1.702+(index===1?.006:0),-.263),V(s*.067,1.697,-.250)],index===1?.0048:.0036,c.hair);
      }
      if(c.id==="iris"){
        // Cropped hair cups the nape under the brim. The ends turn in at the ear.
        for(const s of [-1,1]){
          H([[s*.075,1.756,-.225],[s*.107,1.732,-.214],[s*.116,1.702,-.183],[s*.111,1.674,-.177]],.024,.014);
          H([[s*.107,1.735,-.100],[s*.118,1.705,-.098],[s*.111,1.672,-.089],[s*.097,1.646,-.098]],.024,.015);
        }
        for(let k=-2;k<=2;k++){
          const x=k*.032,z=-.028-.032*(k/2)**2;
          H([[x,1.732,z],[x+.007,1.703,z+.004],[x+.004,1.670,z-.006],[x-.009,1.643+.008*Math.abs(k),z-.020]],.026,.013);
        }
        travelHat(hair);
        outfit.cable([V(-.114,1.465,-.146),V(-.064,1.375,-.125),V(.032,1.267,-.005),V(.111,1.138,.105)],.014,0x814e36);
        // Brass strap buckle + map scroll tube + brass compass charm on Iris's satchel
        outfit.ring(V(-.022,1.325,-.072),.015,.0032,0xe2b665,16,[.65,-.45,.3]);
        outfit.ball(V(.138,1.105,.169),V(.042,.061,.069),0x915b3d,[.25,0,.15]);
        outfit.ball(V(.165,1.12,.160),V(.017,.035,.061),0xb98457);
        outfit.ball(V(.178,1.102,.158),V(.005,.009,.008),0xe6be6e);
        outfit.rod(V(.125,1.168,.118),V(.155,1.160,.222),.013,0xf2e3be);
      }else if(c.id==="ren"){
        // A deliberately asymmetric, cropped silhouette with long side-swept bangs.
        for(let k=0;k<5;k++){
          const x=(k-2)*.024;
          H([[x-.038,1.797+.005*k,-.108],[x-.034,1.825,-.160],[x+.001,1.803,-.225],[x+.040,1.765,-.257],[x+.050,1.714+.005*k,-.249]],.031,.026);
        }
        for(const s of [-1,1])for(let k=0;k<3;k++)
          H([[s*.057,1.802,-.152+.013*k],[s*.107,1.765,-.127+.012*k],[s*.119,1.716,-.115+.027*k],[s*(.134-.008*k),1.668-.009*k,-.114+.048*k]],.034,.022);
        for(let k=0;k<3;k++)H([[.036*k-.035,1.80,-.084],[.035*k-.036,1.76,-.043],[.043*k-.046,1.701,-.017],[.055*k-.062,1.636+.008*k,.003+.017*k]],.030,.018);
        outfit.cable([V(.128,1.453,-.143),V(.080,1.388,-.139),V(-.008,1.29,-.053),V(-.084,1.19,.067),V(-.137,1.110,.155)],.018,0x513b34);
        outfit.ball(V(-.152,1.092,.172),V(.053,.065,.084),0x624238,[.09,0,-.20]);
        outfit.ball(V(-.190,1.105,.158),V(.017,.045,.080),0xad7750);
        outfit.ball(V(-.204,1.094,.154),V(.006,.011,.009),0xefc981);
      }else{
        hair.ball(V(0,1.833,-.035),V(.067,.067,.071),c.hair,[-.33,0,.10]);
        for(let k=0;k<6;k++){
          const a=k*tau/6,x=.061*Math.cos(a),z=.063*Math.sin(a);
          H([[x*.29,1.791,-.054+z*.6],[x,1.832,-.034+z],[x*.74,1.871,-.030+z*.9],[x*.12,1.893,-.030+z*.18]],.020,.012);
        }
        for(const s of [-1,1]){
          H([[s*.029,1.824,-.143],[s*.091,1.797,-.203],[s*.116,1.747,-.204],[s*.114,1.67,-.218],[s*.128,1.593,-.190]],.030,.020);
          hair.cable([V(s*.078,1.759,-.241),V(s*.116,1.748,-.180),V(s*.115,1.748,-.124),V(s*.092,1.753,-.069),V(s*.047,1.76,-.043)],.009,0x286874);
          jewels.cable([V(s*.123,1.646,-.145),V(s*.133,1.624,-.143),V(s*.128,1.601,-.140),V(s*.117,1.619,-.143)],.003,0xe2b368);
          outfit.ball(V(s*.150,1.452,-.069),V(.063,.043,.077),0x485774,[.22,0,-s*.28]);
          outfit.cable([V(s*.180,1.450,-.127),V(s*.205,1.445,-.071),V(s*.178,1.461,-.012)],.004,0xc39359);
        }
        hair.rod(V(-.087,1.824,-.024),V(.095,1.858,-.053),.0045,0xefc97e);
        hair.ball(V(-.086,1.824,-.024),V(.013,.013,.012),0x4898a4);
      }
      hair.finish(head,"Hair, eyes and face painting · "+c.id);
      if(c.id==="orin")jewels.finish(head,"Gilt earrings");
      outfit.finish(torso,"Travel wear · "+c.id);
      return {head,torso};
    });
  }
  function makeBikes({T,V,batch,lean,forkGroup,crank,rear,front,seatTube,headTop,headBase}){
    const alloy=0xb9c2bc,bronze=0xa87b48,dark=0x33424a,cream=0xf0dfb9,hide=0x684436;
    const spec=[
      {tube:0x324883,trim:0x6687ad,grip:[0,0,0],width:1},
      {tube:0x79a99b,trim:0xaed3b3,grip:[.028,.035,.092],width:1.24},
      {tube:0xb15e42,trim:0xd88f5b,grip:[.054,.013,.040],width:1.62}
    ];
    const origin=V(0,0,0),at=(x,y,z)=>V(x,y,z);
    function fender(parts,wheel,start,end,tint){
      const pos=[],ix=[],rows=35,across=7;
      for(let j=0;j<=rows;j++)for(let k=0;k<=across;k++){
        const a=start+(end-start)*j/rows,side=k/across*2-1;
        const r=.382-.012*side*side;
        pos.push(wheel.x+.032*side,wheel.y+r*Math.cos(a),wheel.z+r*Math.sin(a));
        if(j&&k){const v=j*(across+1)+k;ix.push(v-across-2,v-across-1,v,v-across-2,v,v-1);}
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
      parts.geo(g,origin,tint);g.dispose();
      for(const s of [-1,1]){
        const a=end-.10;parts.rod(V(s*.034,wheel.y,wheel.z),V(s*.028,wheel.y+.376*Math.cos(a),wheel.z+.376*Math.sin(a)),.0038,alloy);
      }
    }
    function basket(parts){
      // Two elliptical rims and crossing willow strips keep the basket visibly hollow.
      const sample=(a,t)=>at((.127+.046*t)*Math.cos(a),.786+.161*t,-.697+(.103+.027*t)*Math.sin(a));
      for(let i=0;i<20;i++){
        const a=i*Math.PI/10;
        parts.cable([sample(a-.075,0),sample(a,.49),sample(a+.080,1)],.0046,i%2?0xb47f49:0xd5aa71);
      }
      for(let j=0;j<=6;j++){
        const row=[];for(let k=0;k<=24;k++)row.push(sample(k*Math.PI/12,j/6));
        parts.cable(row,j===0||j===6?.0068:.0046,j%2?0xca995f:0xb38251);
      }
      for(let k=-2;k<=2;k++)parts.rod(at(k*.04,.785,-.772),at(k*.04,.785,-.621),.005,0xa37144);
      for(const s of [-1,1])parts.rod(at(s*.062,.383,-.559),at(s*.118,.785,-.684),.0053,alloy);
    }
    return bikes.map((def,i)=>{
      const frame=batch(),fork=batch(),c=spec[i],isRoad=i===0,isStep=i===1;
      const end=V(0,.981,.278),top=headTop,down=headBase;
      frame.rod(seatTube,end,.0165,alloy);
      // Polished seatpost collar clamp + brass head-tube crest badge & artisan lug rings
      frame.ring(seatTube.clone().add(at(0,.012,0)),isRoad?.022:.028,.0045,alloy,20,[Math.PI/2,0,0]);
      frame.ball(down.clone().lerp(top,.52).add(at(0,0,-.028)),V(.009,.022,.006),0xe0b465);
      frame.rod(top.clone().add(at(0,-.018,0)),top.clone().add(at(0,.004,0)),isRoad?.0285:.0345,alloy);
      frame.rod(down.clone().add(at(0,-.004,0)),down.clone().add(at(0,.018,0)),isRoad?.0285:.0345,alloy);
      frame.rod(crank,seatTube,isRoad?.020:.026,c.tube);
      frame.rod(down,top,isRoad?.026:.032,c.trim);
      if(isStep){
        frame.cable([down,at(0,.617,-.315),at(0,.441,-.143),at(0,.396,-.018),at(0,.438,.065),at(0,.563,.137)],.026,c.tube);
        frame.cable([at(0,.795,-.383),at(0,.728,-.314),at(0,.524,-.104),at(0,.471,.003),at(0,.520,.105)],.0165,c.trim);
        fender(frame,rear,-.85,1.90,cream);fender(fork,front,-1.46,1.09,cream);basket(fork);
        frame.ball(at(.072,.346,.222),at(.011,.064,.232),c.tube,[-.08,0,0]);
        fork.ball(at(0,.826,-.821),at(.030,.032,.032),bronze);
        fork.ball(at(0,.826,-.843),at(.024,.024,.012),0xffe3a5);
      }else{
        const tubeTop=isRoad?seatTube:at(0,.760,.204);
        frame.rod(tubeTop,top,isRoad?.018:.023,c.tube);frame.rod(down,crank,isRoad?.023:.031,c.tube);
        for(const t of [.24,.28,.32])frame.rod(down.clone().lerp(crank,t),down.clone().lerp(crank,t+.013),isRoad?.0235:.0315,c.trim);
        // Classic alloy down-tube bottle cage + cream-and-cobalt cycling bidon (water bottle)
        const bStart=down.clone().lerp(crank,.58).add(at(0,.042,.018));
        const bEnd=down.clone().lerp(crank,.37).add(at(0,.046,.012));
        frame.rod(bStart,bEnd,.031,0xf4ebd2);
        frame.rod(bEnd,bEnd.clone().lerp(bStart,-.15),.024,c.tube);
        frame.ball(bEnd.clone().lerp(bStart,-.22),V(.011,.011,.011),bronze);
        for(const s of [-1,1])frame.cable([bStart.clone().add(at(0,-.016,0)),bStart.clone().lerp(bEnd,.5).add(at(s*.034,.005,0)),bEnd.clone().add(at(0,-.014,0))],.0028,alloy);
        // Rear dual-pivot caliper brake bridge & Bowden cable along top tube
        const rearBridge=seatTube.clone().lerp(at(0,.36,.55),.30);
        frame.rod(at(-.032,rearBridge.y,rearBridge.z),at(.032,rearBridge.y,rearBridge.z),.006,alloy);
        for(const s of [-1,1])frame.rod(at(s*.024,rearBridge.y,rearBridge.z),at(s*.021,rearBridge.y-.032,rearBridge.z+.012),.0045,dark);
        frame.cable([top.clone().add(at(.014,-.014,.04)),tubeTop.clone().add(at(.014,-.012,-.04)),rearBridge.clone().add(at(.018,.025,-.02)),rearBridge.clone().add(at(.022,.004,0))],.0024,dark);
        if(!isRoad){
          // A stitched triangular half-frame bag leaves the bottle and crank clear below.
          const outline=[[.20,.761],[-.316,.838],[-.288,.752],[-.044,.584],[.112,.616]];
          const face=new T.Shape();outline.forEach(([z,y],idx)=>idx?face.lineTo(z,y):face.moveTo(z,y));face.closePath();
          const pack=new T.ExtrudeGeometry(face,{depth:.060,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.006});
          const q=new T.Quaternion().setFromAxisAngle(V(0,1,0),-Math.PI/2);
          frame.geo(pack,V(.030,0,0),0x48524b,q);pack.dispose();
          for(const s of [-1,1]){
            frame.cable([at(s*.039,.749,.177),at(s*.039,.775,.037),at(s*.039,.802,-.220)],.0047,0xbd9b72);
            frame.rod(at(s*.054,.383,.55),at(s*.088,.751,.698),.008,0x505557);
            frame.rod(at(s*.054,.383,.55),at(s*.088,.748,.409),.008,0x505557);
            frame.rod(at(s*.087,.748,.402),at(s*.087,.753,.714),.008,0x505557);
          }
          frame.ball(at(0,.824,.559),at(.123,.077,.113),0xc99c64);
          for(const z of [.500,.621])frame.cable([at(-.119,.817,z),at(-.087,.880,z),at(0,.900,z),at(.087,.880,z),at(.119,.817,z)],.009,0x654a3a);
        }
      }
      for(const s of [-1,1]){
        const drop=at(s*.058,.36,.55);
        frame.rod(drop,crank.clone().add(at(s*.041,0,0)),isRoad?.012:.016,c.trim);
        frame.rod(drop,seatTube.clone().add(at(s*.023,0,0)),isRoad?.011:.014,c.tube);
        fork.cable([down,at(s*.047,.653,-.432),at(s*.064,.437,-.528),at(s*.069,.36,-.56)],isRoad?.0135:isStep?.016:.020,c.tube);
        // Front brake caliper arms & brake pads at fork crown
        fork.rod(at(0,.688,-.426),at(s*.025,.666,-.438),.0052,alloy);
        fork.rod(at(s*.022,.658,-.434),at(s*.020,.644,-.442),.0045,dark);
      }
      const lift=c.grip[1],back=c.grip[2],width=c.grip[0];
      const stem=at(0,1.001+lift,-.479+back*.35);
      fork.cable([top,at(0,.977+lift,-.334),stem],.0165,isRoad?c.tube:alloy);
      for(const s of [-1,1]){
        const grip=(x,y,z)=>at(s*(x+width),y+lift,z+back);
        if(isStep){
          fork.cable([stem,at(s*.100,1.058,-.499),at(s*.185,1.058,-.482),grip(.197,1.006,-.549),grip(.197,1.003,-.502)],.013,alloy);
          fork.rod(grip(.197,1.004,-.563),grip(.197,1.004,-.489),.015,hide);
        }else{
          fork.cable([stem,grip(.097,1.012,-.482),grip(.194,1.007,-.504),grip(.197,.995,-.574)],.013,alloy);
          fork.cable([grip(.194,1.006,-.502),grip(.197,.994,-.575),grip(.204,.960,-.603),grip(.206,.919,-.588),grip(isRoad?.201:.225,.911,-.530)],.014,isRoad?0x4c3a36:dark);
        }
        fork.cable([grip(.194,.998,-.557),grip(.205,.970,-.590),grip(.198,.941,-.575)],.006,alloy);
        fork.cable([grip(.194,.970,-.572),grip(.161,.895,-.600),at(s*.085,.795,-.53),at(s*.029,.748,-.408)],.0028,dark);
      }
      return {frame:frame.finish(lean,"Frame and fittings · "+def.id),fork:fork.finish(forkGroup,"Steering and fittings · "+def.id),grip:c.grip,width:c.width};
    });
  }
  scope.RideAtelier={characters,bikes,makeCharacters,makeBikes};
})(globalThis);
