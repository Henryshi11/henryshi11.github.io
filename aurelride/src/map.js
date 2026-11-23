/* The map samples the same height field, shorelines and riding splines as the game. */
globalThis.RideMap = function(world,height,paths,places) {
  'use strict';
  places=places||world.landmarks;
  const get=id=>document.getElementById(id);
  const dialog=get('world-map'), canvas=get('map-paper'), pins=get('map-pins');
  const {minX,maxX,minZ,maxZ}=world.bounds;
  const horizontal=x=>(x-minX)/(maxX-minX);
  const vertical=z=>(z-minZ)/(maxZ-minZ);
  const descriptions={
    city:'从草坡上可以望见北面的白城巨拱。向东转，雪峰在草甸另一头升起。',
    flowers:'从樱花树下出发，沿落满花瓣的小路穿林，也可以骑进林间空地。',
    river:'沿银湾两岸骑行，在浅滩涉水过河。',
    plateau:'沿高台环行。向西南望，层层瀑布从远处的白色崖台落下。',
    mill:'从东岸碎石路出发，过木桥，沿溪骑到旧渡口。',
    skybridge:'沿大坡骑上白石拱桥，冲出断口落回草地，沿河岸绕回。',
    vale:'穿过银紫色的薰衣草与长草，沿河岸绕行。',
    bloom:'穿过金黄的油菜花田，越过山脊，沿层层紫色花丘绕回。'
  };
  const palette=[[195,213,161],[202,211,151],[132,188,145],[220,199,139]];
  const goldInk=[237,199,83],cherryInk=[235,173,193],lavenderInk=[163,139,181],grassInk=[220,190,122],riverInk=[77,155,169];
  let base,selected=places[0],returnFocus;
  const buttons=new Map();
  const labels=[];
  function layoutPins(){
    const width=pins.clientWidth,height=pins.clientHeight;
    if(!width||!height)return;
    const occupied=[];
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const directions=[[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[1,0],[-1,0]];
    for(const label of labels){
      const {button,line,dot,px,py}=label,x=px*width,y=py*height;
      const w=button.offsetWidth,h=button.offsetHeight;
      let best=null;
      for(const gap of [4,13,25,39,58,78])for(const [dx,dy] of directions){
        const left=clamp(x-w/2+dx*(gap+w/2),3,width-w-3);
        const top=clamp(y-h/2+dy*(gap+h/2),3,height-h-3);
        const endX=clamp(x,left,left+w),endY=clamp(y,top,top+h);
        let cost=(x-endX)**2+(y-endY)**2;
        for(const r of occupied){
          const ox=Math.min(left+w+3,r.x+r.w)-Math.max(left-3,r.x);
          const oy=Math.min(top+h+3,r.y+r.h)-Math.max(top-3,r.y);
          if(ox>0&&oy>0)cost+=10000+100*ox*oy;
        }
        for(const a of labels){
          const ax=a.px*width,ay=a.py*height;
          if(ax>left-2&&ax<left+w+2&&ay>top-2&&ay<top+h+2)cost+=700;
        }
        if(!best||cost<best.cost)best={left,top,endX,endY,cost};
      }
      occupied.push({x:best.left,y:best.top,w,h});
      button.style.left=best.left+'px';button.style.top=best.top+'px';
      dot.style.left=line.style.left=x+'px';dot.style.top=line.style.top=y+'px';
      line.style.width=Math.hypot(best.endX-x,best.endY-y)+'px';
      line.style.transform='rotate('+Math.atan2(best.endY-y,best.endX-x)+'rad)';
    }
  }
  function reliefMap(){
    const w=610,h=480, paper=document.createElement('canvas');
    paper.width=w;paper.height=h;
    const ctx=paper.getContext('2d'), pixels=ctx.createImageData(w,h);
    const elevations=new Float32Array(w*h);
    const dx=(maxX-minX)/w,dz=(maxZ-minZ)/h;
    for(let j=0;j<h;j++){
      const z=minZ+(j+.5)*dz,channel=world.river(z);
      for(let i=0;i<w;i++){
        const x=minX+(i+.5)*dx,k=j*w+i,elevation=height(x,z),b=world.zones(x,z);
        elevations[k]=elevation;
        const slope=i&&j?(elevation-elevations[k-1])/dx*.56+(elevation-elevations[k-w])/dz*.58:0;
        const contour=Math.min(1,Math.abs(elevation/10-Math.round(elevation/10))*9);
        const shade=Math.max(.63,Math.min(1.24,1+slope*.71))*(.96+.04*contour);
        const water=Math.abs(x-channel.x)<channel.halfWidth;
        const field=RideWildfields.sample(x,z);
        const blossom=.78*RideOrchard.coverage(x,z);
        const gold=.86*field.canola,violet=.80*field.lavender*(1-gold),straw=.63*field.grass*(1-violet-gold);
        for(let c=0;c<3;c++){
          const ground=b.city*palette[0][c]+b.flowers*palette[1][c]+b.river*palette[2][c]+b.plateau*palette[3][c];
          pixels.data[k*4+c]=water?(riverInk[c]+channel.fordWeight*27):
            shade*((ground*(1-violet-straw-gold)+violet*lavenderInk[c]+straw*grassInk[c]+gold*goldInk[c])*(1-blossom)+cherryInk[c]*blossom);
        }
        pixels.data[k*4+3]=255;
      }
    }
    ctx.putImageData(pixels,0,0);
    function drawDeck(start,end,point) {
      ctx.beginPath();
      for(let i=0;i<=60;i++){
        const [x,,z]=point(start+(end-start)*i/60);
        const px=horizontal(x)*w,py=vertical(z)*h;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.lineWidth=4;ctx.strokeStyle='#8a9497';ctx.stroke();
      ctx.lineWidth=2;ctx.strokeStyle='#fff6dd';ctx.stroke();
    }
    const {aqueduct}=RideWhiteBridge;
    drawDeck(aqueduct.first,aqueduct.end,aqueduct.point);
    return paper;
  }
  function draw(){
    if(!base)base=reliefMap();
    canvas.width=base.width;canvas.height=base.height;
    const c=canvas.getContext('2d');
    c.drawImage(base,0,0);
    for(const id of ['grand',selected.id]){
      const path=paths.get(id),points=path.samples;
      c.beginPath();
      for(let i=0;i<points.length;i+=3){
        const x=horizontal(points[i].x)*canvas.width,y=vertical(points[i].z)*canvas.height;
        if(!i)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.closePath();
      c.lineWidth=id==='grand'?1.7:2.5;
      c.setLineDash(id==='grand'?[4,4]:[]);
      c.strokeStyle=id==='grand'?'rgba(255,255,237,.93)':'#386d53';c.stroke();
    }
  }
  function select(place){
    selected=place;
    buttons.forEach((button,id)=>button.setAttribute('aria-pressed',String(id===place.id)));
    get('map-place').textContent=place.name;
    get('map-detail').textContent=descriptions[place.id]+'　环线 '+(paths.get(place.id).length/1000).toFixed(1)+' km';
    draw();
  }
  for(const place of places){
    const b=document.createElement('button');b.type='button';b.dataset.region=place.id;b.textContent=place.name;
    const site=place.id==='mill'?RideTrails.bridge:place;
    const line=document.createElement('i'),dot=document.createElement('i');
    line.className='pin-line';dot.className='pin-dot';
    line.setAttribute('aria-hidden','true');dot.setAttribute('aria-hidden','true');
    b.onclick=()=>select(place);pins.append(line,dot,b);buttons.set(place.id,b);
    labels.push({button:b,line,dot,px:horizontal(site.x),py:vertical(site.z)});
  }
  const resize=new ResizeObserver(layoutPins);resize.observe(pins);
  get('map-tour').title='从向阳草甸出发，沿全境路线巡游 '+(paths.get('grand').length/1000).toFixed(1)+' km';
  function open(state,routeId){
    returnFocus=document.activeElement;
    const position=get('map-position');
    position.style.left=horizontal(state.x)*100+'%';position.style.top=vertical(state.z)*100+'%';
    position.style.transform='translate(-50%,-50%) rotate('+state.heading+'rad)';
    const mill=RideTrails.bridge;
    const millRange=routeId==='mill'?150:65;
    let region=world.zones(state.x,state.z).id;
    if(RideVale.near(state.x,state.z))region='vale';
    if(RideVale.bloomNear(state.x,state.z))region='bloom';
    if(Math.hypot(state.x-mill.x,state.z-mill.z)<millRange)region='mill';
    const highBridge=RideWhiteBridge.landmark;
    if(routeId===highBridge.id && Math.hypot(state.x-highBridge.x,state.z-highBridge.z)<135)region=highBridge.id;
    if(state.deckId==='aqueduct')region='skybridge';
    select(places.find(p=>p.id===region)||places[0]);
    dialog.showModal();layoutPins();buttons.get(selected.id).focus({preventScroll:true});
  }
  function close(){dialog.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  return {open,close,get selected(){return selected;},get visible(){return dialog.open;}};
};
