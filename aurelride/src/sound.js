/* Procedural meadow ambience. Speed is in metres per second. */
(function (global) {
  "use strict";

  // Trail stations are metres from the bridge centre. The first and last
  // cross-plank edges are at −26 and +26 m, with 52 cm between board ends.
  function boardAt(surface,halfLength) {
    return surface.material==='timber'&&surface.weight>.2?(surface.station+halfLength)/.52:NaN;
  }
  function environment(x,z,travel,axles,camera,contact={}) {
    const world=global.RideWorld,trails=global.RideTrails;
    const surface=trails?.surfaceAt(x,z);
    const weight=surface?.weight||0,material=surface?.material;
    const env={travel,material:material||'grass',gravel:material==='gravel'?weight:0,
      dirt:material==='earth'?weight:0,planks:material==='timber'?weight:0,
      river:0,riverPan:0,stone:contact.stone,airborne:contact.airborne,landingImpulse:contact.impact||0,wetTrack:0,frontBoard:NaN,rearBoard:NaN,
      tallGrass:0,lavender:0,canola:0,snow:0,silvergrass:0,petals:0};
    if(!world)return env;
    const eye=camera?.position,axis=camera?.matrix?.elements;
    function bearing(sx,sz) {
      const dx=sx-(eye?.x??x),dz=sz-(eye?.z??z);
      return (dx*(axis?.[0]??1)+dz*(axis?.[2]??0))/Math.max(3,Math.hypot(dx,dz));
    }
    function proximity(distance,scale,end){
      const edge=Math.min(1,Math.max(0,(end-distance)/(end*.28)));
      return edge*edge*(3-2*edge)/(1+(distance/scale)**2);
    }
    const at=world.river(z),dx=x-at.x;
    if(Math.abs(dx)<270){
      // Project onto the local curving bank. Using the channel centre at the
      // rider's Z would put the sound straight across even on diagonal reaches.
      const slope=(world.river(z+6).x-world.river(z-6).x)/12;
      const nearestZ=Math.max(world.bounds.minZ,Math.min(world.bounds.maxZ,z+dx*slope/(1+slope*slope)));
      const water=world.river(nearestZ);
      const bankDistance=Math.max(0,Math.hypot(x-water.x,z-nearestZ)-water.halfWidth);
      env.river=proximity(bankDistance,36,205);
      env.riverPan=.84*bearing(water.x,nearestZ);
      const wd=world.waterDepth(x,z);
      if(material!=='timber'&&wd>.012)env.wetTrack=Math.min(1,wd/.16+.32);
    }
    const bridge=trails?.bridge;
    if(bridge&&axles?.front&&axles.rear&&Math.abs(z-bridge.z)<bridge.halfWidth+1.5&&Math.abs(x-bridge.x)<bridge.halfLength+2){
      const front=trails.surfaceAt(axles.front.x,axles.front.z),rear=trails.surfaceAt(axles.rear.x,axles.rear.z);
      env.frontBoard=boardAt(front,bridge.halfLength);env.rearBoard=boardAt(rear,bridge.halfLength);
      const blend=name=>.5*((front.material===name?front.weight:0)+(rear.material===name?rear.weight:0));
      env.planks=blend('timber');env.gravel=blend('gravel');env.dirt=blend('earth');
    }
    if(contact.stone||contact.airborne){
      env.material=contact.airborne?'air':'stone';
      env.gravel=env.dirt=env.planks=env.wetTrack=0;
      env.frontBoard=env.rearBoard=NaN;
      return env;
    }
    const field=global.RideWildfields,open=Math.max(0,1-env.planks-env.dirt-env.gravel)*(1-env.wetTrack);
    if(open>.01){
      const snowAmt=global.RideLand?.snowAt?global.RideLand.snowAt(x,z):0;
      env.snow=open*snowAmt;
      const orch=global.RideOrchard?.coverage?global.RideOrchard.coverage(x,z):0;
      env.petals=open*Math.min(1,Math.max(0,(orch-.08)/.42));
      const zone=world.zones(x,z);
      env.silvergrass=open*Math.min(1,Math.max(0,(zone.plateau-.22)/.52))*(1-snowAmt);
    }
    if(field&&open>.01){
      const front=axles?.front,rear=axles?.rear;
      const near=front?field.sample(front.x,front.z):field.sample(x,z);
      const back=rear?field.sample(rear.x,rear.z):near;
      env.tallGrass=open*(.70*near.grass+.30*back.grass);
      env.lavender=open*(.70*near.lavender+.30*back.lavender);
      env.canola=open*(.70*near.canola+.30*back.canola);
    }
    return env;
  }

  function create() {
    let context, master, wind, airPressure, leaves, tires, gravel, wood, river, hub, rain, nextBird, lastMix = -1;
    let snowBed, foliageBed;
    let enabled = false, active = true, disposed = false, suspendTimer;
    let lastSpeed = 0, lastPedaling = false, localGust = .42, sourceSide=0;
    let localRain=0,windStrength=.54;
    let distanceToHiss=3, lastSide=1;
    let terrain,previousTravel=NaN,previousFront=NaN,previousRear=NaN,previousImpact=0;
    let vegetation,untilGrass=.6,untilLavender=.25,untilCanola=.22,untilSnow=.35,untilSilver=.45;
    const sources = [];
    const impacts=new Set();
    const Audio = global.AudioContext || global.webkitAudioContext;
    const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

    function gain(value, destination) {
      const node = context.createGain();
      node.gain.value = value;
      node.connect(destination);
      return node;
    }

    function filter(type, frequency, q, destination) {
      const node = context.createBiquadFilter();
      node.type = type;
      node.frequency.value = frequency;
      node.Q.value = q;
      node.connect(destination);
      return node;
    }

    function loop(buffer, destination, offset=0) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(destination);
      source.start(0,offset);
      sources.push(source);
      return source;
    }

    function pan(destination, value) {
      if (!context.createStereoPanner) return {input:destination,param:null};
      const panner=context.createStereoPanner();
      panner.pan.value=value;panner.connect(destination);
      return {input:panner,param:panner.pan};
    }

    // Distinct channels provide width without moving the image with the camera.
    function makeNoise(seconds, stereo) {
      const channels = stereo ? 2 : 1;
      const samples = Math.round(context.sampleRate * seconds);
      const buffer = context.createBuffer(channels, samples, context.sampleRate);
      for (let c = 0; c < channels; c++) {
        const data = buffer.getChannelData(c);
        let low = 0;
        for (let i = 0; i < samples; i++) {
          const white = Math.random() * 2 - 1;
          low = low * 0.91 + 0.09 * white;
          data[i] = 0.6 * white + 0.85 * low;
        }
        const seam = Math.min(320, samples >> 2);
        for (let i = 0; i < seam; i++) {
          const t = i / seam;
          data[i] = data[samples - 1] * (1 - t) + data[i] * t;
        }
      }
      return buffer;
    }

    function makeHub() {
      const sampleRate = context.sampleRate;
      const buffer = context.createBuffer(1, Math.round(sampleRate * 0.72), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < 15; i++) {
        const start = Math.round((i + 0.06 + 0.04 * Math.random()) * data.length / 15);
        const level = 0.46 + Math.random() * 0.3;
        const length = Math.min(Math.floor(sampleRate * 0.016), data.length - start);
        for (let j = 0; j < length; j++) {
          const t = j / sampleRate;
          const envelope = Math.min(1, j / 9) * Math.exp(-310 * t);
          const tick = Math.sin(2 * Math.PI * (1230 * t - 9000 * t * t));
          data[start + j] = level * envelope * (0.4 * tick + 0.56 * (Math.random() * 2 - 1));
        }
      }
      return buffer;
    }

    function makeRain() {
      const duration=3.67,rate=Math.min(22050,context.sampleRate);
      const buffer=context.createBuffer(2,Math.ceil(rate*duration),rate);
      // A loop of separate small impacts on leaves. Exponential decay and
      // wrapping their tails into the start avoid a seam in a sustained shower.
      for(let channel=0;channel<2;channel++){
        const samples=buffer.getChannelData(channel);
        for(let i=0;i<duration*230;i++){
          const start=Math.floor(Math.random()*samples.length), life=.002+Math.random()*.012;
          const pitch=1230+Math.random()*2600,level=.055+Math.random()**3*.20;
          const length=Math.ceil(rate*life*3);
          for(let j=0;j<length;j++){
            const t=j/rate,ring=Math.sin(2*Math.PI*pitch*t*(1-.09*t/life));
            samples[(start+j)%samples.length]+=level*Math.exp(-t/life)
              *Math.min(1,t/.0009)*(.34*ring+.66*(Math.random()*2-1));
          }
        }
      }
      return buffer;
    }

    function makeCurrent() {
      const rate=Math.min(22050,context.sampleRate),buffer=context.createBuffer(1,Math.ceil(rate*5.19),rate);
      const a=buffer.getChannelData(0);
      let bed=0,swell=0;
      for(let i=0;i<a.length;i++){
        const white=Math.random()*2-1;bed=.875*bed+.125*white;swell=.9991*swell+.0009*(Math.random()*2-1);
        const t=i/rate;
        a[i]=(.45*white+1.46*bed)*(.59+.13*Math.sin(4.84*t+Math.sin(3.64*t))+2.2*swell);
      }
      // Short rising bubble resonances ride on the turbulent noise floor.
      for(let i=0;i<440;i++){
        const start=Math.floor(Math.random()*a.length),hz=400+1800*Math.random(),life=.006+.017*Math.random();
        const level=.06+.12*Math.random();
        for(let j=0;j<rate*life*3;j++){
          const t=j/rate;
          a[(start+j)%a.length]+=level*Math.min(1,t/.0018)*Math.exp(-t/life)*Math.sin(2*Math.PI*hz*t*(1+t*8.5));
        }
      }
      return buffer;
    }

    // Foxtail heads sweep across a leg over several centimetres; a cluster
    // of lavender stems instead makes a few quiet, dry contacts.
    function seedContact(lavender) {
      const rate=Math.min(context.sampleRate,24000),duration=lavender?.103:.225;
      const buffer=context.createBuffer(1,Math.round(rate*duration),rate),out=buffer.getChannelData(0);
      if(!lavender){
        let fibre=0;
        for(let i=0;i<out.length;i++){
          const u=i/out.length,n=Math.random()*2-1;
          fibre=.81*fibre+.19*n;
          out[i]=Math.sin(Math.PI*u)**1.4*(.66*fibre+.08*n)*(.74+.26*Math.sin(u*17.6));
        }
      }
      const hits=lavender?5:48;
      for(let i=0;i<hits;i++){
        const u=.06+.78*Math.random(),start=Math.floor(u*out.length);
        const life=lavender?.0026+.004*Math.random():.0019+.0027*Math.random();
        const pitch=(lavender?790:1360)*(1+.9*Math.random());
        const force=(lavender?.32:.14)*(.45+.55*Math.sin(Math.PI*u));
        let body=0;
        for(let j=0;j<rate*life*4&&j+start<out.length;j++){
          const t=j/rate;
          body=.68*body+.32*(Math.random()*2-1);
          out[start+j]+=force*Math.min(1,t/.0012)*Math.exp(-t/life)*(body+.53*Math.sin(2*Math.PI*pitch*t));
        }
      }
      return buffer;
    }

    function makeSnowCrunch() {
      // Deep, muffled, plush thick powder snow compression (warm low-mid body, zero shrill high hiss!).
      const rate=Math.min(22050,context.sampleRate),dur=2.6;
      const b=context.createBuffer(2,Math.ceil(rate*dur),rate);
      for(let c=0;c<2;c++){
        const a=b.getChannelData(c);
        let lp1=0,lp2=0;
        for(let i=0;i<a.length;i++){
          const w=Math.random()*2-1;
          lp1=.91*lp1+.09*w;
          lp2=.965*lp2+.035*lp1;
          a[i]=.48*lp2+.22*lp1;
        }
        // Soft, heavy packed-snow compression thuds & velvety low-mid crunches (260..820Hz)
        for(let k=0;k<460;k++){
          const start=Math.floor(Math.random()*a.length);
          const len=Math.floor(rate*(.018+.042*Math.random()));
          const amp=(.18+.38*Math.random()**1.8);
          const freq=220+520*Math.random();
          let body=0;
          for(let j=0;j<len;j++){
            const t=j/rate,env=Math.sin(Math.PI*j/len)**1.5;
            body=.85*body+.15*(Math.random()*2-1);
            const pack=Math.sin(2*Math.PI*freq*t)*.24+body*.95;
            a[(start+j)%a.length]+=amp*env*pack;
          }
        }
      }
      return b;
    }

    function snowCreakPulse() {
      // Thick, cozy muffled snow-pack press ("pu-chi / ge-da" deep soft snow under tire weight)
      const rate=Math.min(context.sampleRate,24000),dur=.18;
      const b=context.createBuffer(1,Math.round(rate*dur),rate),out=b.getChannelData(0);
      let low=0,mid=0;
      for(let i=0;i<out.length;i++){
        const u=i/out.length,t=i/rate,n=Math.random()*2-1;
        low=.93*low+.07*n;
        mid=.84*mid+.16*n;
        const env=Math.sin(Math.PI*u)**1.4;
        const thump=Math.sin(2*Math.PI*(155+95*u)*t)*.22;
        out[i]=env*(1.15*low+.48*mid+thump);
      }
      return b;
    }

    function canolaSwish() {
      // Richer, broader leafy wave when parting dense yellow rapeseed blossoms
      const rate=Math.min(context.sampleRate,24000),dur=.26;
      const b=context.createBuffer(1,Math.round(rate*dur),rate),out=b.getChannelData(0);
      let lp=0;
      for(let i=0;i<out.length;i++){
        const u=i/out.length,n=Math.random()*2-1;
        lp=.74*lp+.26*n;
        const env=Math.sin(Math.PI*u)**1.2;
        out[i]=env*(.76*lp+.24*n)*(.78+.22*Math.sin(u*24));
      }
      return b;
    }

    function makeGravel() {
      const rate=Math.min(22050,context.sampleRate),b=context.createBuffer(1,Math.ceil(rate*2.73),rate);
      const a=b.getChannelData(0);
      for(let i=0;i<a.length;i++)a[i]=.13*(Math.random()*2-1);
      for(let k=0;k<1290;k++){
        const start=Math.floor(Math.random()*a.length),len=11+Math.floor(Math.random()*91);
        const level=.09+.58*Math.random()**3;
        for(let j=0;j<len;j++){
          const amp=(1-j/len)**2*Math.min(1,j/3);
          a[(start+j)%a.length]+=amp*level*(Math.random()*2-1);
        }
      }
      return b;
    }

    function knockBuffer() {
      const rate=Math.min(22050,context.sampleRate),length=.11;
      const b=context.createBuffer(1,Math.ceil(rate*length),rate),a=b.getChannelData(0);
      let smoothed=0;
      for(let i=0;i<a.length;i++){
        const t=i/rate,white=Math.random()*2-1;
        smoothed=.75*smoothed+.25*white;
        const soft=Math.min(1,t/.0014);
        const ring=.32*Math.sin(2*Math.PI*148*t)*Math.exp(-49*t)
          +.24*Math.sin(2*Math.PI*344*t+.2)*Math.exp(-88*t);
        a[i]=soft*(ring+(.58*smoothed+.23*white)*Math.exp(-104*t));
      }
      return b;
    }

    function strike(buffer,destination,when,level,rate) {
      const source=context.createBufferSource(),amplitude=gain(level,destination);
      source.buffer=buffer;source.playbackRate.value=rate;source.connect(amplitude);
      impacts.add(source);source.onended=()=>{
        impacts.delete(source);source.disconnect();amplitude.disconnect();
      };
      source.start(when);
    }

    function startGraph() {
      context = new Audio();
      master = gain(0, context.destination);
      const breeze=makeNoise(4.73,true), grass=makeNoise(2.97,false);
      const windGain = gain(0, master);
      const windCutoff = filter("lowpass", 620, 0.45, windGain);
      loop(breeze, filter("highpass", 120, 0.48, windCutoff));
      wind = { level: windGain.gain, cutoff: windCutoff.frequency };

      // Distinct low pressure and high reed-rustle layers keep a crosswind
      // audible while preserving a broad, centred headwind at speed.
      const lee=pan(master,0), pressureGain=gain(0,lee.input);
      const pressureCutoff=filter("lowpass",330,.59,pressureGain);
      loop(breeze,filter("highpass",58,.54,pressureCutoff),1.81);
      airPressure={level:pressureGain.gain,cutoff:pressureCutoff.frequency,pan:lee.param};

      const tireGain = gain(0, master);
      const tireCutoff = filter("lowpass", 1120, 0.5, tireGain);
      const tireLoop = loop(grass, filter("highpass", 330, 0.47, tireCutoff));
      tires = { level: tireGain.gain, rate: tireLoop.playbackRate,cutoff:tireCutoff.frequency };

      const gravelGain=gain(0,master),gravelTone=filter('lowpass',4300,.58,gravelGain);
      const grains=loop(makeGravel(),filter('highpass',245,.52,gravelTone));
      gravel={level:gravelGain.gain,cutoff:gravelTone.frequency,rate:grains.playbackRate};
      const woodLevel=gain(0,master),woodKnots=gain(1,master);
      const rolling=loop(grass,filter('bandpass',303,.85,woodLevel),1.32);
      wood={level:woodLevel.gain,rate:rolling.playbackRate,output:woodKnots,sample:knockBuffer()};

      const streamBuffer=makeCurrent(),bank=pan(master,0),bankLevel=gain(0,bank.input);
      const bankTone=filter('lowpass',2400,.59,bankLevel);
      loop(streamBuffer,filter('highpass',145,.55,bankTone));
      river={level:bankLevel.gain,tone:bankTone.frequency,pan:bank.param};
      leaves=[-1,1].map((side,i)=>{
        const panner=pan(master,side*.58), reedGain=gain(0,panner.input);
        const reedFilter=filter("bandpass",2240,.67,reedGain);
        const source=loop(grass,reedFilter,.72+1.32*i);
        source.playbackRate.value=.88+.25*i;
        return {level:reedGain.gain,cutoff:reedFilter.frequency};
      });
      vegetation={grass:seedContact(false),lavender:seedContact(true),canola:canolaSwish(),snowPulse:snowCreakPulse(),
        sides:[pan(master,-.39).input,pan(master,.39).input]};

      // Deep, thick, plush snow-packing bed (warm low-pass capped at 620..1080Hz)
      const snowGain=gain(0,master),snowTone=filter('lowpass',880,.52,snowGain);
      const snowLoop=loop(makeSnowCrunch(),filter('highpass',95,.48,snowTone));
      snowBed={level:snowGain.gain,cutoff:snowTone.frequency,rate:snowLoop.playbackRate};

      // Continuous dense foliage brushing bed (canola / lavender / silvergrass / cherry petals)
      const folGain=gain(0,master),folBand=filter('bandpass',1900,.72,folGain);
      const folLoop=loop(breeze,folBand,2.14);
      foliageBed={level:folGain.gain,freq:folBand.frequency,rate:folLoop.playbackRate};

      const hubGain = gain(0, master);
      const hubLoop = loop(makeHub(), filter("lowpass", 2400, 0.55, hubGain));
      hub = { level: hubGain.gain, rate: hubLoop.playbackRate };
      const rainGain=gain(0,master),patina=filter('lowpass',5700,.48,rainGain);
      loop(makeRain(),filter('highpass',750,.52,patina));
      rain={level:rainGain.gain,cutoff:patina.frequency};
      nextBird = context.currentTime + 9 + Math.random() * 9;
    }

    function chirp(now) {
      const side = context.createStereoPanner ? context.createStereoPanner() : null;
      if (side) {
        side.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.35 + 0.37 * Math.random());
        side.connect(master);
      }
      const base = 1920 + 450 * Math.random();
      const count = 2 + Number(Math.random() > 0.65);
      for (let i = 0; i < count; i++) {
        const bird = context.createOscillator();
        const level = gain(0, side || master);
        bird.connect(level);
        const t = now + 0.05 + 0.19 * i;
        const pitch = base * (1 + 0.035 * i);
        bird.frequency.setValueAtTime(pitch, t);
        bird.frequency.exponentialRampToValueAtTime(pitch * 1.19, t + 0.058);
        bird.frequency.exponentialRampToValueAtTime(pitch * 0.91, t + 0.14);
        level.gain.setValueAtTime(0, t);
        level.gain.linearRampToValueAtTime(0.0038, t + 0.029);
        level.gain.exponentialRampToValueAtTime(0.00001, t + 0.14);
        bird.onended = () => {
          bird.disconnect();
          level.disconnect();
          if (i === count - 1 && side) side.disconnect();
        };
        bird.start(t);
        bird.stop(t + 0.145);
      }
    }

    function brush(speed, gust, now) {
      const side=Math.random()<.63?-lastSide:lastSide;
      lastSide=side;
      const stem=leaves[side>0?1:0];
      const softness=.83+Math.random()*.5;
      const rise=(.046+.02*(1-speed))*softness;
      const decay=(.135+.08*(1-speed))*softness;
      const peak=(.014+.046*speed)*(.70+.54*gust)*softness;
      // A blade approaches, grazes and falls away. setTargetAtTime preserves
      // continuity when a second tuft brushes the same side.
      stem.level.cancelScheduledValues(now);
      stem.level.setTargetAtTime(peak,now,rise*.43);
      stem.level.setTargetAtTime(.00001,now+rise,decay*.34);
      stem.cutoff.setTargetAtTime((1370+1190*speed)*softness,now,.035);
      stem.cutoff.setTargetAtTime((850+420*speed)*softness,now+rise,decay*.81);
    }

    // Each axle reports an absolute board coordinate. Crossing a seam at a
    // shallow angle naturally spaces the two wheel strikes further apart.
    function boardStrikes(start,end,rear,dt,now,speed,strength) {
      if(!Number.isFinite(start)||!Number.isFinite(end)||start===end||Math.abs(end-start)>11)return;
      const direction=Math.sign(end-start),from=Math.floor(start),to=Math.floor(end);
      const interval=Math.min(dt,.045);
      for(let i=from;i!==to;i+=direction){
        const board=direction>0?i+1:i;
        const t=(board-start)/(end-start);
        const grain=.5+.5*Math.sin((board+16)*8.178+.41);
        // Expansion seams sound deeper every eight boards. Quiet intermediate
        // seams merge into the rolling sound when crossing at high speed.
        const major=board%8===0;
        if(!major&&speed>15&&board%2!==0)continue;
        const level=(major ? .60 : .14+.23*grain)*(.47+.53*Math.min(1,speed/14))*strength*(rear ? 1 : .82);
        strike(wood.sample,wood.output,now+t*interval,level,(rear ? .89 : 1.08)*(.91+.16*grain));
      }
    }

    function resetPosition() {
      previousTravel=previousFront=previousRear=NaN;previousImpact=0;distanceToHiss=3;terrain=undefined;
      untilGrass=.6;untilLavender=.25;untilCanola=.22;untilSnow=.35;untilSilver=.45;
      if(!context)return;
      const now=context.currentTime;
      for(const source of impacts)source.stop(now);
      for(const node of [river,tires,gravel,wood,hub,snowBed,foliageBed]){
        if(!node)continue;
        node.level.cancelScheduledValues(now);node.level.setTargetAtTime(0,now,.022);
      }
      for(const stem of leaves){
        stem.level.cancelScheduledValues(now);stem.level.setTargetAtTime(0,now,.017);
      }
    }

    function updateMix() {
      if (!context || context.state !== "running" || !enabled || !active) return;
      const now = context.currentTime;
      if (now - lastMix < 0.040) return;
      const dt=lastMix<0?0:Math.min(.14,now-lastMix);
      lastMix = now;
      const tracked=Number.isFinite(terrain?.travel);
      const distance=tracked?terrain.travel-previousTravel:lastSpeed*dt;
      const validMove=distance>=0&&distance<=Math.max(1.5,lastSpeed*dt*3+.3);
      const moved=validMove?distance:0;
      const rollingSpeed=tracked&&!(moved>.0001)?0:lastSpeed;
      const speed=clamp(rollingSpeed/28,0,1.2),road=terrain||{};
      const gust = localGust, ripple=.97+.03*Math.sin(now*5.3+2.1*Math.sin(now*.73));
      wind.level.setTargetAtTime((.041+.196*speed)*(.59+.67*gust)*(.76+.45*windStrength)*ripple,now,.16);
      wind.cutoff.setTargetAtTime(820+2300*speed+770*gust,now,.19);
      airPressure.level.setTargetAtTime((.035+.38*speed**1.38)*(.7+.56*gust),now,.17);
      airPressure.cutoff.setTargetAtTime(225+215*speed+95*gust,now,.26);
      if(airPressure.pan)airPressure.pan.setTargetAtTime(.42*sourceSide*(.3+.7*gust)/(1+.53*speed),now,.22);
      const gravelMix=road.gravel||0,earth=road.dirt||0,planks=road.planks||0;
      const ford=road.wetTrack||0;
      const snowMix=road.airborne||road.stone?0:clamp(road.snow||0,0,1);
      const grassMix=road.airborne||road.stone?0:clamp(1-gravelMix-earth-planks,0,1)*(1-ford)*(1-snowMix*.85),rollIn=Math.min(1,speed*9);
      const stoneRoll=road.stone&&!road.airborne ? .52 : 0;
      tires.level.setTargetAtTime((.014+.084*speed)*rollIn*(grassMix+stoneRoll),now,.085);
      tires.cutoff.setTargetAtTime((stoneRoll?410:800)+1200*speed,now,.17);
      tires.rate.setTargetAtTime(.55+.86*speed,now,.22);
      // Deep, muffled, thick powder snow crunch bed (zero harsh treble)
      if(snowBed){
        snowBed.level.setTargetAtTime(snowMix*(.14+.36*speed)*rollIn,now,.07);
        snowBed.rate.setTargetAtTime(.62+.58*speed,now,.12);
        snowBed.cutoff.setTargetAtTime(560+480*speed,now,.12);
      }
      // Continuous dense flower / silvergrass / cherry petal rustling bed
      const lavAmt=clamp(road.lavender||0,0,1),canAmt=clamp(road.canola||0,0,1);
      const silAmt=clamp(road.silvergrass||0,0,1),petAmt=clamp(road.petals||0,0,1);
      const denseMix=Math.min(1,lavAmt*1.15+canAmt*1.25+silAmt*.95+petAmt*.55)*(1-snowMix);
      if(foliageBed){
        // Distinct center frequency per biome: canola (richer 1350Hz), lavender (crisper 3100Hz),
        // silvergrass (airy 2700Hz), cherry petals (soft 2200Hz).
        const denom=Math.max(.001,lavAmt+canAmt+silAmt+petAmt);
        const targetHz=(canAmt*1350+lavAmt*3150+silAmt*2680+petAmt*2150)/denom;
        foliageBed.level.setTargetAtTime(denseMix*(.045+.19*Math.sqrt(speed))*rollIn,now,.09);
        foliageBed.freq.setTargetAtTime(targetHz*(.85+.30*speed),now,.14);
        foliageBed.rate.setTargetAtTime(.82+.58*speed,now,.15);
      }
      gravel.level.setTargetAtTime((gravelMix*.96+earth*.74)*(.16+.38*speed)*rollIn*(1-ford),now,.075);
      gravel.rate.setTargetAtTime(.60+.99*speed,now,.13);
      gravel.cutoff.setTargetAtTime(1820+2350*gravelMix+1180*speed,now,.12);
      wood.level.setTargetAtTime(planks*(.12+.40*speed)*rollIn,now,.07);
      wood.rate.setTargetAtTime(.49+.95*speed,now,.11);
      const riverNear=road.river||0;
      river.level.setTargetAtTime(.28*riverNear+.34*ford*rollIn*(.35+.85*Math.sqrt(speed)),now,.14);
      river.tone.setTargetAtTime(930+2860*Math.sqrt(Math.max(riverNear,ford)),now,.16);
      if(river.pan)river.pan.setTargetAtTime(road.riverPan||0,now,.12);
      const impact=road.landingImpulse||0;
      if(impact>.18&&previousImpact<.12){
        strike(wood.sample,wood.output,now,.10+.32*impact,.46+.08*impact);
      }
      previousImpact=impact;
      if(tracked&&moved>.0001&&rollingSpeed>.2){
        boardStrikes(previousFront,road.frontBoard,false,dt,now,rollingSpeed,planks);
        boardStrikes(previousRear,road.rearBoard,true,dt,now,rollingSpeed,planks);
      }
      previousTravel=road.travel;previousFront=road.frontBoard;previousRear=road.rearBoard;
      rain.level.setTargetAtTime(localRain*(.27+.15*Math.min(1,speed)),now,.32);
      rain.cutoff.setTargetAtTime(3300+1850*localRain+480*speed,now,.39);
      hub.level.setTargetAtTime(lastPedaling ? 0 : 0.034 * Math.min(1, speed * 3.4), now, 0.14);
      hub.rate.setTargetAtTime(0.32 + speed * 1.94, now, 0.22);
      distanceToHiss-=moved*grassMix;
      if(distanceToHiss<=0 && rollingSpeed>2.5 && grassMix>.28) {
        brush(speed,gust,now);
        distanceToHiss=3.6+Math.random()*7.4;
      }
      if(moved>0&&rollingSpeed>.35){
        const tall=clamp(road.tallGrass||0,0,1);
        untilGrass-=moved*tall;untilLavender-=moved*lavAmt;untilCanola-=moved*canAmt;
        untilSnow-=moved*snowMix;untilSilver-=moved*silAmt;
        if(untilGrass<=0&&tall>.10){
          strike(vegetation.grass,vegetation.sides[Number(Math.random()>.5)],now,
            (.22+.46*Math.sqrt(speed))*Math.sqrt(tall),.88+.17*Math.random()+.20*speed);
          untilGrass=1.4+3.2*Math.random();
        }
        // Crisp, frequent woody-floral brushing clicks through purple lavender
        if(untilLavender<=0&&lavAmt>.08){
          strike(vegetation.lavender,vegetation.sides[Number(Math.random()>.5)],now,
            (.24+.48*Math.sqrt(speed))*Math.sqrt(lavAmt),1.05+.38*Math.random()+.22*speed);
          untilLavender=.42+1.25*Math.random();
        }
        // Lush, broad leafy waves sweeping past wheels & legs through yellow canola
        if(untilCanola<=0&&canAmt>.08){
          strike(vegetation.canola,vegetation.sides[Number(Math.random()>.5)],now,
            (.26+.54*Math.sqrt(speed))*Math.sqrt(canAmt),.78+.22*Math.random()+.18*speed);
          untilCanola=.55+1.45*Math.random();
        }
        // Airy dry plume swish through tall silvergrass sea on the western plateau
        if(untilSilver<=0&&silAmt>.12){
          strike(vegetation.grass,vegetation.sides[Number(Math.random()>.5)],now,
            (.18+.38*Math.sqrt(speed))*Math.sqrt(silAmt),1.22+.24*Math.random()+.20*speed);
          untilSilver=.85+2.1*Math.random();
        }
        // Crisp individual tire-crunch pulses in fresh eastern powder snow
        if(untilSnow<=0&&snowMix>.12){
          strike(vegetation.snowPulse,vegetation.sides[Number(Math.random()>.5)],now,
            (.18+.34*Math.sqrt(speed))*Math.sqrt(snowMix),.86+.28*Math.random()+.16*speed);
          untilSnow=.45+.95*Math.random();
        }
      }
      if (now >= nextBird) {
        if (speed < 0.96 && localRain < .30) chirp(now);
        nextBird = now + 15 + Math.random() * 22;
      }
    }

    function unlock() {
      if (disposed || !enabled || !Audio) return;
      if (!context) startGraph();
      sync();
    }

    function sync() {
      clearTimeout(suspendTimer);
      if (!context || disposed) return;
      const visible = !global.document || !global.document.hidden;
      if (enabled && active && visible) {
        if (context.state === "suspended" || context.state === "interrupted") {
          context.resume().catch(() => {});
        }
        master.gain.setTargetAtTime(0.8, context.currentTime, 0.13);
        lastMix = -1;
        updateMix();
      } else {
        resetPosition();
        master.gain.setTargetAtTime(0, context.currentTime, 0.032);
        suspendTimer = setTimeout(() => {
          if (context && context.state === "running") context.suspend().catch(() => {});
        }, 210);
      }
    }

    function onInteraction() {
      if (enabled && (!context || context.state === "suspended" || context.state === "interrupted")) unlock();
    }

    const doc = global.document;
    if (doc) {
      doc.addEventListener("pointerdown", onInteraction, true);
      doc.addEventListener("keydown", onInteraction, true);
      doc.addEventListener("visibilitychange", sync);
    }

    return {
      resetPosition,
      setEnabled(value) {
        if (disposed) return;
        enabled = Boolean(value);
        const activation = global.navigator && global.navigator.userActivation;
        if (enabled && !context && (!activation || activation.isActive)) unlock();
        else sync();
      },
      update(speed, pedaling, isActive, gust, panAmount, weather, environmentState) {
        if (disposed) return;
        lastSpeed = Number.isFinite(speed) ? Math.abs(speed) : 0;
        lastPedaling = Boolean(pedaling);
        terrain=environmentState;
        if(Number.isFinite(gust))localGust=clamp(gust,0,1);
        if(Number.isFinite(panAmount))sourceSide=clamp(panAmount,-1,1);
        if(weather){
          localRain=clamp(weather.rain||0,0,1);windStrength=clamp(weather.windStrength??.54,0,1);
        }
        if (Boolean(isActive) !== active) {
          active = Boolean(isActive);
          sync();
        } else updateMix();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        clearTimeout(suspendTimer);
        if (doc) {
          doc.removeEventListener("pointerdown", onInteraction, true);
          doc.removeEventListener("keydown", onInteraction, true);
          doc.removeEventListener("visibilitychange", sync);
        }
        for (const source of sources) {
          source.stop();
          source.disconnect();
        }
        for (const source of impacts) source.stop();
        if (context && context.state !== "closed") context.close().catch(() => {});
      }
    };
  }

  global.RideAudio = { create, environment };
})(typeof window !== "undefined" ? window : globalThis);
