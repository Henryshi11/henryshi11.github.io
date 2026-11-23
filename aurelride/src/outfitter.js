/* The fitting room borrows the game canvas while it is open. Its level floor
   and independent pose let the player inspect a bike even during a jump. */
globalThis.RideOutfitter=function(T,renderer,liveRider,onClose){
  'use strict';
  const get=id=>document.getElementById(id);
  const dialog=get('ride-atelier'),stage=get('atelier-view'),canvas=renderer.domElement;
  const home=canvas.parentNode,next=canvas.nextSibling;
  const still=document.createElement('canvas');
  still.className='atelier-world-still';still.setAttribute('aria-hidden','true');
  const originalLabel=canvas.getAttribute('aria-label');
  const groups=[
    {key:'character',list:'characters',set:'setCharacter',host:'atelier-characters'},
    {key:'bike',list:'bikes',set:'setBike',host:'atelier-bikes'},
    {key:'look',list:'looks',set:'setLook',host:'atelier-looks'}
  ];
  let room,model,eye,clock=0,angle=-.99,targetAngle=-.99,spinning=true,drag=null,returnTo;
  let width=0,height=0;
  const pose={effort:.24,gust:.24,crosswind:.18,tailwind:.12,grade:0};
  function initialize(){
    room=new T.Scene();
    const paper=document.createElement('canvas');paper.width=8;paper.height=384;
    const ctx=paper.getContext('2d'),wash=ctx.createLinearGradient(0,0,0,paper.height);
    wash.addColorStop(0,'#a7c5c5');wash.addColorStop(.50,'#dce9d6');
    wash.addColorStop(.72,'#f2e6cb');wash.addColorStop(1,'#dcc9ac');
    ctx.fillStyle=wash;ctx.fillRect(0,0,paper.width,paper.height);
    const backdrop=new T.CanvasTexture(paper);backdrop.colorSpace=T.SRGBColorSpace;room.background=backdrop;
    room.add(new T.HemisphereLight(0xfff5dc,0xabc5d6,1.8));
    const sun=new T.DirectionalLight(0xffedd1,2.7);sun.position.set(3.5,5,-2);room.add(sun);
    eye=new T.PerspectiveCamera(31,1,.035,40);
    model=RideRider.create(T,()=>0,{preview:true});room.add(model.root);
    for(const g of groups){
      for(const item of liveRider[g.list]){
        const b=document.createElement('button');
        b.type='button';b.dataset.equipment=g.key;b.dataset.choice=item.id;
        const pigment=item.color??item.face;
        if(pigment!=null){
          const c=document.createElement('span');c.className='swatch';c.setAttribute('aria-hidden','true');
          c.style.background=typeof pigment==='number'?'#'+pigment.toString(16).padStart(6,'0'):pigment;b.append(c);
        }
        b.append(document.createTextNode(item.name));b.onclick=()=>{model[g.set](item.id);syncOptions();};
        get(g.host).append(b);
      }
    }
  }
  function syncOptions(){
    for(const g of groups)for(const b of get(g.host).children)
      b.setAttribute('aria-pressed',String(b.dataset.choice===model[g.key].id));
    get('atelier-person-detail').textContent=model.character.description;
    get('atelier-bike-detail').textContent=model.bike.description;
  }
  function open(opener){
    if(dialog.open)return;
    if(!room)initialize();
    for(const g of groups)model[g.set](liveRider[g.key].id);
    syncOptions();returnTo=opener||document.activeElement;
    angle=targetAngle=-.99;drag=null;width=height=0;clock=0;
    still.width=Math.min(960,canvas.width);still.height=Math.max(1,Math.round(still.width*canvas.height/canvas.width));
    still.getContext('2d').drawImage(canvas,0,0,still.width,still.height);home.insertBefore(still,canvas);
    stage.prepend(canvas);canvas.setAttribute('aria-label','骑手与单车预览，拖动旋转');
    dialog.showModal();draw(0);
    get('atelier-characters').querySelector('[aria-pressed=true]').focus({preventScroll:true});
  }
  function draw(dt){
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    if(w!==width||h!==height){
      width=w;height=h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
      renderer.setSize(w,h,false);eye.aspect=w/h;eye.updateProjectionMatrix();
    }
    clock+=dt;angle+=Math.atan2(Math.sin(targetAngle-angle),Math.cos(targetAngle-angle))*(1-Math.exp(-14*dt));
    // The body and both wheels stay in frame even on a narrow portrait screen.
    const distance=Math.max(height<335?4.60:4.32,3.8/eye.aspect);
    eye.position.set(Math.sin(angle)*distance,1.12+distance*.10,-Math.cos(angle)*distance);
    eye.lookAt(0,.87,-.05);
    pose.parked=!spinning;pose.effort=spinning?.30:0;
    model.update(dt,spinning?4:0,0,clock,pose);
    renderer.setRenderTarget(null);renderer.render(room,eye);
  }
  function close(accept){
    if(!dialog.open)return;
    if(accept){
      for(const g of groups)liveRider[g.set](model[g.key].id);
    }
    drag=null;dialog.close();home.insertBefore(canvas,next);still.remove();
    canvas.setAttribute('aria-label',originalLabel);
    onClose(accept,returnTo);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!dialog.open||drag||e.button>0)return;
    canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX};
  });
  canvas.addEventListener('pointermove',e=>{
    if(!dialog.open||drag?.id!==e.pointerId)return;
    targetAngle+=(e.clientX-drag.x)*.011;drag.x=e.clientX;
  });
  canvas.addEventListener('lostpointercapture',()=>{drag=null;});
  canvas.addEventListener('pointerup',()=>{drag=null;});
  get('atelier-left').onclick=()=>{targetAngle-=Math.PI/4;};
  get('atelier-right').onclick=()=>{targetAngle+=Math.PI/4;};
  get('atelier-motion').onclick=()=>{spinning=!spinning;get('atelier-motion').setAttribute('aria-pressed',String(spinning));};
  get('atelier-equip').onclick=()=>close(true);get('atelier-close').onclick=()=>close(false);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});
  return {open,close,draw,get visible(){return dialog.open;}};
};
