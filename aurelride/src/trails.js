/* Shared survey of the creek crossing. X increases east and -Z is north; metres. */
(() => {
  'use strict';
  const T=globalThis.THREE,world=globalThis.RideWorld,channel=world.river(-405);
  const bridge={x:channel.x,z:-405,halfLength:26,halfWidth:2.30,railStart:23.6,railLateral:2.16,railRadius:.073};
  const along=s=>[bridge.x+s,bridge.z];
  const bank=(z,s)=>[world.river(z).x+s,z];
  const cityFork={id:'city-fork',x:25.65,z:-219,heading:.259};
  // The first and last knots share the straight approach. The signed X span
  // remains collinear through both portals, even in the closed guided spline.
  const bridgeApproach=[along(90),along(58),along(38),along(26)];
  const crossing=[along(0),along(-26)];
  const west=[along(-47),[-784,-410],[-799,-428],[-805,-462],[-800,-504],
    [-801,-554],[-796,-596],[-784,-624],bank(-642,-62),bank(-645,-42),bank(-645,-26)];
  const ford=[bank(-645,-10),bank(-645,10),bank(-645,26)];
  const home=[bank(-645,48),bank(-645,78),[-584,-662],[-516,-648],[-449,-611],
    [-377,-590],[-299,-553],[-223,-498],[-182,-426],[-164,-340],[-139,-260],
    [-109,-193],[-84,-151],[-56,-125],[-28,-119],[-4,-132],[10,-150],
    [15.05,-168],[17.92,-190],[20.42,-200], [cityFork.x,cityFork.z]];
  const outward=[[28.3,-237],[23.0,-261],[7,-283],[-18,-298],[-54,-307],
    [-107,-313],[-164,-334],[-231,-361],[-302,-373],[-369,-379],[-427,-394],
    [-486,-414],[-541,-418],[-580,-408]];
  const points=[...bridgeApproach,...crossing,...west,...ford,...home,...outward];
  const route={id:'mill',name:'溪桥河岸环线',points};
  const landmark={id:'mill',name:'溪桥河岸',x:points[0][0],z:points[0][1],heading:-Math.PI/2};
  const junctions=[cityFork,{id:'east-bank',x:channel.x+29,z:-405,heading:-Math.PI/2},
    {id:'west-bank',x:channel.x-31,z:-405,heading:-Math.PI/2},
    {id:'north-ford',x:world.river(-645).x+48,z:-645,heading:Math.PI/2}];
  const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal');
  curve.arcLengthDivisions=points.length*70;
  const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  const paths=[],grid=new Map(),cellSize=12;
  const key=(i,j)=>i+2048*j;
  const temp=new T.Vector3();
  function indexSegment(a,b,road,at){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.00001)return 0;
    const edge=road.width*.5+1.25;
    const minX=Math.min(a[0],b[0])-edge,maxX=Math.max(a[0],b[0])+edge;
    const minZ=Math.min(a[1],b[1])-edge,maxZ=Math.max(a[1],b[1])+edge;
    bounds.minX=Math.min(bounds.minX,minX);bounds.maxX=Math.max(bounds.maxX,maxX);
    bounds.minZ=Math.min(bounds.minZ,minZ);bounds.maxZ=Math.max(bounds.maxZ,maxZ);
    // The timber and ford supply their own ground surface.
    if(road.surface==='timber'||road.surface==='ford')return len;
    const seg={x:a[0],z:a[1],dx,dz,len,at,r:road.width*.5,surface:road.surface};
    for(let j=Math.floor(minZ/cellSize);j<=Math.floor(maxZ/cellSize);j++){
      for(let i=Math.floor(minX/cellSize);i<=Math.floor(maxX/cellSize);i++){
        const k=key(i,j);
        if(!grid.has(k))grid.set(k,[]);
        grid.get(k).push(seg);
      }
    }
    return len;
  }
  function addRoad(id,surface,width,begin,end){
    const samples=[],knots=[];
    for(let i=begin;i<end;i++){
      const a=points[i%points.length],b=points[(i+1)%points.length];knots.push(a);
      const n=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.38));
      for(let k=0;k<n;k++){
        curve.getPoint(((i+k/n)%points.length)/points.length,temp);
        samples.push([temp.x,temp.z]);
      }
    }
    const last=points[end%points.length];knots.push(last);samples.push(last);
    const road={id,surface,width,closed:false,points:knots,samples};
    let station=0;
    for(let i=1;i<samples.length;i++)station+=indexSegment(samples[i-1],samples[i],road,station);
    road.length=station;paths.push(road);
  }
  const bridgeEast=bridgeApproach.length-1, bridgeWest=bridgeEast+crossing.length;
  const fordWest=bridgeWest+west.length,fordEast=fordWest+ford.length;
  const fork=fordEast+home.length;
  addRoad('mill-yard','gravel',4.1,0,bridgeEast);
  addRoad('creek-bridge','timber',2*bridge.halfWidth,bridgeEast,bridgeWest);
  // The +/-10 m knots are just inside the 25 m wet crossing. Continue the
  // tracks to them so they fade into the actual bank on either approach.
  addRoad('towpath','earth',3.55,bridgeWest,fordWest+1);
  addRoad('old-ford','ford',3.9,fordWest+1,fordEast-1);
  addRoad('valley-road','earth',3.6,fordEast-1,fork-3);
  // The old city line is grass as it passes the notch where the branch begins.
  addRoad('city-mill','earth',4.05,fork,points.length-4);
  addRoad('mill-approach','gravel',4.1,points.length-4,points.length);
  for(const name of Object.keys(bounds))bounds[name]=name.startsWith('min')?Math.floor(bounds[name]):Math.ceil(bounds[name]);

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function smooth(a,b,n){const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);}
  function soilAt(x,z,terrainHeight){
    return typeof terrainHeight==='number'?terrainHeight:(terrainHeight||globalThis.RideLand.height)(x,z);
  }
  function deckY(s,lateral,terrainHeight){
    const x=bridge.x+s,z=bridge.z+lateral,soil=soilAt(x,z,terrainHeight),d=Math.abs(s);
    if(d>=bridge.halfLength)return soil;
    // A cambered timber frame rises gently from both sills. Only the last
    // boards sit directly on the irregular bank; their outer corners follow it.
    const relative=d/bridge.halfLength;
    const crown=channel.y+2.40-.995*(1-Math.cos(Math.PI*relative));
    const camber=.014*Math.pow(Math.min(1,Math.abs(lateral)/bridge.halfWidth),2);
    const landBlend=smooth(22.8,bridge.halfLength,d);
    return crown-camber+(soil-crown+camber)*landBlend;
  }
  bridge.at=(s,lateral=0,terrainHeight)=>({x:bridge.x+s,y:deckY(s,lateral,terrainHeight),z:bridge.z+lateral});
  function isDeck(x,z,radius=0){
    return Math.abs(x-bridge.x)<=bridge.halfLength-radius&&Math.abs(z-bridge.z)<=bridge.halfWidth-radius;
  }
  function rideHeight(x,z,terrainHeight){
    if(!isDeck(x,z))return soilAt(x,z,terrainHeight);
    return deckY(x-bridge.x,z-bridge.z,terrainHeight);
  }
  function touchesRail(x,z,r){
    return Math.abs(x-bridge.x)<=bridge.railStart+r&&Math.abs(Math.abs(z-bridge.z)-bridge.railLateral)<=bridge.railRadius+r;
  }
  function canRide(x,z,radius=.6){
    if(touchesRail(x,z,radius))return false;
    return isDeck(x,z,radius)||world.canRide(x,z,radius);
  }
  function crossesRail(x,z,dx,dz,y,r){
    let lo=0,hi=1;
    for(const [origin,delta,extent] of [[x,dx,bridge.railStart+r],[z-y,dz,bridge.railRadius+r]]){
      if(Math.abs(delta)<.0000001){if(Math.abs(origin)>extent)return false;continue;}
      const a=(-extent-origin)/delta,b=(extent-origin)/delta;
      lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      if(lo>hi)return false;
    }
    return true;
  }
  function canRideFrom(x0,z0,x1,z1,radius=.6){
    if(!canRide(x1,z1,radius))return false;
    const s0=x0-bridge.x,s1=x1-bridge.x,l0=z0-bridge.z,l1=z1-bridge.z;
    const reach=bridge.railStart+radius,side=bridge.railLateral+bridge.railRadius+radius;
    if(Math.max(s0,s1)<-reach||Math.min(s0,s1)>reach||Math.max(l0,l1)<-side||Math.min(l0,l1)>side)return true;
    const dx=s1-s0,dz=l1-l0;
    return !crossesRail(s0,l0,dx,dz,bridge.railLateral,radius)&&!crossesRail(s0,l0,dx,dz,-bridge.railLateral,radius);
  }
  const grass={material:'grass',weight:0,station:0};
  function surfaceAt(x,z){
    if(isDeck(x,z))return {material:'timber',weight:1,station:x-bridge.x};
    const cherryPath=globalThis.RideOrchard?.surfaceAt(x,z);
    if(cherryPath)return cherryPath;
    if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)return grass;
    if(world.waterDepth(x,z)>0)return grass;
    const segments=grid.get(key(Math.floor(x/cellSize),Math.floor(z/cellSize)));
    if(!segments)return grass;
    let blend=0,station=0,best=null;
    for(const s of segments){
      const fx=x-s.x,fz=z-s.z,f=clamp((fx*s.dx+fz*s.dz)/(s.len*s.len),0,1);
      const d=Math.hypot(fx-f*s.dx,fz-f*s.dz),w=1-smooth(s.r-.52,s.r+.52,d);
      if(w>blend){blend=w;station=s.at+f*s.len;best=s;}
    }
    return best?{material:best.surface,weight:blend,station}:grass;
  }
  globalThis.RideTrails={bridge,route,landmark,junctions,cityFork,paths,bounds,isDeck,rideHeight,canRide,canRideFrom,surfaceAt};
})();
