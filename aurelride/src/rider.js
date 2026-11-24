/* Local +Y points up and the front wheel points toward -Z. */
(function (scope) {
  "use strict";
  const looks=[
    {id:"vermilion",name:"朱砂",cut:"traveler",face:0xf24822,shade:0x9c2128,lining:0xc93a2b,thread:0xf8cf86,collar:0xb83526,belt:0x674a42},
    {id:"tide",name:"晴潮",cut:"split",face:0x68c9c5,shade:0x337e86,lining:0xb8e4df,thread:0xffe5ae,collar:0x287477,belt:0x4e6967},
    {id:"amber",name:"橘金",cut:"full",face:0xff7b2e,shade:0xb53c1e,lining:0xffcd89,thread:0xffe6a8,collar:0xc05233,belt:0x795b49},
    {id:"lilac",name:"藤烟",cut:"scarf",face:0xbb9bdc,shade:0x776193,lining:0xe7d1ed,thread:0xffe9cc,collar:0x705b83,belt:0x675c75}
  ];
  function create(T,terrain=scope.RideLand?.height,options={}) {
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const root = new T.Group(), lean = new T.Group();
    root.name = "The meadow rider";
    root.add(lean);
    const up = V(0, 1, 0);
    const tau = Math.PI * 2;
    const unitBall = new T.SphereGeometry(1, 14, 12);
    const unitRod = new T.CylinderGeometry(1, 1, 1, 10, 1);
    const palette = {
      frame: 0x202c57, frameLight: 0x465888, enamel: 0x7790ab, alloy: 0xa7abb2,
      dark: 0x232a36, leather: 0x503e36, sidewall: 0xd4a15d, tread: 0x342f2b,
      cloth: 0xf8f0de, clothShade: 0xb9b6cf, skin: 0xe3a477, nose: 0xe2a27e,
      hair: 0x533222, sunHair: 0x825430, darkHair: 0x3e2b21,
      rust: 0xb73418, orange: 0xed5522, gold: 0xd6a249
    };
    const sunVisibility={value:1};
    function paintedSurface() {
      return new T.ShaderMaterial({
        vertexColors:true,uniforms:{sunVisibility},
        vertexShader:`
          varying vec3 vPaint,vNormal,vEye;
          void main(){
            vec4 mv=modelViewMatrix*vec4(position,1.);
            vNormal=normalize(normalMatrix*normal);vEye=normalize(-mv.xyz);
            vPaint=color;gl_Position=projectionMatrix*mv;
          }`,
        fragmentShader:`
          uniform float sunVisibility;varying vec3 vPaint,vNormal,vEye;
          void main(){
            vec3 n=normalize(vNormal),v=normalize(vEye);
            vec3 sun=normalize(mat3(viewMatrix)*vec3(.55,.62,.56));
            float nd=dot(n,sun), halfLight=smoothstep(-.18,.16,nd);
            float light=smoothstep(.08,.46,nd);
            vec3 shadow=vPaint*vec3(.34,.42,.76)+vec3(.008,.014,.042);
            vec3 halfTone=vPaint*vec3(.74,.78,.95);
            float linen=smoothstep(.38,.72,min(vPaint.r,min(vPaint.g,vPaint.b)));
            shadow=mix(shadow,vPaint*vec3(.18,.32,.74)+vec3(.010,.024,.068),linen);
            halfTone=mix(halfTone,vPaint*vec3(.68,.79,1.02),linen);
            vec3 rgb=mix(mix(shadow,halfTone,halfLight),vPaint*vec3(1.12,1.08,.99),light);
            float Fresnel=pow(1.-max(0.,dot(n,v)),2.8);
            float sunRim=Fresnel*smoothstep(-.22,.72,nd)*(.06+.34*sunVisibility);
            rgb+=sunRim*vec3(1.06,.95,.74);
            gl_FragColor=vec4(rgb*mix(vec3(.36,.48,.76),vec3(1.),sunVisibility),1.);
            #include <colorspace_fragment>
          }`
      });
    }
    const mat=paintedSurface();
    const colored = new Map();
    function color(hex) {
      if (!colored.has(hex)) colored.set(hex, new T.Color(hex));
      return colored.get(hex);
    }
    function batch() {
      const pos = [], normal = [], cols = [], indices = [];
      const p = V(), n = V(), normalMatrix = new T.Matrix3();
      function append(geo, matrix, shade) {
        const a=geo.getAttribute("position"),b=geo.getAttribute("normal"),tint=geo.getAttribute("color");
        const start = pos.length / 3, rgb = color(shade);
        normalMatrix.getNormalMatrix(matrix);
        for (let i = 0; i < a.count; i++) {
          p.fromBufferAttribute(a,i).applyMatrix4(matrix);
          n.fromBufferAttribute(b,i).applyMatrix3(normalMatrix).normalize();
          pos.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);
          if(tint)cols.push(rgb.r*tint.getX(i),rgb.g*tint.getY(i),rgb.b*tint.getZ(i));
          else cols.push(rgb.r,rgb.g,rgb.b);
        }
        const ix = geo.getIndex();
        if (ix) for (let i = 0; i < ix.count; i++) indices.push(start+ix.getX(i));
        else for (let i = 0; i < a.count; i++) indices.push(start+i);
      }
      function compose(at,rot,scale) {
        return new T.Matrix4().compose(at, rot || new T.Quaternion(), scale || V(1,1,1));
      }
      function geo(g,at,shade,rot,scale) {append(g,compose(at,rot,scale),shade);}
      function ball(at,radii,shade,tilt) {
        const q = tilt ? new T.Quaternion().setFromEuler(new T.Euler(...tilt)) : null;
        geo(unitBall,at,shade,q,radii);
      }
      function rod(a,b,r,shade) {
        const dir = b.clone().sub(a), length = dir.length();
        if (length < 0.0001) return;
        geo(unitRod,a.clone().lerp(b,0.5),shade,
          new T.Quaternion().setFromUnitVectors(up,dir.normalize()),V(r,length,r));
      }
      function cable(points,r,shade) {
        const c = new T.CatmullRomCurve3(points);
        const tube = new T.TubeGeometry(c, Math.max(7,points.length*3),r,5,false);
        geo(tube,V(0,0,0),shade); tube.dispose();
      }
      function ring(at, radius, thickness, shade, steps) {
        const tor = new T.TorusGeometry(radius, thickness, 8, steps || 44);
        geo(tor,at,shade,new T.Quaternion().setFromAxisAngle(up,Math.PI/2));
        tor.dispose();
      }
      function finish(parent,name) {
        const g=new T.BufferGeometry();
        g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
        g.setAttribute("normal",new T.Float32BufferAttribute(normal,3));
        g.setAttribute("color",new T.Float32BufferAttribute(cols,3));
        g.setIndex(indices); g.computeBoundingSphere();
        const mesh = new T.Mesh(g,mat); mesh.name=name || ""; mesh.castShadow = true;
        parent.add(mesh); return mesh;
      }
      return {geo,ball,rod,cable,ring,finish};
    }
    // Closed, smoothly varying cross sections give clothes, nose and shoes a tailored silhouette.
    // Each section stores height, centre Z, half-width, half-depth and optional centre X.
    function sculpt(rings, slices) {
      const pos=[],ix=[],cnt=slices || 18;
      for (let j=0;j<rings.length;j++) {
        const [y,z,rx,rz,x=0] = rings[j];
        for (let k=0;k<cnt;k++) {
          const a=tau*k/cnt;
          pos.push(x+rx*Math.cos(a),y,z+rz*Math.sin(a));
          if (j) {
            const prev=(j-1)*cnt+k, pn=(j-1)*cnt+(k+1)%cnt;
            const curr=prev+cnt, cn=pn+cnt;
            ix.push(prev,curr,cn,prev,cn,pn);
          }
        }
      }
      const g=new T.BufferGeometry();
      g.setAttribute("position",new T.Float32BufferAttribute(pos,3)); g.setIndex(ix);
      g.computeVertexNormals(); return g;
    }
    function sculptInto(b,rings,col,slices) {
      const g=sculpt(rings,slices); b.geo(g,V(0,0,0),col); g.dispose();
    }
    function tapered(b,a,end,profile,col) {
      const axis=end.clone().sub(a),length=axis.length();
      const rings=profile.map(([t,rx,rz])=>[t*length,0,rx,rz || rx]);
      const g=sculpt(rings,14);
      b.geo(g,a,col,new T.Quaternion().setFromUnitVectors(up,axis.normalize()));
      g.dispose();
    }
    const b=batch(),torsoParts=batch(),headParts=batch();
    const forkGroup=new T.Group(),bodyGroup=new T.Group(),headGroup=new T.Group();
    forkGroup.name='Steering assembly';bodyGroup.name='Seated body';headGroup.name='Gaze';
    lean.add(forkGroup,bodyGroup);bodyGroup.add(headGroup);
    const rear=V(0,.36,.55), front=V(0,.36,-.56), crank=V(0,.34,.06);
    const seatTube=V(0,.82,.225), headTop=V(0,.855,-.363), headBase=V(0,.727,-.403);
    const {characters,bikes,makeCharacters,makeBikes}=scope.RideAtelier;
    const bikeModels=makeBikes({T,V,batch,lean,forkGroup,crank,rear,front,seatTube,headTop,headBase});
    b.ball(V(0,.982,.254),V(.083,.032,.135),palette.leather,[-.04,0,0]);
    b.ball(V(0,.985,.141),V(.038,.024,.083),palette.leather);
    // Brooks-style copper cantle rivets + stitched leather under-saddle tool roll
    for(let r=-2;r<=2;r++){
      const rx=r*.026,rz=.374-.014*r*r;
      b.ball(V(rx,.989,rz),V(.0045,.0035,.0045),0xd99b56);
    }
    b.rod(V(-.046,.938,.318),V(.046,.938,.318),.023,0x5e4132);
    for(const sx of [-.028,.028])b.ring(V(sx,.938,.318),.024,.0032,0xc8995e,20,[0,0,Math.PI/2]);
    b.cable([V(.036,.958,.306),V(.035,.933,.208),V(.027,.955,.143)],.004,palette.alloy);
    b.cable([V(-.036,.958,.306),V(-.035,.933,.208),V(-.027,.955,.143)],.004,palette.alloy);
    // 5-speed alloy rear cassette cogs + classic rear derailleur & jockey wheels
    for(let cog=0;cog<5;cog++){
      b.ring(V(.036+cog*.0045,.36,.55),.038-cog*.0052,.0022,cog%2?palette.alloy:palette.frameLight,28);
    }
    b.rod(V(.062,.36,.55),V(.066,.302,.562),.0065,palette.alloy);
    b.ring(V(.066,.322,.558),.013,.0032,palette.dark,18);
    b.ring(V(.066,.294,.566),.014,.0032,palette.dark,18);
    b.ring(V(.054,.34,.06),.084,.006,palette.alloy,44);
    b.ring(V(.054,.34,.06),.073,.005,palette.frameLight,40);
    b.rod(V(-.068,.34,.06),V(.068,.34,.06),.019,palette.dark);
    for (let j=0;j<5;j++) {
      const a=j*tau/5;
      b.rod(V(.054,.34,.06),V(.054,.34+.078*Math.cos(a),.06+.078*Math.sin(a)),
        .007,palette.alloy);
    }
    b.cable([V(.065,.423,.06),V(.065,.414,.21),V(.065,.392,.55),
      V(.065,.359,.587),V(.065,.308,.568),V(.065,.282,.556),V(.065,.265,.079),
      V(.065,.281,.004),V(.065,.341,-.019),V(.065,.40,.003),V(.065,.423,.06)],
      .0039,palette.dark);
    // Shirt beneath the cape, gathered waist and forearms fixed to the grips.
    const jacket=sculpt([
      [.953,.244,.03,.039],[.987,.225,.119,.097],[1.042,.215,.139,.111],
      [1.13,.166,.139,.109],[1.25,.098,.145,.098],[1.354,.030,.165,.106],
      [1.446,-.059,.191,.105],[1.487,-.089,.167,.089],[1.513,-.108,.087,.065]
    ],34);
    const jacketColor=[],jacketPosition=jacket.attributes.position;
    const fabric=new T.Color(),jacketLight=color(0xf6ead6),jacketDark=color(0x637a84);
    for(let i=0;i<jacketPosition.count;i++){
      const y=jacketPosition.getY(i),x=jacketPosition.getX(i);
      // A woven blue-grey waist panel and ivory shoulders read through the split tails.
      const line=1.183+.059*Math.abs(x)/.15;
      const w=T.MathUtils.smoothstep(y,line-.014,line+.014);
      fabric.copy(jacketDark).lerp(jacketLight,w);
      jacketColor.push(fabric.r,fabric.g,fabric.b);
    }
    jacket.setAttribute('color',new T.Float32BufferAttribute(jacketColor,3));
    torsoParts.geo(jacket,V(0,0,0),0xffffff);jacket.dispose();
    // A closely cut sleeveless riding waistcoat follows the bend above the saddle.
    const coatParts=batch(),collarParts=batch(),beltParts=batch();
    for(const s of [-1,1]){
      coatParts.cable([V(s*.113,1.45,-.145),V(s*.072,1.40,-.157),V(s*.027,1.325,-.092),
        V(s*.010,1.25,-.010),V(s*.012,1.113,.067)],.0033,0xaa8970);
      coatParts.cable([V(s*.152,1.42,-.045),V(s*.145,1.34,.056),
        V(s*.131,1.19,.169),V(s*.128,1.092,.227)],.0028,0xb6a18a);
    }
    for(let j=0;j<3;j++)coatParts.ball(V(0,1.14+j*.054,.049-j*.040),V(.005,.006,.004),0xd3a85b);
    sculptInto(beltParts,[[1.017,.223,.133,.106],[1.029,.222,.144,.112],[1.052,.209,.145,.115],
      [1.065,.202,.141,.112]],0xffffff);
    coatParts.ball(V(-.005,1.040,.100),V(.023,.014,.007),0xdaa75e);
    // A rounded pelvis continues beneath the belt through the full pedal stroke.
    torsoParts.ball(V(0,1.003,.224),V(.133,.091,.101),palette.clothShade);
    const armRig=[];
    for(const s of [-1,1]){
      const shoulder=V(.171*s,1.438,-.084),elbow=V(.218*s,1.207,-.237),wrist=V(.197*s,1.027,-.499);
      const mid=shoulder.clone().lerp(elbow,.72);
      const skin=s>0?0xce9073:palette.skin,sleeve=s>0?0xd7cfdd:palette.cloth;
      const upper=batch(),lower=batch(),hand=batch();
      tapered(upper,shoulder,mid,[[-.22,.028],[-.10,.065],[.16,.073],
        [.42,.071],[.82,.058],[.92,.062],[.97,.062],[1.02,.054]],sleeve);
      const cuffStart=shoulder.clone().lerp(mid,.88);
      tapered(upper,cuffStart,mid,[[0,.060],[.33,.063],[.78,.062],[1,.060]],s>0?0xc6c0cf:0xe6ddcb);
      tapered(upper,mid,elbow,[[-.14,.043],[.15,.048],[.55,.043],[.88,.041],
        [1.03,.038],[1.12,.022]],skin);
      tapered(lower,elbow,wrist,[[-.095,.018],[-.04,.038],[.015,.040],[.18,.044],
        [.44,.038],[.76,.028],[1.03,.026]],skin);
      // The heel of each hand rests on the leather; curved fingers hook underneath.
      hand.ball(wrist,V(.029,.031,.042),skin,[-.40,0,s*.05]);
      hand.ball(V(s*.196,1.011,-.536),V(.030,.023,.048),skin,[-.10,s*.14,0]);
      for(let i=0;i<4;i++){
        const zz=-.515-i*.013;
        hand.cable([V(s*.208,1.018,zz),V(s*.219,1.002,zz-.006),
          V(s*.217,.991,zz-.007),V(s*.202,.986,zz-.009)],.0071-i*.00040,skin);
      }
      hand.cable([V(s*.184,1.016,-.531),V(s*.170,1.000,-.548),V(s*.177,.994,-.559)],.009,skin);
      const upperMesh=upper.finish(lean,"Tailored sleeve and upper arm");
      const lowerMesh=lower.finish(lean,"Forearm");
      const handMesh=hand.finish(forkGroup,"Hand holding grip");
      upperMesh.geometry.translate(-shoulder.x,-shoulder.y,-shoulder.z);
      lowerMesh.geometry.translate(-elbow.x,-elbow.y,-elbow.z);
      armRig.push({s,shoulder,wrist,restWrist:wrist.clone(),handMesh,upperMesh,lowerMesh,
        start:V(),end:V(),bend:V(),upperLength:shoulder.distanceTo(elbow),lowerLength:elbow.distanceTo(wrist),
        upperAxis:elbow.clone().sub(shoulder).normalize(),lowerAxis:wrist.clone().sub(elbow).normalize()});
    }
    sculptInto(headParts,[[1.476,-.106,.054,.051],[1.509,-.117,.057,.057],
      [1.538,-.131,.049,.052],[1.566,-.15,.047,.052],
      [1.588,-.164,.057,.061]],palette.skin);
    sculptInto(headParts,[[1.540,-.204,.030,.047],[1.556,-.198,.054,.063],
      [1.576,-.187,.072,.076],[1.598,-.177,.083,.088],[1.630,-.168,.099,.101],
      [1.653,-.164,.105,.110],[1.679,-.159,.104,.114],[1.708,-.156,.108,.113],
      [1.745,-.151,.102,.107],[1.782,-.148,.076,.084],[1.806,-.145,.01,.019]],palette.skin,40);
    for(const s of [-1,1]) {
      headParts.ball(V(s*.102,1.657,-.141),V(.024,.035,.020),palette.skin,[-.24,0,s*.14]);
      headParts.ball(V(s*.112,1.659,-.145),V(.013,.021,.013),0xc1805c);
      headParts.cable([V(s*.119,1.674,-.144),V(s*.124,1.663,-.155),
        V(s*.122,1.649,-.149),V(s*.117,1.646,-.144)],.0033,0xe4a178);
    }
    sculptInto(headParts,[[1.632,-.263,.008,.006],[1.637,-.268,.016,.012],
      [1.643,-.271,.018,.016],[1.649,-.273,.014,.017],[1.658,-.270,.011,.013],
      [1.671,-.265,.010,.010],[1.687,-.260,.008,.005]],palette.nose,28);
    headParts.ball(V(0,1.600,-.266),V(.017,.0038,.0025),0xc98b78);
    headParts.cable([V(-.024,1.605,-.259),V(-.008,1.602,-.266),
      V(.009,1.603,-.266),V(.024,1.606,-.259)],.0025,0xa56551);
    const portraits=makeCharacters({T,V,batch,headGroup,bodyGroup});
    // Wind-streaming twin grosgrain hat ribbons on Iris's straw hat for lively Ghibli motion!
    const ribbonSegs=10,ribbonVerts=2*(ribbonSegs+1)*2;
    const ribbonPos=new Float32Array(ribbonVerts*3),ribbonCol=new Float32Array(ribbonVerts*3),ribbonIdx=[];
    const ribBase=color(0x9b3e2c),ribTip=color(0xd87a56),ribMix=new T.Color();
    for(let r=0;r<2;r++){
      const baseV=r*(ribbonSegs+1)*2;
      for(let j=0;j<=ribbonSegs;j++){
        const t=j/ribbonSegs;
        ribMix.copy(ribBase).lerp(ribTip,t*.55);
        for(let k=0;k<2;k++){
          const vi=(baseV+j*2+k)*3;
          ribbonCol[vi]=ribMix.r;ribbonCol[vi+1]=ribMix.g;ribbonCol[vi+2]=ribMix.b;
        }
        if(j<ribbonSegs){
          const a=baseV+j*2;
          ribbonIdx.push(a,a+1,a+3,a,a+3,a+2);
        }
      }
    }
    const ribbonGeo=new T.BufferGeometry(),ribbonAttr=new T.BufferAttribute(ribbonPos,3);
    ribbonAttr.setUsage(T.DynamicDrawUsage);
    ribbonGeo.setAttribute("position",ribbonAttr);
    ribbonGeo.setAttribute("color",new T.BufferAttribute(ribbonCol,3));
    ribbonGeo.setIndex(ribbonIdx);
    const ribbonMat=mat.clone();ribbonMat.side=T.DoubleSide;
    const hatRibbons=new T.Mesh(ribbonGeo,ribbonMat);
    hatRibbons.name="Wind-streaming straw hat ribbons";hatRibbons.frustumCulled=false;
    headGroup.add(hatRibbons);
    function updateHatRibbons(time,vSpeed,turnLag,gust){
      hatRibbons.visible=characterIndex===0;
      if(!hatRibbons.visible)return;
      const air=clamp(vSpeed/15,0,1.25),len=.29;
      for(let r=0;r<2;r++){
        const side=r?1:-1,baseV=r*(ribbonSegs+1)*2;
        const rootX=side*.016,rootY=1.744,rootZ=-.004;
        for(let j=0;j<=ribbonSegs;j++){
          const t=j/ribbonSegs,t2=t*t;
          const wave=Math.sin(time*7.2-t*5.4+r*1.9)*(.012+.038*air+.018*gust)*t2;
          const sideFlutter=Math.cos(time*5.6-t*4.6+r*2.4)*(.010+.026*air)*t2 + turnLag*.065*t2;
          const lift=.14+.74*Math.min(1,air*.95+gust*.25);
          const cx=rootX + side*(.010+.026*t) + sideFlutter;
          const cy=rootY - len*t*(1-.68*lift) + wave;
          const cz=rootZ + len*t*(.32+.68*lift) + Math.abs(wave)*.25;
          const halfW=.0085*(1-.42*t*t);
          const twist=.35*Math.sin(time*6.0-t*3.8+r);
          const wx=halfW*Math.cos(twist),wy=halfW*Math.sin(twist);
          const v0=(baseV+j*2)*3,v1=v0+3;
          ribbonPos[v0]=cx-wx;ribbonPos[v0+1]=cy-wy;ribbonPos[v0+2]=cz;
          ribbonPos[v1]=cx+wx;ribbonPos[v1+1]=cy+wy;ribbonPos[v1+2]=cz;
        }
      }
      ribbonAttr.needsUpdate=true;ribbonGeo.computeVertexNormals();
    }
    sculptInto(collarParts,[[1.469,-.095,.122,.089],[1.485,-.107,.128,.095],
      [1.503,-.121,.107,.081],[1.525,-.132,.074,.061]],0xffffff);
    torsoParts.ball(V(-.023,1.478,-.192),V(.014,.015,.010),palette.gold);
    torsoParts.cable([V(-.051,1.478,-.184),V(-.036,1.465,-.190),
      V(-.022,1.458,-.191),V(-.010,1.472,-.189)],.0027,0xf4d794);
    b.finish(lean,"Saddle, chain and drive train");
    const tunic=torsoParts.finish(bodyGroup,"Tailored tunic and seated hips");
    const coat=coatParts.finish(bodyGroup,"Linen riding waistcoat");
    const collar=collarParts.finish(bodyGroup,"Silk collar"),belt=beltParts.finish(lean,"Woven belt");
    const face=headParts.finish(headGroup,"Face and neck");

    const wheelData=batch(),spokeData=batch();
    wheelData.ring(V(0,0,0),.342,.018,0x332c2b,76);
    for(const s of [-1,1]){
      wheelData.ring(V(s*.012,0,0),.338,.0092,0xbd8c52,76);
      wheelData.ring(V(s*.016,0,0),.3338,.0032,0xe5bc86,76);
      wheelData.ring(V(s*.009,0,0),.325,.0054,0xc1c8ca,76);
      for(let i=0;i<16;i++){
        const a=tau*i/16+(s>0?.061:0), hubA=a+(i%2===0?.62:-.62);
        spokeData.rod(V(s*.035,.020*Math.cos(hubA),.020*Math.sin(hubA)),
          V(s*.005,.325*Math.cos(a),.325*Math.sin(a)),.0017,0x8991a1);
      }
    }
    wheelData.rod(V(-.045,0,0),V(.045,0,0),.019,palette.alloy);
    const frontYaw=new T.Group(); frontYaw.position.copy(front); forkGroup.add(frontYaw);
    const wheels=[wheelData.finish(lean,"Rear wheel"),null];
    wheels[0].position.copy(rear);
    const frontRim=wheels[0].geometry.clone(),rimColors=frontRim.attributes.color;
    // The light sidewall on the leading wheel and the honey rear sidewall are
    // visible through the rotating spokes. Both retain a distinct dark tread.
    const leadingTones=new Map([
      [0xbd8c52,0xcac4b0],[0xe5bc86,0xeae7db],[0x332c2b,0x484644]
    ]);
    for(const [from,to] of leadingTones){
      const src=color(from),dst=color(to);
      for(let i=0;i<rimColors.count;i++){
        if(Math.abs(rimColors.getX(i)-src.r)<.00001&&Math.abs(rimColors.getY(i)-src.g)<.00001)
          rimColors.setXYZ(i,dst.r,dst.g,dst.b);
      }
    }
    wheels[1]=new T.Mesh(frontRim,mat); wheels[1].castShadow=true;
    wheels[1].name="Front wheel";frontYaw.add(wheels[1]);
    const spokeMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{blur:{value:0}},vertexShader:`varying float radial;
        void main(){radial=length(position.yz)/.325;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float blur;varying float radial;
        void main(){float fast=mix(.56,.12,smoothstep(.06,.94,radial));
          gl_FragColor=vec4(vec3(.196,.227,.273),mix(.96,fast,blur));
          #include <colorspace_fragment>
        }`});
    const rearSpokes=spokeData.finish(wheels[0],"Rear spokes");
    rearSpokes.material=spokeMaterial;rearSpokes.castShadow=false;
    const frontSpokes=new T.Mesh(rearSpokes.geometry,spokeMaterial);wheels[1].add(frontSpokes);
    // Three narrow, feathered reflections across the rotating spoke bed. Leave the
    // rest of the wheel fully transparent so the blades and flowers show through.
    const motionInk=new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,
      uniforms:{strength:{value:0},clock:{value:0}},
      vertexShader:`varying vec2 disk;void main(){disk=position.yz/.323;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 disk;uniform float strength,clock;
        void main(){float r=length(disk);float angle=atan(disk.y,disk.x);
          float moving=angle+1.15*r-.3*sin(clock*1.7)+clock*.58;
          float arc=pow(max(0.,cos(3.*moving+.44*sin(2.*angle))),7.);
          float ring=exp(-pow((r-.78)/.165,2.))+.40*exp(-pow((r-.47)/.11,2.));
          float root=.35*exp(-pow((r-.19)/.21,2.));
          float a=.27*strength*(arc*ring+root);if(a<.003)discard;
          gl_FragColor=vec4(vec3(.29,.32,.37),a);
          #include <colorspace_fragment>
        }`});
    const disk=new T.CircleGeometry(.323,48);disk.rotateY(Math.PI/2);
    const rearStreaks=new T.Mesh(disk,motionInk);rearStreaks.position.copy(rear);lean.add(rearStreaks);
    const frontStreaks=new T.Mesh(disk,motionInk);frontYaw.add(frontStreaks);

    // A continuous fabric tube follows the thigh and calf through the knee. Its
    // volume is carried by changing cross sections rather than separate joint pieces.
    const tailoring=[];
    function makeTrousers(side) {
      const rows=35,sides=22,count=rows*sides;
      const pos=new Float32Array(count*3),cols=new Float32Array(count*3),indices=[];
      const clothColor=new T.Color();
      const profile=[[0,.065,.107],[.09,.081,.112],[.24,.087,.101],[.39,.077,.081],
        [.49,.064,.063],[.55,.060,.061],[.68,.062,.067],[.80,.051,.051],
        [.915,.035,.037],[.955,.043,.047],[.985,.037,.040],[1,.034,.034]];
      const stations=[],widths=new Float32Array(count),depths=new Float32Array(count);
      let k=0;
      for(let j=0;j<rows;j++){
        const t=j/(rows-1);
        while(k<profile.length-2&&t>profile[k+1][0])k++;
        const lo=profile[k],hi=profile[k+1],m=(t-lo[0])/(hi[0]-lo[0]);
        const rx=lo[1]+(hi[1]-lo[1])*m,rz=lo[2]+(hi[2]-lo[2])*m;
        stations.push({t,rx,rz});
        for(let i=0;i<sides;i++){
          const angle=tau*i/sides,sa=Math.sin(angle),ca=Math.cos(angle),n=j*sides+i;
          const fold1=Math.exp(-Math.pow((t-(.505+.042*sa))/.024,2));
          const fold2=Math.exp(-Math.pow((t-(.902+.024*ca))/.020,2));
          widths[n]=(rx+.004*fold1+.003*fold2)*ca;depths[n]=(rz+.009*fold1+.005*fold2)*sa;
          if(j){const m=(j-1)*sides+i,n=(j-1)*sides+(i+1)%sides;
            indices.push(m,n+sides,m+sides,m,n,n+sides);}
        }
      }
      const g=new T.BufferGeometry(),attr=new T.BufferAttribute(pos,3);attr.setUsage(T.DynamicDrawUsage);
      g.setAttribute("position",attr);g.setAttribute("color",new T.BufferAttribute(cols,3));g.setIndex(indices);
      const mesh=new T.Mesh(g,mat);mesh.name="Tailored trousers and fitted gaiters";mesh.frustumCulled=false;lean.add(mesh);
      // The field outfit has soft leather ankle boots, the courier has a woven knee
      // binding, and the coast rider wears a taller storm gaiter with a gold welt.
      const paints=[
        [0xf5e5c4,0x839691,0x775441,0xbe9670,.810],
        [0x87999d,0x555e72,0x534039,0xc79c64,.714],
        [0x6f829d,0x515572,0x394757,0xddb77e,.647]
      ];
      const outfits=paints.map(([cloth,crease,leather,binding,boot],variant)=>{
        const base=color(cloth),fold=color(crease),dark=color(leather),trim=color(binding);
        const paint=new Float32Array(cols.length),spans=new Float32Array(rows),depthsScale=new Float32Array(rows);
        for(let j=0;j<rows;j++){
          const t=stations[j].t;
          const blouse=Math.exp(-Math.pow((t-boot+.069)/.095,2));
          spans[j]=1+blouse*(variant===0?.055:variant===1?.19:.11);
          depthsScale[j]=1+blouse*(variant===1?.14:.085);
          for(let i=0;i<sides;i++){
            const a=tau*i/sides,sa=Math.sin(a),n=j*sides+i;
            const seam=Math.exp(-28*(1-Math.cos(a-(side>0?0:Math.PI))));
            const pleat=Math.exp(-Math.pow((t-(.48+.035*sa))/.034,2))*(.5+.5*sa);
            clothColor.copy(base).lerp(fold,.09+.50*pleat+.28*seam+.08*Math.max(0,sa));
            if(t>=boot){
              clothColor.copy(dark);
              const cuff=t<boot+.035||variant===1&&t>boot+.085&&t<boot+.118;
              clothColor.lerp(trim,cuff?.77:.07+.18*seam);
            }
            paint[n*3]=clothColor.r;paint[n*3+1]=clothColor.g;paint[n*3+2]=clothColor.b;
          }
        }
        return {paint,spans,depthsScale};
      });
      let outfit=outfits[0];
      tailoring.push(index=>{
        outfit=outfits[index];cols.set(outfit.paint);g.attributes.color.needsUpdate=true;
      });
      const ctr=V(),tangent=V(),horizontal=V(),depth=V(),q=V(),aa=V(),bb=V(),from=V(),to=V();
      const outer=V(1,0,0);
      // The rounded bend touches the kneecap. Its inner face gathers while the
      // outside of the fabric stretches to the new angle on each pedal stroke.
      function section(t,H,K,A,target) {
        const band=.095;
        if(t<.5-band)return target.copy(H).lerp(K,t*2);
        if(t>.5+band)return target.copy(K).lerp(A,(t-.5)*2);
        aa.copy(H).lerp(K,1-band*2);bb.copy(K).lerp(A,band*2);
        const u=(t-(.5-band))/(2*band),v=1-u;
        return target.copy(aa).multiplyScalar(v*v).addScaledVector(K,2*u*v).addScaledVector(bb,u*u);
      }
      return (hip,knee,ankle)=>{
        for(let j=0;j<rows;j++){
          const {t}=stations[j];
          section(t,hip,knee,ankle,ctr);section(Math.max(0,t-.01),hip,knee,ankle,from);
          section(Math.min(1,t+.01),hip,knee,ankle,to);
          tangent.subVectors(to,from).normalize();horizontal.copy(outer).addScaledVector(tangent,-tangent.x).normalize();
          depth.crossVectors(tangent,horizontal).normalize();
          for(let i=0;i<sides;i++){
            const n=j*sides+i,index=n*3;
            q.copy(ctr).addScaledVector(horizontal,widths[n]*outfit.spans[j]).addScaledVector(depth,depths[n]*outfit.depthsScale[j]);
            pos[index]=q.x;pos[index+1]=q.y;pos[index+2]=q.z;
          }
        }
        attr.needsUpdate=true;g.computeVertexNormals();
      };
    }
    const legs=[];
    for(const s of [-1,1]){
      const animateCloth=makeTrousers(s);
      const shoeB=batch();
      sculptInto(shoeB,[[-.055,-.040,.049,.104],[-.043,-.041,.052,.111],
        [-.035,-.044,.052,.115],[-.006,-.033,.052,.107],
        [.025,-.012,.046,.088],[.051,.003,.037,.046]],palette.leather);
      sculptInto(shoeB,[[-.058,-.042,.047,.105],[-.05,-.044,.051,.110],
        [-.043,-.044,.052,.113]],palette.dark);
      for(let i=0;i<2;i++) shoeB.rod(V(-.038,.021-i*.006,-.038-i*.017),
        V(.038,.021-i*.006,-.038-i*.017),.004,0x887661);
      const shoe=shoeB.finish(lean,"Leather cycling shoe");
      const cr=batch(); cr.rod(V(0,0,0),V(0,0,.161),.010,palette.alloy);
      cr.rod(V(-.020,0,.161),V(.020,0,.161),.009,palette.dark);
      const arm=cr.finish(lean,"Rotating crank");
      arm.position.copy(crank);arm.position.x=s*.079;
      const pedalPart=batch();pedalPart.rod(V(-.042,0,-.033),V(.042,0,-.033),.0056,palette.alloy);
      pedalPart.rod(V(-.042,0,.033),V(.042,0,.033),.0056,palette.alloy);
      for(const sx of [-.042,.042])pedalPart.rod(V(sx,0,-.033),V(sx,0,.033),.0064,palette.dark);
      const pedal=pedalPart.finish(lean,"Level platform pedal");
      legs.push({s,pedal,neutralHip:V(s*.087,1.036,.219),hip:V(),knee:V(),animateCloth,shoe,arm});
    }
    // Two selvages share a seam through the yoke. Below the slit they are separate
    // vertices, allowing one silk tail to overlap or lift clear of the other.
    const capeU=22,capeV=26,panelSize=(capeU+1)*(capeV+1),capeCount=2*panelSize;
    const cp=new Float32Array(capeCount*3),garmentUV=new Float32Array(capeCount*2),ci=[];
    const windSheet=[];
    for(let panel=0;panel<2;panel++)for(let j=0;j<=capeV;j++)for(let i=0;i<=capeU;i++){
      const v=j/capeV,local=i/capeU,u=(panel+local)*.5,s=2*u-1;
      const k=panel*panelSize+j*(capeU+1)+i;
      windSheet.push({u,v,s,local,side:panel?1:-1,free:v*v*(2-v),
        outer:panel?local:1-local,shoulder:1-s*s,arch:Math.sin(Math.PI*v)});
      garmentUV[k*2]=u;garmentUV[k*2+1]=v;
      if(i&&j){const a=k-capeU-2,e=k-capeU-1,h=k-1;ci.push(a,h,k,a,k,e);}
    }
    const capeGeometry=new T.BufferGeometry(),capeAttr=new T.BufferAttribute(cp,3);
    capeAttr.setUsage(T.DynamicDrawUsage);capeGeometry.setAttribute("position",capeAttr);
    capeGeometry.setAttribute("uv",new T.BufferAttribute(garmentUV,2));capeGeometry.setIndex(ci);
    const capePaint=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{sunVisibility,
      silk:{value:new T.Color()},silkShade:{value:new T.Color()},lining:{value:new T.Color()},
      gold:{value:new T.Color()},split:{value:.42},separate:{value:1},emblem:{value:0}},
      vertexShader:`
        varying vec2 cut;varying vec3 clothNormal,toEye;
        void main(){
          cut=uv;
          vec4 mv=modelViewMatrix*vec4(position,1.);
          clothNormal=normalMatrix*normal;toEye=-mv.xyz;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`
        uniform vec3 silk,silkShade,lining,gold;
        uniform float sunVisibility,split,separate,emblem;
        varying vec2 cut;varying vec3 clothNormal,toEye;
        float band(float d,float w){
          float aa=max(.001,.70*fwidth(d));
          return 1.-smoothstep(w-aa,w+aa,d);
        }
        float stitch(vec2 p,vec2 a,vec2 b){
          vec2 e=b-a;
          return length(p-a-e*clamp(dot(p-a,e)/dot(e,e),0.,1.));
        }
        float crest(vec2 p){
          p.x=abs(p.x);
          float d;
          if(emblem<.5){
            d=min(stitch(p,vec2(0.,-.85),vec2(.38,0.)),stitch(p,vec2(.38,0.),vec2(0.,.87)));
            d=min(d,stitch(p,vec2(0.,-.19),vec2(.79,0.)));
            d=min(d,stitch(p,vec2(.79,0.),vec2(0.,.18)));
          }else if(emblem<1.5){
            d=min(stitch(p,vec2(0.,.72),vec2(.24,.03)),stitch(p,vec2(.24,.03),vec2(.90,-.59)));
            d=min(d,stitch(p,vec2(.90,-.59),vec2(.61,.10)));
            d=min(d,stitch(p,vec2(.61,.10),vec2(0.,.72)));
          }else{
            d=abs(length(p-vec2(0.,-.18))-.52);
            d=max(d,-p.y-.38);
            d=min(d,stitch(p,vec2(0.,.78),vec2(.49,.43)));
            d=min(d,stitch(p,vec2(.49,.43),vec2(.80,.58)));
          }
          return 1.-smoothstep(.047,.058+fwidth(d),d);
        }
        void main(){
          float u=cut.x,v=cut.y;
          vec3 n=normalize(clothNormal),eye=normalize(toEye);
          float nv=dot(n,eye);
          // Face normals point out of the back of the garment. Both layers catch
          // transmitted skylight. Soft folds and a narrow selvedge reveal the cut.
          vec3 N=nv<0.?-n:n;
          vec3 sun=normalize(mat3(viewMatrix)*vec3(.55,.62,.56));
          float along=.5+.5*cos(13.*u-2.4*v+1.2*sin(v*3.8+u*3.2));
          float fold=.08*along+.13*smoothstep(.04,.98,v)+.22*(1.-abs(nv));
          vec3 face=mix(silk,silkShade,fold);
          float light=dot(N,sun);
          float silkFlash=pow(max(0.,dot(normalize(eye+sun),N)),8.5);
          vec3 c=gl_FrontFacing?face:mix(lining,silk,.36);
          float wrapLight=smoothstep(-.42,.56,light);
          // Intense glowing vermilion-gold subsurface scattering when sunlight punches through billowing silk!
          float trans=pow(clamp(dot(-sun,eye)*.5+.5,0.,1.),1.6)*smoothstep(-.48,.76,-light)*(.38+.62*v)*sunVisibility;
          c*=mix(vec3(.36,.43,.73),vec3(1.20,1.08,.96),wrapLight);
          c+=trans*mix(silk,vec3(1.18,.74,.26),.58)*.66;
          c+=silkFlash*.22*sunVisibility*mix(c,vec3(1.),.48)+.16*sunVisibility*pow(1.-abs(nv),2.0)*vec3(1.10,.90,.64);
          float edge=min(u,1.-u);
          edge=min(edge,mix(1.,abs(.5-u),separate*smoothstep(split,split+.18,v)));
          float binding=band(edge,.0055),piping=band(abs(edge-.020),.0022);
          float hem=band(1.-v,.0065)+.6*band(abs(.975-v),.003);
          c=mix(c,gold,.74*clamp(binding+.69*piping+hem,0.,1.));
          vec2 badge=(cut-vec2(.27,.32))*vec2(9.8,11.3);
          c=mix(c,gold,.80*crest(badge));
          gl_FragColor=vec4(c*mix(vec3(.38,.48,.74),vec3(1.),sunVisibility),1.);
          #include <colorspace_fragment>
        }`});
    const cape=new T.Mesh(capeGeometry,capePaint);
    cape.name="Split silk riding mantle";cape.castShadow=true;cape.frustumCulled=false;bodyGroup.add(cape);
    let lookIndex=0;
    // Cache painted skin vertices so a complexion change reaches arms, fingers and face together.
    const skinMeshes=[face,...armRig.flatMap(a=>[a.upperMesh,a.lowerMesh,a.handMesh])];
    const skinSlots=skinMeshes.map(mesh=>{
      const a=mesh.geometry.attributes.color,points=mesh.geometry.attributes.position,slots=[];
      const colors=[palette.skin,0xce9073,palette.nose,0xc1805c,0xe4a178].map(color);
      for(let i=0;i<a.count;i++){
        const key=colors.findIndex(c=>Math.abs(a.getX(i)-c.r)<.00001&&Math.abs(a.getY(i)-c.g)<.00001&&Math.abs(a.getZ(i)-c.b)<.00001);
        if(key>=0){
          const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
          const flush=mesh===face&&key===0&&z<-.21?.31*Math.exp(-((Math.abs(x)-.070)**2/.00067+(y-1.649)**2/.00035)):0;
          slots.push([i,key,flush]);
        }
      }
      return {a,slots};
    });
    const originalFace=face.geometry.attributes.position.clone();
    const rose=new T.Color(),skinPaint=new T.Color();
    let characterIndex=0,bikeIndex=0;
    function selectIndex(list,id){
      return typeof id==="number"&&Number.isInteger(id)?id:list.findIndex(entry=>entry.id===id);
    }
    function setCharacter(id){
      const i=selectIndex(characters,id);
      if(i<0||i>=characters.length)return characters[characterIndex];
      characterIndex=i;
      capePaint.uniforms.emblem.value=i;
      portraits.forEach((m,j)=>{m.head.visible=m.torso.visible=i===j;});
      for(const fit of tailoring)fit(i);
      const c=characters[i],base=color(c.skin),shade=color(c.shadow);
      rose.copy(shade).lerp(color(0xd67d72),.43);
      const p=face.geometry.attributes.position;
      for(let idx=0;idx<p.count;idx++){
        const x=originalFace.getX(idx),y=originalFace.getY(idx),z=originalFace.getZ(idx);
        const jaw=z<-.184?Math.exp(-((y-1.588)**2/.00125)):0;
        p.setXYZ(idx,x*(1+jaw*[0,.115,-.065][i]),y-.005*jaw*(i===2?1:0),z-.003*jaw*(i===1?1:0));
      }
      p.needsUpdate=true;face.geometry.computeVertexNormals();
      const tones=[base,shade,base.clone().lerp(color(0xc98177),.18),shade.clone().multiplyScalar(.83),base.clone().lerp(color(0xffc5a0),.13)];
      for(const {a,slots} of skinSlots){
        for(const [idx,key,blush] of slots){skinPaint.copy(tones[key]).lerp(rose,blush);a.setXYZ(idx,skinPaint.r,skinPaint.g,skinPaint.b);}
        a.needsUpdate=true;
      }
      return c;
    }
    function setBike(id){
      const i=selectIndex(bikes,id);
      if(i<0||i>=bikes.length)return bikes[bikeIndex];
      bikeIndex=i;bikeModels.forEach((m,j)=>{m.frame.visible=m.fork.visible=i===j;});
      const model=bikeModels[i],[w,y,z]=model.grip;
      for(const arm of armRig){
        arm.handMesh.position.set(w*arm.s,y,z);
        arm.wrist.copy(arm.restWrist).add(arm.handMesh.position);
      }
      for(const wheel of wheels)wheel.scale.x=model.width;
      return bikes[i];
    }
    setCharacter(0);setBike(0);
    function tintPiece(piece,tint){
      const rgb=color(tint),a=piece.geometry.attributes.color;
      for(let i=0;i<a.count;i++)a.setXYZ(i,rgb.r,rgb.g,rgb.b);
      a.needsUpdate=true;
    }
    function setLook(id){
      const index=typeof id==="number"?id:looks.findIndex(look=>look.id===id);
      if(index<0||index>=looks.length||!Number.isInteger(index))return looks[lookIndex];
      lookIndex=index;
      const look=looks[index],u=capePaint.uniforms;
      u.silk.value.setHex(look.face);u.silkShade.value.setHex(look.shade);
      u.lining.value.setHex(look.lining);u.gold.value.setHex(look.thread);
      u.split.value=look.cut==="scarf"?.13:.42;
      u.separate.value=look.cut==="split"||look.cut==="scarf"?1:0;
      tintPiece(collar,look.collar);tintPiece(belt,look.belt);
      return look;
    }
    function cycleLook(){return setLook((lookIndex+1)%looks.length);}
    setLook(0);
    const shirtSpace=new T.Matrix4(),clothWorld=new T.Quaternion(),clothUp=V(),seatInCloth=V();
    const sleeveSurfaces=armRig.map(()=>({from:V(),delta:V(),length2:0}));
    function upperBackDepth(x,y,z) {
      // Both shirt and mantle live in chest space. At the top of the cape the
      // cloth wraps onto the curved shirt and sleeves instead of passing through
      // their backs when the elbows flex or gravity lowers the panel at rest.
      const shoulder=T.MathUtils.smoothstep(y,1.29,1.445);
      const width=.149+.044*shoulder,ratio=x/width;
      if(Math.abs(ratio)<1.0){
        const spineZ=-.090+(1.486-y)*.77;
        z=Math.max(z,spineZ+.111*Math.sqrt(1-ratio*ratio)+.026);
      }
      for(const {from,delta,length2} of sleeveSurfaces){
        const t=clamp(((x-from.x)*delta.x+(y-from.y)*delta.y)/length2,0,1);
        const dx=x-from.x-t*delta.x,dy=y-from.y-t*delta.y,r=.080-.014*t;
        const inside=r*r-dx*dx-dy*dy;
        if(inside>0)z=Math.max(z,from.z+delta.z*t+Math.sqrt(inside)+.007);
      }
      return z;
    }
    // World-space Verlet + Diagonal Shear cloth simulation (13 x 17) with traveling vortex waves & sculptural silk flutes!
    const simU=12,simV=16,simCols=simU+1,simRows=simV+1,simCount=simCols*simRows;
    const simCurr=Array.from({length:simCount},()=>V());
    const simPrev=Array.from({length:simCount},()=>V());
    let simInit=false;
    const simInvMat=new T.Matrix4(),simTmpA=V(),simTmpB=V(),simTmpC=V(),simAirDir=V();
    const simRearWorld=V(),simSeatWorld=V(),simBackWorld=V(),simLastAnchor=V();
    const rearInCloth=V(),rackInCloth=V();

    function cloth(time,shoulderWind,turnLag,hemWind,crossWind,gust,drag,terrainPitch,planted,fallLift,dtStep,speedNow) {
      bodyGroup.updateWorldMatrix(true,false);
      simInvMat.copy(bodyGroup.matrixWorld).invert();
      const cut=looks[lookIndex].cut,scarf=cut==="scarf",traveler=cut==="traveler";
      const full=cut==="full"||traveler,slit=scarf?.13:.44;
      const baseLen=traveler?1.48:scarf?1.36:full?1.44:1.40;
      const segLen=baseLen/simV;
      const topHalfW=scarf?.095:.205;
      const hemHalfW=scarf?.20:.58;
      // Pin collar row (j = 0) smoothly around shoulders
      for(let i=0;i<=simU;i++){
        const u=i/simU,s=2*u-1;
        const rx=topHalfW*s;
        const ry=(scarf?1.514:1.508)-(scarf?.024:.038)*s*s;
        const rz=(scarf?-.044:.034)-(scarf?.058:.102)*s*s;
        simCurr[i].set(rx,ry,rz).applyMatrix4(bodyGroup.matrixWorld);
        simPrev[i].copy(simCurr[i]);
      }
      simBackWorld.set(0,1.25,.09).applyMatrix4(bodyGroup.matrixWorld);
      simSeatWorld.set(0,.972,.275).applyMatrix4(lean.matrixWorld);
      simRearWorld.set(0,.36,.55).applyMatrix4(lean.matrixWorld);
      simTmpA.set(0,0,-1).transformDirection(root.matrixWorld).normalize();
      simTmpB.set(1,0,0).transformDirection(root.matrixWorld).normalize();

      const anchor=simCurr[simU>>1];
      const jumped=!simInit||anchor.distanceToSquared(simLastAnchor)>9;
      if(jumped){
        simInit=true;
        for(let j=1;j<=simV;j++){
          const v=j/simV;
          const halfW=topHalfW+(hemHalfW-topHalfW)*v;
          for(let i=0;i<=simU;i++){
            const u=i/simU,s=2*u-1,idx=j*simCols+i;
            simCurr[idx].set(halfW*s,1.50-baseLen*v*.52,.06+baseLen*v*.84).applyMatrix4(bodyGroup.matrixWorld);
            simPrev[idx].copy(simCurr[idx]);
          }
        }
      }
      simLastAnchor.copy(anchor);

      const totalH=clamp(dtStep||1/60,1/240,.04);
      const subSteps=totalH>1/75?2:1;
      const h=totalH/subSteps,h2=h*h;
      const vSpeed=Math.max(0,speedNow||0);
      const speedBlend=clamp(vSpeed/16,0,1.35);
      const flowFactor=clamp((vSpeed+2.2)/12.5,0.18,1.55);
      simAirDir.copy(simTmpA).multiplyScalar(-1).addScaledVector(simTmpB,crossWind*.56+.52*turnLag).normalize();
      const damping=0.974;

      for(let step=0;step<subSteps;step++){
        for(let j=1;j<=simV;j++){
          const v=j/simV,vCurve=Math.pow(v,1.25);
          for(let i=0;i<=simU;i++){
            const u=i/simU,s=2*u-1,idx=j*simCols+i;
            const cur=simCurr[idx],prv=simPrev[idx];
            const vx=(cur.x-prv.x)*damping,vy=(cur.y-prv.y)*damping,vz=(cur.z-prv.z)*damping;
            prv.copy(cur);

            // Progressive slipstream lift + traveling Kármán vortex waves rolling from collar to hem!
            const sailPush=(4.8+vSpeed*1.62+gust*4.2)*(0.38+0.62*v);
            const liftY=(0.9+Math.min(8.6,vSpeed*.62+gust*3.1+fallLift*7.5))*(0.32+0.68*Math.sin(v*Math.PI*.72));
            const fanOut=s*(1.4+vSpeed*.34+gust*1.1)*v*(.82+.18*Math.sin(time*3.6-v*4.0));

            const wavePhase=time*5.8-v*6.6;
            const vortexY=(Math.sin(wavePhase+s*1.4)*.68+Math.sin(wavePhase*1.7-s*2.6+1.2)*.32)*(4.6+9.4*flowFactor)*vCurve;
            const vortexSide=Math.cos(time*4.5-v*5.8+s*1.9)*(2.2+6.2*flowFactor)*v*v + turnLag*(2.8+5.6*speedBlend)*vCurve;

            const ax=simAirDir.x*sailPush + simTmpB.x*(fanOut+vortexSide);
            const ay=-9.4 + liftY + vortexY;
            const az=simAirDir.z*sailPush + simTmpB.z*(fanOut+vortexSide);

            cur.x+=vx+ax*h2;
            cur.y+=vy+ay*h2;
            cur.z+=vz+az*h2;
          }
        }

        // Structural + diagonal shear relaxation keeps woven silk supple & prevents rigid board stretching
        for(let iter=0;iter<4;iter++){
          for(let j=0;j<=simV;j++){
            const v=j/simV;
            const restH=(topHalfW+(hemHalfW-topHalfW)*v)*2/simU;
            const restDiag=Math.hypot(segLen,restH);
            for(let i=0;i<=simU;i++){
              const idx=j*simCols+i,p1=simCurr[idx];
              if(j<simV){
                const p2=simCurr[idx+simCols];
                const dx=p2.x-p1.x,dy=p2.y-p1.y,dz=p2.z-p1.z;
                const d=Math.hypot(dx,dy,dz)||.0001;
                const diff=(d-segLen)/d;
                if(j===0){
                  p2.x-=dx*diff;p2.y-=dy*diff;p2.z-=dz*diff;
                }else{
                  p1.x+=dx*diff*.46;p1.y+=dy*diff*.46;p1.z+=dz*diff*.46;
                  p2.x-=dx*diff*.54;p2.y-=dy*diff*.54;p2.z-=dz*diff*.54;
                }
                if(j>0 && i<simU && iter<2){
                  const pD=simCurr[idx+simCols+1];
                  const sx=pD.x-p1.x,sy=pD.y-p1.y,sz=pD.z-p1.z;
                  const sd=Math.hypot(sx,sy,sz)||.0001;
                  const sDiff=(sd-restDiag)/sd*.18;
                  p1.x+=sx*sDiff;p1.y+=sy*sDiff;p1.z+=sz*sDiff;
                  pD.x-=sx*sDiff;pD.y-=sy*sDiff;pD.z-=sz*sDiff;
                }
              }
              if(j>0 && i<simU){
                const p2=simCurr[idx+1];
                const dx=p2.x-p1.x,dy=p2.y-p1.y,dz=p2.z-p1.z;
                const d=Math.hypot(dx,dy,dz)||.0001;
                const diff=(d-restH)/d*.32;
                p1.x+=dx*diff;p1.y+=dy*diff;p1.z+=dz*diff;
                p2.x-=dx*diff;p2.y-=dy*diff;p2.z-=dz*diff;
              }
            }
          }
        }

        for(let j=1;j<=simV;j++){
          for(let i=0;i<=simU;i++){
            const p=simCurr[j*simCols+i];
            if(terrain){
              const floor=terrain(p.x,p.z)+.14;
              if(p.y<floor)p.y=floor;
            }
            simTmpC.subVectors(p,simBackWorld);
            const dBack=simTmpC.length();
            if(dBack<.27&&dBack>.001)p.copy(simBackWorld).addScaledVector(simTmpC,.27/dBack);
            simTmpC.subVectors(p,simSeatWorld);
            const dSeat=simTmpC.length();
            if(dSeat<.21&&dSeat>.001)p.copy(simSeatWorld).addScaledVector(simTmpC,.21/dSeat);
            simTmpC.subVectors(p,simRearWorld);
            const dWheel=simTmpC.length();
            if(dWheel<.45&&dWheel>.001)p.copy(simRearWorld).addScaledVector(simTmpC,.45/dWheel);
          }
        }
      }

      // Transform lean-space saddle, rear wheel & gravel rack into bodyGroup local space for 100% poke-free silk!
      seatInCloth.copy(simSeatWorld).applyMatrix4(simInvMat);
      rearInCloth.copy(simRearWorld).applyMatrix4(simInvMat);
      if(bikeIndex===2)rackInCloth.set(0,.83,.56).applyMatrix4(lean.matrixWorld).applyMatrix4(simInvMat);

      const wavePower=clamp((vSpeed+1.8)/11.5,0.22,1.38)*(0.85+0.32*gust);
      for(let k=0;k<windSheet.length;k++){
        const {u,v,s,local,side,outer,arch}=windSheet[k];
        const sewn=full?0:T.MathUtils.smoothstep(v,slit,1);
        const fu=clamp(u*simU,0,simU-.0001),fv=clamp(v*simV,0,simV-.0001);
        const iu=Math.floor(fu),iv=Math.floor(fv),tu=fu-iu,tv=fv-iv;
        const c00=simCurr[iv*simCols+iu],c10=simCurr[iv*simCols+iu+1];
        const c01=simCurr[(iv+1)*simCols+iu],c11=simCurr[(iv+1)*simCols+iu+1];
        const w00=(1-tu)*(1-tv),w10=tu*(1-tv),w01=(1-tu)*tv,w11=tu*tv;

        const vGain=Math.pow(v,1.30);
        const bigRoll=Math.sin(time*5.4-v*6.2+s*1.15)*.115*vGain*wavePower;
        const trailRipple=Math.sin(time*9.2-v*10.8+s*2.8)*.052*v*v*wavePower*(.40+.60*Math.abs(s));
        const slowBreath=Math.cos(time*2.8-v*3.4-s*.8)*.048*vGain*wavePower;
        const dropSettle=-.095*v*(1-.62*Math.min(1,vSpeed/12));
        const sailDome=arch*(.048*wavePower)*(1-.28*s*s);
        const sideWave=(Math.sin(time*4.2-v*5.0+s*1.5)*.082 + Math.cos(time*7.4-v*8.6-s*2.2)*.038)*vGain*wavePower;

        simTmpC.set(
          c00.x*w00+c10.x*w10+c01.x*w01+c11.x*w11 + simTmpB.x*sideWave,
          c00.y*w00+c10.y*w10+c01.y*w01+c11.y*w11 + bigRoll + trailRipple + slowBreath + sailDome + dropSettle,
          c00.z*w00+c10.z*w10+c01.z*w01+c11.z*w11 + simTmpB.z*sideWave
        ).applyMatrix4(simInvMat);

        // 3.5 living longitudinal silk flutes + rounded billowing split lobes (never pointy triangles!)
        const fluteWave=Math.sin(s*8.4 + Math.sin(v*3.4-time*4.1)*.65 - time*2.2);
        const fluteAmp=(.014+.042*Math.pow(v,.85))*(.48+.52*wavePower)*T.MathUtils.smoothstep(v,.05,.28);
        const lobeArch=Math.sin(local*Math.PI);
        const panelSpread=side*sewn*(.042+.052*lobeArch)*(.45+.55*wavePower);
        const cornerRound=-.022*outer*outer*v*v*(1-.35*Math.min(1,vSpeed/16));

        let x=simTmpC.x + panelSpread + s*fluteAmp*.18;
        let y=simTmpC.y + fluteWave*fluteAmp*.65 + lobeArch*sewn*.024*wavePower + cornerRound;
        let z=simTmpC.z + fluteWave*fluteAmp*.88 + (.012+.022*lobeArch)*v;
        if(y>1.12&&v<.34)z=upperBackDepth(x,y,z);

        // Exact local-space saddle + tool-roll, rear-wheel tire arc, and cargo-rack guards
        const uSeat=((x-seatInCloth.x)/.175)**2 + ((y-seatInCloth.y)/.145)**2;
        if(uSeat<1)z=Math.max(z,seatInCloth.z+.175*Math.sqrt(1-uSeat));
        const dyW=y-rearInCloth.y,dxW=(x-rearInCloth.x)/.115;
        if(Math.abs(dyW)<.40 && Math.abs(dxW)<1){
          const wheelArc=Math.sqrt(Math.max(0,.40*.40-dyW*dyW))*Math.sqrt(1-dxW*dxW);
          z=Math.max(z,rearInCloth.z+wheelArc);
        }
        if(bikeIndex===2){
          const uRack=((x-rackInCloth.x)/.155)**2 + ((y-rackInCloth.y)/.115)**2;
          if(uRack<1)z=Math.max(z,rackInCloth.z+.145*Math.sqrt(1-uRack));
        }
        cp[k*3]=x;cp[k*3+1]=y;cp[k*3+2]=z;
      }
      capeAttr.needsUpdate=true;capeGeometry.computeVertexNormals();
    }
    // Project the articulated silhouette onto a small ground patch. All parts share one
    // opacity mask, so overlapping silhouette layers cast a single shadow.
    function makeGroundShadow() {
      if(typeof document==="undefined") return ()=>{};
      const canvas=document.createElement("canvas"),size=256,span=6.2,scale=size/span;
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext("2d");
      if(!ctx)return ()=>{};
      const tex=new T.CanvasTexture(canvas);tex.generateMipmaps=false;
      tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;
      const receiver={texture:tex,span,strength:0,pasture:false};
      if(options.preview!==true)scope.RideRider.shadow=receiver;
      const g=new T.PlaneGeometry(span,span,16,16);g.rotateX(-Math.PI/2);
      const mesh=new T.Mesh(g,new T.MeshBasicMaterial({map:tex,color:0x0b1938,
        transparent:true,opacity:.80,depthWrite:false,toneMapped:false,
        polygonOffset:true,polygonOffsetFactor:-2,
        blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
        blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,side:T.DoubleSide}));
      mesh.name="Ground-following rider and bicycle shadow";mesh.renderOrder=2;
      root.add(mesh);
      const p=g.attributes.position,vec=V(),out=V();
      const pose=new T.Quaternion(),leanOffset=V();
      const headPose=new T.Matrix4();
      let lastPose=-999;
      const dx=-.96,dz=-.92;
      let gradientX=0,gradientZ=0,rayVertical=1,altitude=0;
      function project(point,matrix){
        vec.copy(point);
        if(matrix)vec.applyMatrix4(matrix);
        vec.applyQuaternion(pose).add(leanOffset);
        // Intersect the light ray with the terrain plane; a hillside changes
        // the shadow length as well as the height of the receiving vertices.
        const drop=(vec.y+altitude-gradientX*vec.x-gradientZ*vec.z)/rayVertical;
        out.set((vec.x+dx*drop)*scale+size/2,(vec.z+dz*drop)*scale+size/2,0);
        return out;
      }
      function line(points,r,closed,matrix) {
        ctx.beginPath();
        for(let i=0;i<points.length;i++){
          const s=project(points[i],matrix);if(i)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y);
        }
        if(closed)ctx.closePath();
        if(r){ctx.lineWidth=2*r*scale;ctx.stroke();}else ctx.fill();
      }
      const hoop=[];
      for(let i=0;i<=28;i++)hoop.push(V(0,.344*Math.cos(i*tau/28),.344*Math.sin(i*tau/28)));
      const rimShape=wheel=>hoop.map(q=>q.clone().add(wheel));
      const hoops=[rimShape(front),rimShape(rear)];
      const hatRim=Array.from({length:18},(_,i)=>{
        const a=tau*i/18,x=Math.sin(a),z=Math.cos(a),front=Math.max(0,-z);
        return V(.179*x,1.737+.008*z+x*x*(.017+.012*x)-.019*front+.009*Math.max(0,z),
          -.150+(.184+.024*front)*z);
      });
      const hatCrown=[V(0,1.754,-.150),V(-.005,1.835,-.141)];
      const torso=[V(-.18,1.467,-.091),V(.18,1.467,-.091),V(.142,1.19,.13),
        V(.123,1.001,.258),V(-.125,1.001,.258),V(-.142,1.19,.13)];
      return (time,dynamics)=>{
        mesh.quaternion.copy(root.quaternion).invert();
        altitude=Math.max(0,dynamics.airHeight||0);
        receiver.pasture=Boolean(dynamics.shadowInMeadow);
        mesh.visible=!receiver.pasture&&altitude<1.66;
        const baseOp=options.preview===true?.28:dynamics.inWater?.40:.86;
        receiver.strength=mesh.material.opacity=baseOp*sunVisibility.value*(1-T.MathUtils.smoothstep(altitude,.08,1.85));
        if(receiver.strength<=.001)return;
        if(Math.abs(time-lastPose)<1/36-.001)return;
        lastPose=time;pose.copy(root.quaternion).multiply(lean.quaternion);
        leanOffset.copy(lean.position).applyQuaternion(root.quaternion);
        gradientX=-groundNormal.x/groundNormal.y;gradientZ=-groundNormal.z/groundNormal.y;
        rayVertical=Math.max(.30,1+dx*gradientX+dz*gradientZ);
        headPose.multiplyMatrices(bodyGroup.matrix,headGroup.matrix);
        const receiverHeight=dynamics.shadowHeight||terrain;
        if(receiverHeight)for(let i=0;i<p.count;i++){
          p.setY(i,receiverHeight(root.position.x+p.getX(i),root.position.z+p.getZ(i))-root.position.y+.037);
        } else for(let i=0;i<p.count;i++)p.setY(i,.037);
        p.needsUpdate=true;ctx.clearRect(0,0,size,size);ctx.lineJoin=ctx.lineCap="round";
        ctx.fillStyle=ctx.strokeStyle="#fff";
        // Contact under the two tire patches anchors the bicycle even when the
        // cast silhouette leaves it obliquely on a banked patch of grass.
        if(altitude<.05)for(const wheel of [front,rear]){
          vec.set(wheel.x,wheel.y-.36,wheel.z);
          const foot=project(vec,wheel===front?forkGroup.matrix:null);
          ctx.beginPath();ctx.ellipse(foot.x,foot.y,1.35,2.3,-root.rotation.y,0,tau);ctx.fill();
        }
        line(hoops[0],.021,true,forkGroup.matrix);line(hoops[1],.021,true);
        line([rear,crank,headBase],.019);line([headBase,front],.019,false,forkGroup.matrix);
        line([rear,seatTube],.015);
        if(bikeIndex===1){
          line([headBase,V(0,.44,-.14),V(0,.40,-.02),V(0,.52,.12)],.025);
          line([V(0,.79,-.80),V(0,.94,-.82),V(0,.94,-.59),V(0,.79,-.60)],.012,true,forkGroup.matrix);
        }else{
          line([seatTube,headTop,headBase],.018);
          if(bikeIndex===2){
            line([V(0,.755,.20),V(0,.833,-.316),V(0,.588,-.044),V(0,.616,.112)],0,true);
            line([V(0,.82,.47),V(0,.82,.64)],.074);
          }
        }
        line([seatTube,crank],.022);line([headTop,V(0,1.01,-.53)],.012);
        line(torso,0,true,bodyGroup.matrix);
        line([V(0,1.48,-.105),V(0,1.61,-.151)],.058,false,bodyGroup.matrix);
        line([V(0,1.622,-.157),V(0,1.737,-.153)],.101,false,headPose);
        if(characterIndex===0){
          line(hatRim,0,true,headPose);
          line(hatCrown,.106,false,headPose);
        }
        if(characterIndex===2)line([V(0,1.81,-.046),V(0,1.85,-.032)],.058,false,headPose);
        for(const leg of legs) {
          line([leg.hip,leg.knee],.067);
          line([leg.knee,leg.shoe.position],.048);
          line([leg.shoe.position,leg.shoe.position.clone().add(V(0,-.027,-.128))],.042);
        }
        for(const arm of armRig)line([arm.start,arm.bend,arm.end],.040);
        // Trace each silk panel as ONE closed perimeter polygon + 1.8px overlap stroke so ZERO seam lines ever appear!
        const clothPoint=(panel,j,i)=>{const n=3*(panel*panelSize+j*(capeU+1)+i);return V(cp[n],cp[n+1],cp[n+2]);};
        for(let panel=0;panel<2;panel++){
          const ring=[];
          for(let i=0;i<=capeU;i+=4)ring.push(clothPoint(panel,0,i));
          ring.push(clothPoint(panel,0,capeU));
          for(let j=4;j<=capeV;j+=4)ring.push(clothPoint(panel,j,capeU));
          ring.push(clothPoint(panel,capeV,capeU));
          for(let i=capeU-2;i>=0;i-=2)ring.push(clothPoint(panel,capeV,i));
          ring.push(clothPoint(panel,capeV,0));
          for(let j=capeV-4;j>=4;j-=4)ring.push(clothPoint(panel,j,0));
          ctx.beginPath();
          for(let k=0;k<ring.length;k++){
            const s=project(ring[k],bodyGroup.matrix);
            if(k)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y);
          }
          ctx.closePath();ctx.fill();
          ctx.lineWidth=1.8;ctx.stroke();
        }
        tex.needsUpdate=true;
      };
    }
    const updateShadow=makeGroundShadow();
    const unit=V(),forwardKnee=V(),knee=V(),ankle=V(),axis=V(),pole=V(),target=V();
    const hub=V(0,1.020,.217),neck=V(0,1.501,-.117);
    const forkAxis=headTop.clone().sub(headBase).normalize();
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const ease=(a,b,rate,h)=>a+(b-a)*(1-Math.exp(-rate*h));
    const axles={front:V(),rear:V()};
    const groundNormal=V(0,1,0),tireAxis=V(),support=V(),contact=V();
    const frontMatrix=new T.Matrix4(),pelvis=new T.Object3D();
    let lastRoadPitch=0,roadPitch=0,frontGap=0,rearGap=0;
    function tireGap(center,matrix,terrain){
      tireAxis.set(1,0,0).transformDirection(matrix);
      // A tilted hoop touches the local slope on the lower edge of its sidewall.
      support.copy(groundNormal).addScaledVector(tireAxis,-groundNormal.dot(tireAxis)).normalize();
      contact.copy(center).addScaledVector(support,-.342).addScaledVector(groundNormal,-.018);
      return (contact.y-terrain(contact.x,contact.z))*groundNormal.y;
    }
    function placeWheels(terrain){
      const x=root.position.x,z=root.position.z;
      root.updateWorldMatrix(true,false);
      if(terrain){
        const r=.35;
        const gx=(terrain(x+r,z)-terrain(x-r,z))/(2*r),gz=(terrain(x,z+r)-terrain(x,z-r))/(2*r);
        groundNormal.set(-gx,1,-gz).normalize();
        const forwardGrade=-gx*Math.sin(root.rotation.y)-gz*Math.cos(root.rotation.y);
        roadPitch=Math.atan(forwardGrade);
        lean.rotation.x=roadPitch-root.rotation.x;
      } else {
        roadPitch=root.rotation.x;lean.rotation.x=0;
        groundNormal.copy(up);frontGap=rearGap=0;
      }
      // Start from the actual fork pose. Solve the common height and relative
      // height of the two contacts, even across a crest or a banked traverse.
      lean.position.y=0;
      for(let pass=0;pass<3;pass++){
        lean.updateWorldMatrix(false,false);
        frontMatrix.multiplyMatrices(lean.matrixWorld,forkGroup.matrix);
        axles.front.copy(front).applyMatrix4(frontMatrix);
        axles.rear.copy(rear).applyMatrix4(lean.matrixWorld);
        if(!terrain)break;
        frontGap=tireGap(axles.front,frontMatrix,terrain);
        rearGap=tireGap(axles.rear,lean.matrixWorld,terrain);
        if(pass===2 || Math.max(Math.abs(frontGap),Math.abs(rearGap))<.0003)break;
        lean.position.y-=clamp((.55*frontGap+.56*rearGap)/1.11,-.24,.24);
        lean.rotation.x+=clamp((rearGap-frontGap)/1.11,-.20,.20);
      }
    }
    // This exact critically damped spring remains stable when frames arrive unevenly.
    function spring(x,target,omega,h) {
      const residue=x.value-target,delta=x.rate+omega*residue,decay=Math.exp(-omega*h);
      x.value=target+(residue+delta*h)*decay;x.rate=(x.rate-omega*delta*h)*decay;
    }
    function transformAt(group,anchor,destination) {
      target.copy(anchor).applyQuaternion(group.quaternion);
      group.position.copy(destination).sub(target);group.updateMatrix();
    }
    // Sew the lower part of the tunic to the pelvis while its collar follows
    // the chest. The gradual change across the waist keeps the belt and hips
    // in contact as the rib cage swings independently through a power stroke.
    const waistMeshes=[tunic,coat].map(mesh=>{
      const {position,normal}=mesh.geometry.attributes,vertices=[];
      for(let i=0;i<position.count;i++){
        const y=position.getY(i);if(y>=1.28)continue;
        const s=clamp((1.28-y)/.19,0,1);
        vertices.push({i,w:s*s*(3-2*s),p:V().fromBufferAttribute(position,i),n:V().fromBufferAttribute(normal,i)});
      }
      position.setUsage(T.DynamicDrawUsage);normal.setUsage(T.DynamicDrawUsage);
      return {position,normal,vertices};
    });
    const localHip=new T.Matrix4(),deltaPos=V(),deltaNormal=V();
    function bendWaist(){
      localHip.copy(bodyGroup.matrix).invert().multiply(pelvis.matrix);
      belt.position.copy(pelvis.position);belt.quaternion.copy(pelvis.quaternion);
      for(const {position,normal,vertices} of waistMeshes){
        for(const {i,w,p,n} of vertices){
          deltaPos.copy(p).applyMatrix4(localHip).lerp(p,1-w);
          deltaNormal.copy(n).transformDirection(localHip).lerp(n,1-w);
          position.setXYZ(i,deltaPos.x,deltaPos.y,deltaPos.z);
          normal.setXYZ(i,deltaNormal.x,deltaNormal.y,deltaNormal.z);
        }
        position.needsUpdate=normal.needsUpdate=true;
      }
    }
    function solveArm(arm,elbowSet) {
      arm.start.copy(arm.shoulder).applyMatrix4(bodyGroup.matrix);
      arm.end.copy(arm.wrist).applyMatrix4(forkGroup.matrix);
      unit.subVectors(arm.end,arm.start);let d=Math.max(.001,unit.length());
      unit.multiplyScalar(1/d);
      const A=arm.upperLength,B=arm.lowerLength;
      // At full bar lock the reaching scapula advances under the loose sleeve.
      // This retains the forearm's length and the fingers' grip on the outer bar.
      const protraction=Math.max(0,d-(A+B-.004));
      arm.start.addScaledVector(unit,protraction);d-=protraction;
      pole.set(arm.s*(.43+elbowSet),-.61,.59-elbowSet*.45)
        .addScaledVector(unit,-pole.dot(unit)).normalize();
      const dist=Math.min(A+B-.00001,d);
      const run=clamp((A*A-B*B+dist*dist)/(2*dist),0,A);
      arm.bend.copy(arm.start).addScaledVector(unit,run)
        .addScaledVector(pole,Math.sqrt(Math.max(0,A*A-run*run)));
      arm.upperMesh.position.copy(arm.start);arm.lowerMesh.position.copy(arm.bend);
      arm.upperMesh.quaternion.setFromUnitVectors(arm.upperAxis,axis.subVectors(arm.bend,arm.start).normalize());
      arm.lowerMesh.quaternion.setFromUnitVectors(arm.lowerAxis,axis.subVectors(arm.end,arm.bend).normalize());
      return protraction;
    }
    const hipNow=V(),neckNow=V();
    const roll={value:0,rate:0},handle={value:0,rate:0},tailTurn={value:0,rate:0};
    const bodyLoad={value:0,rate:0},groundTilt={value:0,rate:0};
    const shoulderAir={value:0,rate:0},hemAir={value:0,rate:0},sideAir={value:0,rate:0};
    const pressure={value:0,rate:0},shoulderSettle={value:0,rate:0};
    const brakeLoad={value:0,rate:0},balance={value:0,rate:0},capeDrag={value:0,rate:0};
    const headPitch={value:0,rate:0},headRoll={value:0,rate:0};
    const airTuck={value:0,rate:0},landingSettle={value:0,rate:0};
    const footDown={value:0,rate:0},shoeBottom=V(0,-.058,-.042),landing=V(),surfaceNormal=V(),sole=V();
    const groundToBike=new T.Matrix4(),soleRotation=new T.Quaternion();
    let supportSide=-1,wasParked=false,parkX=0,parkZ=0;
    function chooseSupport(){
      const x=root.position.x,z=root.position.z,yaw=root.rotation.y;
      let side=-1;
      const sideX=.35*Math.cos(yaw),sideZ=-.35*Math.sin(yaw);
      if(terrain&&terrain(x+sideX,z+sideZ)>terrain(x-sideX,z-sideZ)+.035)side=1;
      return side;
    }
    function placeSole(leg,amount){
      // The landing point stays still while the bike leans. Use the local
      // surface under the sole so that either a cross slope or a plank works.
      const yaw=root.rotation.y,rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
      const x=root.position.x+supportSide*.34*rightX-.018*rightZ;
      const z=root.position.z+supportSide*.34*rightZ+.018*rightX;
      const floor=terrain?terrain(x,z):root.position.y;
      const probe=.055;
      if(terrain)surfaceNormal.set(terrain(x-probe,z)-terrain(x+probe,z),2*probe,
        terrain(x,z-probe)-terrain(x,z+probe)).normalize();
      else surfaceNormal.copy(up);
      groundToBike.copy(lean.matrixWorld).invert();
      surfaceNormal.transformDirection(groundToBike);
      soleRotation.setFromUnitVectors(up,surfaceNormal);
      landing.set(x,floor,z).applyMatrix4(groundToBike).sub(sole.copy(shoeBottom).applyQuaternion(soleRotation));
      const arc=Math.sin(amount*Math.PI);
      ankle.lerp(landing,amount);ankle.y+=.080*arc;ankle.x+=leg.s*.055*arc;
      leg.shoe.quaternion.slerp(soleRotation,amount);
      sole.copy(shoeBottom).applyQuaternion(leg.shoe.quaternion).add(ankle).applyMatrix4(lean.matrixWorld);
      motion.supportFootGap=sole.y-(terrain?terrain(sole.x,sole.z):root.position.y);
    }
    const motion={cadenceRPM:0,crankAngle:0,wheelAngle:0,bank:0,barTurn:0,
      coasting:true,gripError:0,pedalError:0};
    let phase=.36,spin=0,effort=0,cadence=0,coasting=true,restPhase=phase,wind=0,sprintAmt=0;
    let lastSpeed=0,roadS=0,gaze=0,lastTime=-1,fabricClock=0,outsideFoot=0;
    function update(dt,speed,steer,time,dynamics={}) {
      const v=Math.abs(speed),h=clamp(dt,0,.10),clock=Number.isFinite(time)?time:0;
      if(h===0&&v===0&&clock===0&&lastTime>0){
        phase=.36;spin=cadence=effort=wind=roadS=gaze=lastSpeed=fabricClock=lastRoadPitch=outsideFoot=0;coasting=true;restPhase=phase;
        wasParked=false;
        for(const s of [roll,handle,tailTurn,bodyLoad,groundTilt,pressure,shoulderSettle,footDown,
          shoulderAir,hemAir,sideAir,brakeLoad,balance,capeDrag,headPitch,headRoll,airTuck,landingSettle])s.value=s.rate=0;
      }
      const grade=clamp(dynamics.grade||0,-.6,.6);
      const accel=clamp(Number.isFinite(dynamics.acceleration)?dynamics.acceleration:
        (h>0?(v-lastSpeed)/h:0),-8,7);
      const wanted=clamp(Number.isFinite(dynamics.effort)?dynamics.effort:
        (v>.22?(grade<-.10?.0:.55):0),0,1);
      const airborne=!!dynamics.airborne,fallSpeed=clamp(-(dynamics.verticalSpeed||0)/14,0,1);
      spring(airTuck,airborne?.28+.72*fallSpeed:0,airborne?8.2:6.0,h);
      spring(landingSettle,clamp(dynamics.landingCompression||0,0,1),18,h);
      const parked=!airborne&&!!dynamics.parked&&v<.14;
      if(parked&&!wasParked){supportSide=chooseSupport();parkX=root.position.x;parkZ=root.position.z;}
      if(!parked&&footDown.value>.001&&Math.hypot(root.position.x-parkX,root.position.z-parkZ)>2)
        footDown.value=footDown.rate=0;
      spring(footDown,parked?1:0,parked?7.5:13,h);
      const planted=T.MathUtils.smoothstep(footDown.value,.002,.976);
      wasParked=parked;
      const drive=!airborne&&!parked&&wanted>.04&&(v>.14||wanted>.16),prevCoast=coasting;
      coasting=!drive;
      if(!coasting)outsideFoot=0;
      if(coasting&&!prevCoast)restPhase=Math.floor((phase+.009)/Math.PI)*Math.PI;
      if(coasting&&v>3&&Math.abs(roll.value)>.21&&Math.abs(steer)>.3){
        // Towards the apex the outside foot carries the rider's weight. Keep
        // it there on exit until a new stroke or an opposite corner begins.
        const outer=Math.sign(roll.value);
        if(outer!==outsideFoot){
          outsideFoot=outer;
          const low=outer*Math.PI*.5;
          restPhase=phase+Math.atan2(Math.sin(low-phase),Math.cos(low-phase));
        }
      }
      const sprinting=!!dynamics.sprint&&drive;
      effort=ease(effort,drive?wanted:0,drive?(sprinting?8.0:3.8):4.6,h);
      // Noticeable rapid leg cadence when holding Shift to sprint!
      const rpm=(sprinting?132+22*wanted:52+40*wanted)-clamp(Math.max(0,grade)*60,0,14)+(dynamics.cruise?0:3);
      cadence=ease(cadence,drive?rpm*tau/60:0,drive?(sprinting?8.5:3.6):5.5,h);
      const previousPhase=phase;
      if(drive)phase-=h*cadence*(1+(.043+.12*Math.max(0,grade))*effort*Math.sin(2*phase+.42));
      else if(v>.18){
        phase=ease(phase,restPhase,4.1,h);
        if(Math.abs(phase-restPhase)<.002)phase=restPhase;
      }
      spin-=speed*h/.36;roadS+=v*h;
      const pedalWeight=effort*clamp(cadence/5,0,1);
      const load=-Math.cos(phase-.14)*pedalWeight,stroke=Math.sin(phase-.25)*pedalWeight;
      const turn=clamp(steer,-1,1),speedTurn=clamp(v/5,0,1);
      const barAngle=Number.isFinite(dynamics.barTurn)?clamp(dynamics.barTurn,-.62,.62):turn*(.40/(1+v*.041));
      spring(handle,barAngle,12,h);
      const bank=clamp(Math.atan(turn*10.2/9.81),-.62,.62)*speedTurn;
      // Spirited bike-under-body counter-rock when pedaling hard, climbing, or sprinting!
      const climbHint=T.MathUtils.smoothstep(grade,.035,.32)*effort;
      const bikeRock=-.046*load*(.28+.85*(sprinting?1:0)+.52*climbHint);
      spring(roll,bank+bikeRock-supportSide*.104*planted,8.8,h);
      spring(tailTurn,turn*speedTurn*1.35+clamp(roll.rate*1.65,-.65,.65),3.4,h);
      spring(bodyLoad,clamp(accel*.08+grade*.6,-.37,.36),5.4,h);
      const braking=dynamics.braking===undefined?clamp((-accel-1.55)/5,0,1):Number(!!dynamics.braking);
      spring(brakeLoad,braking*clamp(v/3,0,1),braking?7.6:4.7,h);
      spring(balance,turn*speedTurn+clamp(roll.rate*.35,-.20,.20),6.1,h);
      const land=scope.RideLand,x=root.position.x,z=root.position.z;
      const gust=Number.isFinite(dynamics.gust)?clamp(dynamics.gust,0,1):
        (land?.windAt?land.windAt(x,z,clock):.38+.28*Math.sin(.54*clock+x*.06));
      const crossWind=Number.isFinite(dynamics.crosswind)?clamp(dynamics.crosswind,-1,1):
        .868*Math.cos(root.rotation.y)+.497*Math.sin(root.rotation.y);
      const tailWind=Number.isFinite(dynamics.tailwind)?clamp(dynamics.tailwind,-1,1):0;
      const airSpeed=Math.max(0,v-tailWind*(1.0+gust*3.4));
      wind=ease(wind,Math.min(1.16,airSpeed/16),3.2,h);
      const airTarget=.055+.18*gust+.82*wind+.10*airTuck.value;
      spring(shoulderAir,airTarget,8.5,h);spring(hemAir,shoulderAir.value,5.5,h);
      spring(sideAir,crossWind*(.27+.73*gust),5.1,h);
      spring(capeDrag,clamp(.075*accel-.45*brakeLoad.value,-.8,.45),4.5,h);
      const clothStep=h||clamp(clock-Math.max(0,lastTime),0,.06);
      fabricClock+=clothStep*(1.95+.67*wind+.33*gust);
      const blossomOcclusion=scope.RideOrchard?.shadeAt?.(x,z)||0;
      sunVisibility.value=1-.93*Math.max(dynamics.archShade||0,.60*blossomOcclusion);
      lean.rotation.set(0,0,roll.value,"YXZ");
      forkGroup.quaternion.setFromAxisAngle(forkAxis,handle.value);
      transformAt(forkGroup,headBase,headBase);
      placeWheels(airborne?null:terrain);
      const pitchRate=h>0&&lastTime>0?clamp((roadPitch-lastRoadPitch)/h,-1.5,1.5):0;
      spring(groundTilt,pitchRate,11,h);lastRoadPitch=roadPitch;
      const road=(.62*Math.sin(roadS*1.19)+.38*Math.sin(roadS*.69+1))*Math.min(v*.14,1);
      spring(pressure,load,15,h);
      const hillResponse=clamp(groundTilt.value*.15,-.12,.12);
      spring(shoulderSettle,.17*bodyLoad.value+hillResponse+.012*road,8.6,h);
      const breath=Math.sin(clock*tau/[3.8,4.2,3.5][characterIndex])*(.65+.35*effort);
      const touring=bikeIndex===1?1:bikeIndex===2?.33:0;
      const idleSurvey=(1-T.MathUtils.smoothstep(v,.15,3.5))*(1-effort)*Math.sin(clock*.67+.21*Math.sin(clock*.46));
      const climbing=T.MathUtils.smoothstep(grade,.035,.32)*effort;
      const dropping=T.MathUtils.smoothstep(-grade,.045,.34)*speedTurn;
      sprintAmt=ease(sprintAmt,sprinting?1:0,7.5,h);
      const sprintBlend=sprintAmt;
      const weight=pressure.value*(1+.44*climbing+.95*sprintBlend);
      // The pelvis stays on the saddle. As the cycle gathers speed the rider
      // hinges at the hip and looks up the meadow, keeping both palms planted.
      const roadReach=clamp((v-1)/10,0,1);
      // Pedal pressure is transmitted through the opposite shoulder. Head and
      // pelvis retain most of their stability while the elbows absorb the load.
      hipNow.set(.018*weight-.019*roll.value,hub.y+.008*pedalWeight*Math.sin(2*phase-.4)
        +.017*climbing+.042*sprintBlend-.022*brakeLoad.value-.010*dropping+.0025*road+.038*airTuck.value-.043*landingSettle.value,
        hub.z-.027*roadReach-.026*climbing-.032*sprintBlend+.063*brakeLoad.value+.025*dropping+.008*stroke+.026*airTuck.value);
      // Slip forward of the saddle before extending the support leg.
      hipNow.x+=supportSide*.052*planted;hipNow.y-=.158*planted;hipNow.z-=.210*planted;
      pelvis.rotation.set(-.035-.073*climbing-.055*sprintBlend+.054*brakeLoad.value,
        -.045*stroke,.055*weight-.055*roll.value,"YXZ");
      transformAt(pelvis,hub,hipNow);
      bodyGroup.rotation.order="YXZ";
      bodyGroup.rotation.set(-.070+.095*touring-.197*roadReach-.069*effort-.105*climbing-.135*sprintBlend-.078*dropping
        +.124*brakeLoad.value+shoulderSettle.value-.022*stroke-.007*breath-.067*airTuck.value-.100*landingSettle.value,
        .079*stroke+balance.value*.053,-.095*weight-.20*roll.value,"YXZ");
      transformAt(bodyGroup,hub,hipNow);
      bendWaist();
      gaze=ease(gaze,turn*(.20+.16*speedTurn)+.095*idleSurvey,3.9,h);
      spring(headPitch,-bodyGroup.rotation.x*.71-.52*roadPitch-.066*groundTilt.value,12,h);
      spring(headRoll,-bodyGroup.rotation.z*.74-roll.value*.45,11,h);
      headGroup.rotation.set(headPitch.value+.006*breath,
        gaze-bodyGroup.rotation.y*.67,headRoll.value,"YXZ");
      neckNow.copy(neck);
      neckNow.z-=roadReach*.036;neckNow.y+=roadReach*.021;
      transformAt(headGroup,neck,neckNow);
      motion.gripError=motion.shoulderReach=0;
      for(const arm of armRig){
        const reach=solveArm(arm,.13*brakeLoad.value+.060*climbing+.056*arm.s*weight+.10*landingSettle.value);
        motion.shoulderReach=Math.max(motion.shoulderReach,reach);
        target.copy(arm.lowerAxis).multiplyScalar(arm.lowerLength)
          .applyQuaternion(arm.lowerMesh.quaternion).add(arm.bend);
        motion.gripError=Math.max(motion.gripError,target.distanceTo(arm.end));
      }
      lastSpeed=v;lastTime=clock;
      wheels[0].rotation.x=spin;wheels[1].rotation.x=spin;
      const blur=Math.min(1,Math.max(0,(v-1.2)/11.5));
      spokeMaterial.uniforms.blur.value=blur*blur*(3-2*blur);
      motionInk.uniforms.strength.value=blur;motionInk.uniforms.clock.value=time||0;
      rearStreaks.visible=frontStreaks.visible=blur>.012;
      motion.pedalError=motion.legOverreach=0;
      motion.supportSide=planted>.001?supportSide:0;motion.footDown=planted;motion.supportFootGap=null;
      for(const leg of legs) {
        const a=phase+(leg.s>0?0:Math.PI);
        leg.arm.rotation.x=a;
        const pedalY=.34-.161*Math.sin(a),pedalZ=.06+.161*Math.cos(a);
        const pitch=-.10+(.050+.15*pedalWeight+.027*climbing)*Math.sin(a+.56)
          -.032*climbing+.026*brakeLoad.value;
        const soleY=-.052,soleZ=-.065;
        ankle.set(leg.s*.103,pedalY+.011-soleY*Math.cos(pitch)+soleZ*Math.sin(pitch),
          pedalZ-soleY*Math.sin(pitch)-soleZ*Math.cos(pitch));
        leg.shoe.rotation.set(pitch,0,0);leg.pedal.position.set(leg.s*.103,pedalY,pedalZ);
        const supporting=leg.s===supportSide&&planted>.0001;
        if(supporting)placeSole(leg,planted);
        leg.shoe.position.copy(ankle);
        target.set(0,soleY,soleZ).applyQuaternion(leg.shoe.quaternion).add(ankle);
        target.y-=.011;
        if(!supporting)motion.pedalError=Math.max(motion.pedalError,target.distanceTo(leg.pedal.position));
        leg.hip.copy(leg.neutralHip).applyMatrix4(pelvis.matrix);
        unit.subVectors(ankle,leg.hip);
        const d=unit.length();unit.multiplyScalar(1/d);
        // Two-link IK in the plane defined by the hip, ankle and forward knee direction.
        forwardKnee.set(leg.s*.10,0,-1);
        forwardKnee.addScaledVector(unit,-forwardKnee.dot(unit)).normalize();
        const femur=.426,tibia=.429;
        motion.legOverreach=Math.max(motion.legOverreach,d-femur-tibia);
        const along=Math.min(femur,(femur*femur-tibia*tibia+d*d)/(2*d));
        knee.copy(leg.hip).addScaledVector(unit,along)
          .addScaledVector(forwardKnee,Math.sqrt(Math.max(0,femur*femur-along*along)));
        leg.knee.copy(knee);leg.animateCloth(leg.hip,leg.knee,ankle);
      }
      cloth(fabricClock/2.1,shoulderAir.value,tailTurn.value,hemAir.value,sideAir.value,gust,capeDrag.value,roadPitch,planted,airTuck.value,h,v);
      updateHatRibbons(fabricClock/2.1,v,tailTurn.value,gust);
      updateShadow(time || 0,dynamics);
      motion.cadenceRPM=h>0?(previousPhase-phase)*60/(h*tau):0;
      motion.coasting=coasting;motion.crankAngle=phase;motion.wheelAngle=spin;
      motion.bank=roll.value;motion.barTurn=handle.value;
      motion.gust=gust;motion.clothLift=hemAir.value;motion.sunVisibility=sunVisibility.value;
      motion.frontTireGap=frontGap;motion.rearTireGap=rearGap;
      motion.brakeLoad=brakeLoad.value;motion.climbLoad=climbing;
      motion.look=looks[lookIndex].id;motion.airTuck=airTuck.value;motion.landingCompression=landingSettle.value;
    }
    unitBall.dispose();unitRod.dispose();
    update(0,0,0,0);
    const setSunVisibility=v=>{sunVisibility.value=Math.max(.12,Math.min(1,v));};
    return {root,update,motion,axles,looks,setLook,cycleLook,characters,bikes,setCharacter,setBike,setSunVisibility,
      get look(){return looks[lookIndex];},get character(){return characters[characterIndex];},get bike(){return bikes[bikeIndex];}};
  }
  scope.RideRider={create};
})(typeof globalThis!=="undefined"?globalThis:window);
