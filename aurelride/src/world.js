/* All coordinates are metres; north is -Z. Water depth is positive below its surface. */
(() => {
  'use strict';
  const bounds={minX:-1900,maxX:1020,minZ:-1820,maxZ:1220};
  const {sin,cos,abs,min,max,hypot}=Math;
  function smooth(a,b,v){
    const t=max(0,min(1,(v-a)/(b-a)));
    return t*t*(3-2*t);
  }
  const mix=(a,b,t)=>a+(b-a)*t;
  const riverX=z=>-650+86*sin(z*.0022+.52)+38*sin(z*.0048-.36);
  function river(z){
    const fordWeight=1-smooth(10,41,min(abs(z+645),abs(z-335)));
    return {
      x:riverX(z),
      halfWidth:mix(21+3.7*sin(z*.0037+.83)+1.6*sin(z*.0091-.2),12.5,fordWeight),
      y:-8.8+z*.0022+.32*sin(z*.0016),
      fordWeight
    };
  }
  function depthAt(offset,channel,z){
    return mix(2.35+.32*sin(z*.0064-.9),.105,channel.fordWeight)
      *(1-smooth(.07,1,abs(offset)/channel.halfWidth));
  }
  function waterDepth(x,z){
    if(x< -810||x> -490)return 0;
    const channel=river(z);
    return depthAt(x-channel.x,channel,z);
  }
  function canRide(x,z,margin=0){
    if(x<bounds.minX+margin||x>bounds.maxX-margin||z<bounds.minZ+margin||z>bounds.maxZ-margin)return false;
    return true;
  }
  function meadowWeight(x,z){
    const bowl=hypot((x+342)/365,(z-308)/448);
    const shelf=hypot((x+411)/155,(z+135)/504);
    const opens=max(smooth(282,390,-x),smooth(135,265,z));
    return opens*(1-smooth(.64,1.13,min(bowl,shelf)));
  }
  function plateauWeight(x,z){
    const east=smooth(80,404,riverX(z)-x);
    return east*smooth(-1600,-830,z)*(1-smooth(180,970,z));
  }
  const captions={city:'白城草原',flowers:'繁花原野',river:'银湾河谷',plateau:'长风高台'};
  function zones(x,z){
    if(x>=-282&&z<=135)return {city:1,flowers:0,river:0,plateau:0,id:'city',name:captions.city};
    const dx=x-riverX(z);
    const riverbank=1-smooth(43,164,abs(dx));
    const plateau=(1-riverbank)*plateauWeight(x,z);
    const flowers=(1-riverbank-plateau)*meadowWeight(x,z);
    const city=max(0,1-riverbank-plateau-flowers);
    // The quiet approaches to each landmark belong to the same area as its
    // summit or flower beds, even while the base green still dominates.
    let id='city';
    if(riverbank>=.46)id='river';
    else if(dx<0)id='plateau';
    else if(flowers>=.35||(x< -280&&z> -630&&z<910))id='flowers';
    return {city,flowers,river:riverbank,plateau,id,name:captions[id]};
  }
  function relief(x,z){
    // The northern meadow follows the base ridge. The flower terraces begin to the south.
    if(x>=-282&&z<=135)return 0;
    const meadow=meadowWeight(x,z);
    let extra=meadow*(3.2+3.0*sin(x*.009+z*.0043)+2.5*sin(z*.013-x*.0028));
    if(z>430&&x> -410&&x<260){
      const shelf=smooth(430,544,z)*(1-smooth(883,1010,z))*smooth(-410,-274,x)*(1-smooth(162,260,x));
      extra+=shelf*(11+7.8*cos((z-655)*.022+x*.0035)+4.2*sin(x*.021-z*.005));
    }
    extra+=smooth(1470,1840,-x)*(15+8*sin(z*.0061-.8)+6*cos(z*.0104+x*.003));
    extra+=smooth(817,1180,z)*(12+7*cos(x*.0057+z*.002)+5*sin(x*.0122));
    if(x> -367)return extra;
    const dx=x-riverX(z),western=-dx;
    if(western>65){
      const lengthwise=smooth(-1600,-830,z)*(1-smooth(180,970,z));
      const climb=smooth(65,504,western);
      const high=smooth(238,428,western);
      const crown=1-smooth(.04,1,hypot((x+1355)/340,(z+633)/530));
      const tiltedShelf=5.0*sin(z*.0052+.55)+3.6*sin(x*.0073-z*.0021);
      extra+=lengthwise*(climb*67+high*(9+tiltedShelf)+crown*24);
    }
    if(abs(dx)>=143)return extra;
    const channel=river(z),bank=max(0,abs(dx)-channel.halfWidth);
    const bed=channel.y-depthAt(dx,channel,z)+2.9*smooth(0,27,bank)+3.3*smooth(15,65,bank);
    // In the western valley the original land consists of these four soft
    // undulations. Blend their *absolute height* into the channel so the CPU
    // wheel contact, visible bank and waterline meet at precisely the same X.
    const valley=2.6*sin(z*.015+x*.008)+1.8*sin(x*.026-z*.01)
      +1.15*cos(z*.03+x*.019)+.50*sin(x*.052+z*.036)-1.15;
    return mix(bed-valley,extra,smooth(74,143,abs(dx)));
  }

  // Kept alongside the CPU expressions. vec4 components are shared by terrain,
  // flower, grass and water shaders. No textures or physics queries are needed.
  const terrainGLSL=`
    float worldRiverX(float z){return -650.+86.*sin(z*.0022+.52)+38.*sin(z*.0048-.36);}
    vec4 worldChannel(vec2 p){
      float f=1.-smoothstep(10.,41.,min(abs(p.y+645.),abs(p.y-335.)));
      float w=mix(21.+3.7*sin(p.y*.0037+.83)+1.6*sin(p.y*.0091-.2),12.5,f);
      return vec4(p.x-worldRiverX(p.y),w,-8.8+p.y*.0022+.32*sin(p.y*.0016),f);
    }
    float worldDepth(vec4 channel,float z){
      return mix(2.35+.32*sin(z*.0064-.9),.105,channel.w)
        *(1.-smoothstep(.07,1.,abs(channel.x)/channel.y));
    }
    float worldMeadowWeight(vec2 p){
      float bowl=length((p-vec2(-342.,308.))/vec2(365.,448.));
      float shelf=length((p-vec2(-411.,-135.))/vec2(155.,504.));
      return max(smoothstep(282.,390.,-p.x),smoothstep(135.,265.,p.y))
        *(1.-smoothstep(.64,1.13,min(bowl,shelf)));
    }
    vec4 worldBiomes(vec2 p){
      if(p.x>=-282.&&p.y<=135.)return vec4(1.,0.,0.,0.);
      float dx=p.x-worldRiverX(p.y),riverbank=1.-smoothstep(43.,164.,abs(dx));
      float plateau=(1.-riverbank)*smoothstep(80.,404.,-dx)
        *smoothstep(-1600.,-830.,p.y)*(1.-smoothstep(180.,970.,p.y));
      float flowers=(1.-riverbank-plateau)*worldMeadowWeight(p);
      return vec4(max(0.,1.-riverbank-plateau-flowers),flowers,riverbank,plateau);
    }
    float worldRelief(vec2 p){
      if(p.x>=-282.&&p.y<=135.)return 0.;
      float extra=worldMeadowWeight(p)*(3.2+3.*sin(p.x*.009+p.y*.0043)+2.5*sin(p.y*.013-p.x*.0028));
      if(p.y>430.&&p.x> -410.&&p.x<260.){
        float shelf=smoothstep(430.,544.,p.y)*(1.-smoothstep(883.,1010.,p.y))*smoothstep(-410.,-274.,p.x)*(1.-smoothstep(162.,260.,p.x));
        extra+=shelf*(11.+7.8*cos((p.y-655.)*.022+p.x*.0035)+4.2*sin(p.x*.021-p.y*.005));
      }
      extra+=smoothstep(1470.,1840.,-p.x)*(15.+8.*sin(p.y*.0061-.8)+6.*cos(p.y*.0104+p.x*.003));
      extra+=smoothstep(817.,1180.,p.y)*(12.+7.*cos(p.x*.0057+p.y*.002)+5.*sin(p.x*.0122));
      if(p.x> -367.)return extra;
      float dx=p.x-worldRiverX(p.y),western=-dx;
      if(western>65.){
        float longitudinal=smoothstep(-1600.,-830.,p.y)*(1.-smoothstep(180.,970.,p.y));
        float crown=1.-smoothstep(.04,1.,length((p-vec2(-1355.,-633.))/vec2(340.,530.)));
        float tilted=5.*sin(p.y*.0052+.55)+3.6*sin(p.x*.0073-p.y*.0021);
        extra+=longitudinal*(smoothstep(65.,504.,western)*67.+smoothstep(238.,428.,western)*(9.+tilted)+crown*24.);
      }
      if(abs(dx)>=143.)return extra;
      vec4 c=worldChannel(p);
      float bank=max(0.,abs(dx)-c.y);
      float bed=c.z-worldDepth(c,p.y)+2.9*smoothstep(0.,27.,bank)+3.3*smoothstep(15.,65.,bank);
      float valley=2.6*sin(p.y*.015+p.x*.008)+1.8*sin(p.x*.026-p.y*.01)
        +1.15*cos(p.y*.03+p.x*.019)+.50*sin(p.x*.052+p.y*.036)-1.15;
      return mix(bed-valley,extra,smoothstep(74.,143.,abs(dx)));
    }
  `;

  const bank=(z,offset)=>[riverX(z)+offset,z];
  const city=[
    [0,0],[2.3,-46],[5.5,-73],[21,-103],[23,-138],[15,-168],[31,-241],[49,-342],[43,-394],
    [20,-493],[18,-569],[-4,-695],[2,-823],[15,-907],[15,-938],[-20,-969],[-99,-947],
    [-196,-869],[-250,-699],[-248,-448],[-213,-247],[-149,-65],[-87,67],[-29,81],[-6,52]
  ];
  const flowers=[
    [-315,330],[-352,365],[-411,388],[-455,373],[-474,328],[-452,259],[-417,186],[-428,120],
    [-408,66],[-347,42],[-273,76],[-238,138],[-227,212],[-246,268],[-282,301]
  ];
  function crossing(z,westbound){
    const offsets=westbound?[62,32,0,-32,-62]:[-62,-32,0,32,62];
    return offsets.map(offset=>bank(z,offset));
  }
  const shore=(z,inland,side=1)=>bank(z,side*(river(z).halfWidth+inland));
  const riverRoute=[
    shore(-336,6),shore(-279,7),shore(-205,6),shore(-122,10),shore(5,12),bank(90,70),shore(154,9),bank(266,64),
    ...crossing(335,true),bank(277,-64),shore(180,14,-1),bank(128,-73),bank(85,-83),bank(40,-76),
    shore(-22,12,-1),shore(-112,8,-1),shore(-205,6,-1),
    shore(-342,10,-1),shore(-455,12,-1),bank(-514,-78),bank(-569,-64),...crossing(-645,false),bank(-576,64),shore(-439,9)
  ];
  const plateau=[
    [-1240,-198],[-1341,-184],[-1424,-240],[-1485,-349],[-1493,-472],[-1470,-575],
    [-1429,-642],[-1360,-655],[-1298,-642],[-1239,-610],[-1198,-550],[-1176,-469],
    [-1154,-365],[-1168,-270]
  ];
  const grand=[
    ...city.slice(0,18),[-273,-760],[-325,-595],[-363,-437],[-359,-272],[-327,-105],
    [-310,60],[-322,178],[-315,281],[-340,329],[-406,346],bank(335,105),...crossing(335,true),
    bank(291,-124),[-820,226],[-880,130],[-970,64],[-1089,-28],[-1154,-176],[-1240,-319],
    [-1330,-485],[-1360,-608],[-1341,-662],[-1252,-686],[-1158,-733],[-1047,-790],
    [-967,-803],[-882,-758],bank(-677,-107),...crossing(-645,false),bank(-556,80),bank(-426,72),
    bank(-336,74),bank(-205,74),bank(-100,86),[-431,-64],[-336,-78],[-228,-96],[-151,-54],
    [-91,33],[-38,65],[-6,52]
  ];
  const routes=[
    {id:'city',name:'向阳草甸环线',points:city},
    {id:'flowers',name:'樱花林环线',points:flowers},
    {id:'river',name:'银湾两岸环线',points:riverRoute},
    {id:'plateau',name:'长风高台环线',points:plateau},
    {id:'grand',name:'原野与河谷长线',points:grand}
  ];
  const landmarks=routes.slice(0,4).map(route=>{
    const [[x,z],[nx,nz]]=route.points;
    return {id:route.id,name:route.id==='flowers'?'樱花林':captions[route.id],x,z,heading:Math.atan2(nx-x,z-nz)};
  });
  globalThis.RideWorld={bounds,relief,terrainGLSL,zones,river,waterDepth,canRide,routes,landmarks};
})();
