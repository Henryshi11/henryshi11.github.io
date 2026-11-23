/* Ultra-distant painterly sprite dragon gliding serenely behind and between the high
   Eastern Snow Mountain peaks — blending into the cobalt aerial haze like matte art. */
globalThis.RideCitadelDragon=function(T,scene){
  'use strict';

  function makeDragonTexture(){
    const c=document.createElement('canvas');
    c.width=512;c.height=256;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,512,256);

    // Painterly aerial-perspective palette: soft mist-veiled cobalt silhouette + sunlit pale ice-white ridge
    const bodyGrad=ctx.createLinearGradient(120,60,360,190);
    bodyGrad.addColorStop(0,'rgba(222,238,255,0.92)');
    bodyGrad.addColorStop(0.38,'rgba(92,134,204,0.88)');
    bodyGrad.addColorStop(1,'rgba(44,78,148,0.82)');

    // Far (upper-back) swept wing
    ctx.fillStyle='rgba(70,112,184,0.78)';
    ctx.beginPath();
    ctx.moveTo(212,118);
    ctx.bezierCurveTo(235,62,286,28,358,18);
    ctx.bezierCurveTo(338,48,325,74,322,96);
    ctx.bezierCurveTo(304,84,284,82,272,98);
    ctx.bezierCurveTo(256,90,236,96,225,118);
    ctx.closePath();
    ctx.fill();

    // Sweeping sinuous tail & slender neck + head (flying toward left)
    ctx.fillStyle=bodyGrad;
    ctx.beginPath();
    ctx.moveTo(92,118); // snout tip
    ctx.quadraticCurveTo(106,108,124,112); // head & crest
    ctx.quadraticCurveTo(154,116,186,110); // graceful arched neck
    ctx.quadraticCurveTo(216,104,248,118); // chest/back
    ctx.bezierCurveTo(298,136,360,122,422,138); // upper tail sweep
    ctx.quadraticCurveTo(458,148,486,136); // tail tip
    ctx.quadraticCurveTo(454,160,414,152); // lower tail edge
    ctx.bezierCurveTo(352,140,294,154,238,136); // belly
    ctx.quadraticCurveTo(198,134,174,124); // throat
    ctx.quadraticCurveTo(136,128,112,124); // jaw
    ctx.closePath();
    ctx.fill();

    // Sweeping near foreground dragon wing (graceful curved arc with delicate scalloped membrane)
    const wingGrad=ctx.createLinearGradient(170,36,280,185);
    wingGrad.addColorStop(0,'rgba(232,244,255,0.95)');
    wingGrad.addColorStop(0.28,'rgba(116,158,224,0.88)');
    wingGrad.addColorStop(1,'rgba(52,88,162,0.82)');
    ctx.fillStyle=wingGrad;
    ctx.beginPath();
    ctx.moveTo(196,118);
    ctx.bezierCurveTo(188,68,214,32,278,14); // leading wing spar sweeping high
    ctx.bezierCurveTo(298,38,314,68,318,96); // outer wingtip sweep
    ctx.quadraticCurveTo(294,88,280,108); // scallop 1
    ctx.quadraticCurveTo(260,96,246,118); // scallop 2
    ctx.quadraticCurveTo(226,108,212,126); // inner wing trailing root
    ctx.closePath();
    ctx.fill();

    // Soft bright sunlight highlight along leading wing edge & neck ridge
    ctx.strokeStyle='rgba(245,250,255,0.72)';
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(106,112);
    ctx.quadraticCurveTo(155,113,196,114);
    ctx.bezierCurveTo(194,68,218,34,276,16);
    ctx.stroke();

    const tex=new T.CanvasTexture(c);
    tex.colorSpace=T.SRGBColorSpace;
    tex.minFilter=T.LinearMipmapLinearFilter;
    tex.magFilter=T.LinearFilter;
    tex.needsUpdate=true;
    return tex;
  }

  const tex=makeDragonTexture();
  const geo=new T.PlaneGeometry(285,142,16,8);
  const mat=new T.ShaderMaterial({
    uniforms:{
      uMap:{value:tex},
      uTime:{value:0},
      uOpacity:{value:.72}
    },
    transparent:true,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false,
    blending:T.CustomBlending,
    blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
    blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
    vertexShader:`
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vUv=uv;
        vec3 p=position;
        // Subtle, poetic slow wing-tip undulation & tail flow
        float wingArea=smoothstep(.45,.95,uv.y)*smoothstep(.15,.75,uv.x)*(1.-smoothstep(.65,.95,uv.x));
        float tailArea=smoothstep(.55,.98,uv.x)*(1.-smoothstep(.45,.75,uv.y));
        float glide=sin(uTime*1.35);
        p.y+=wingArea*glide*18.0+tailArea*sin(uTime*1.9-uv.x*5.0)*9.5;
        p.z+=wingArea*cos(uTime*1.35)*14.0;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec4 tex=texture2D(uMap,vUv);
        float a=tex.a*uOpacity;
        if(a<.01)discard;
        // Soft blue aerial perspective so the dragon lives naturally among the distant snow peaks
        vec3 c=mix(tex.rgb,vec3(.42,.64,.94),.26);
        gl_FragColor=vec4(c,a);
        #include <colorspace_fragment>
      }`
  });

  const mesh=new T.Mesh(geo,mat);
  mesh.name='Ultra-distant soaring snow-peak dragon';
  mesh.frustumCulled=false;
  // Render BEHIND the hero foreground snow peak (-5) and in front of the far glacier crest (-8)
  // so it truly glides BETWEEN the distant snow mountain layers!
  mesh.renderOrder=-6;
  scene.add(mesh);

  const cycle=110;
  const rad=Math.PI/180;
  function update(time){
    mat.uniforms.uTime.value=time;
    const p=(time%cycle)/cycle;
    // Slowly glides across the high snowy mountain sky (+78° to +128° at distance 4550m)
    const sweep=Math.sin(p*Math.PI*2);
    const az=(104+sweep*24)*rad;
    const radius=4550+Math.cos(p*Math.PI*2)*260;
    const y=980+Math.sin(p*Math.PI*4)*130;
    mesh.position.set(Math.sin(az)*radius,y,-Math.cos(az)*radius);
    // Face inward toward the valley and flip smoothly when turning back
    mesh.lookAt(0,y-120,0);
    const goingRight=Math.cos(p*Math.PI*2)>0;
    mesh.scale.set(goingRight?-1:1,1,1);
    // Fade subtly near turn-around edges so the motion feels dreamy & continuous
    const turnFade=Math.min(1,Math.abs(Math.cos(p*Math.PI*2))*3.2);
    mat.uniforms.uOpacity.value=.76*(.25+.75*turnFade);
  }

  update(0);
  return {update};
};
