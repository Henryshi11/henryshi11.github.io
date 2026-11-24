/* The southwest gorge uses the original painting and its measured watercourses.
   Only this sweep of the horizon carries the waterfall. */
(function(root){
  'use strict';
  root.RideCascadeVista=function(T,scene){
    const positions=[],uv=[],indices=[];
    const columns=74,rows=18,rad=Math.PI/180;
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const u=i/columns,v=.195+.805*j/rows;
      const angle=(-147+(u-.5)*64)*rad;
      // The outer terraces turn down into the saddle. The basin and its
      // nearer rock toes advance toward the rider below the distant crests.
      const edge=Math.min(u,1-u);
      const t=Math.min(1,edge/.17),shoulder=.60+.40*t*t*(3-2*t);
      const terrace=75*Math.sin(2.5*u+.85)+46*Math.sin(7.3*u-.7);
      const radius=2620+terrace+185*v*v-76*(1-v);
      const h=1410*(v-.215)*shoulder-17;
      positions.push(-100+Math.sin(angle)*radius,h,70-Math.cos(angle)*radius);
      uv.push(u,v);
      if(i<columns&&j<rows){
        const a=j*(columns+1)+i,b=a+1,d=a+columns+1,c=d+1;
        indices.push(a,b,c,a,c,d);
      }
    }
    const geom=new T.BufferGeometry();
    geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geom.setIndex(indices);geom.computeBoundingSphere();
    const weather=root.RideWeather.uniforms(T);
    const material=new T.MeshBasicMaterial({
      fog:false,toneMapped:false,transparent:true,depthWrite:false,alphaTest:.003
    });
    // Leave the screen-space rider mask in the alpha channel intact.
    material.blending=T.CustomBlending;
    material.blendSrc=T.SrcAlphaFactor;material.blendDst=T.OneMinusSrcAlphaFactor;
    material.blendSrcAlpha=T.ZeroFactor;material.blendDstAlpha=T.OneFactor;
    material.onBeforeCompile=program=>{
      program.uniforms.gorgeHaze=weather.uWeatherHaze;
      program.uniforms.gorgeCloud=weather.uWeatherCloud;
      program.vertexShader=program.vertexShader.replace('#include <common>','#include <common>\nvarying float gorgeDistance;')
        .replace('#include <project_vertex>','#include <project_vertex>\ngorgeDistance=length(mvPosition.xyz);');
      program.fragmentShader=program.fragmentShader.replace('#include <common>',
        '#include <common>\nuniform float gorgeHaze,gorgeCloud; varying float gorgeDistance;')
        .replace('#include <alphatest_fragment>',`
          float edge=min(vMapUv.x,1.-vMapUv.x);
          float edgeMix=smoothstep(.002,.074+.019*(1.-vMapUv.y),edge);
          // The actual outlet ends just below the visible line of water;
          // dissolve its banks below that line into the intervening hillside.
          float bank=.205+.085*(1.-smoothstep(.0,.18,edge));
          diffuseColor.a*=edgeMix*smoothstep(bank,bank+.029,vMapUv.y);
          #include <alphatest_fragment>`)
        .replace('#include <color_fragment>',`
          #include <color_fragment>
          float shore=1.-smoothstep(.22,.40,vMapUv.y);
          float scatter=.035+.050*smoothstep(1000.,5200.,gorgeDistance)+.16*shore+.16*gorgeHaze;
          float value=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          // Exaggerated AAA sunlit-white stone & golden-emerald crest highlights vs deep royal-cobalt gorge shadows (Linear RGB)!
          float stoneMask=1.-smoothstep(.03,.20,max(diffuseColor.g-diffuseColor.r,diffuseColor.b-diffuseColor.r));
          vec3 cobaltStone=mix(vec3(.032,.105,.58),vec3(1.22,1.19,1.12),smoothstep(.07,.70,value));
          diffuseColor.rgb=mix(diffuseColor.rgb,cobaltStone,stoneMask*.58);
          // Warm sunlit foliage crowns & deepen cliff-shadow greens to match 3D meadow chiaroscuro
          float foliageMask=smoothstep(.04,.22,diffuseColor.g-max(diffuseColor.r,diffuseColor.b*.85));
          diffuseColor.rgb*=mix(vec3(1.),mix(vec3(.48,.65,.88),vec3(1.22,1.20,.78),smoothstep(.08,.48,value)),foliageMask*.65);
          // Radiant white waterfall foam crest boost into HDR bloom
          diffuseColor.rgb+=vec3(.16,.18,.18)*smoothstep(.65,.96,value);
          diffuseColor.rgb*=mix(vec3(1.),vec3(.76,.83,.92),gorgeCloud);
          vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.06,.22,.86),smoothstep(.20,.82,vMapUv.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,scatter);`);
    };
    root.RideFarWater.attach(T,material,'range',weather.uWeatherTime);
    return new Promise(resolve=>{
      new T.TextureLoader().load('art/cascade-range.webp',texture=>{
        texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;material.map=texture;
        const mesh=new T.Mesh(geom,material);
        mesh.name='Turquoise falls in the southwest gorge';mesh.renderOrder=-3;
        scene.add(mesh);resolve(true);
      },undefined,()=>{geom.dispose();material.dispose();resolve(false);});
    });
  };
})(globalThis);
