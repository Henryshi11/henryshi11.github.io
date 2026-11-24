/* A single world-fixed landmark on the north rim. The transparent painting is
   the original White City: the great crossing, its terraces and both spires.
   The top of the spires and the sky in the arch are part of its silhouette. */
globalThis.RideCityVista=function(T,scene){
  'use strict';
  const textureUrl='art/city-matte.webp';
  const angle=Math.PI/180;
  const columns=60,rows=36,positions=[],uv=[],indices=[];
  // Project from the meadow. The city face stands behind the lower western
  // terraces, allowing the latter to slide a little faster when riding across
  // the basin, without screen-relative motion or a camera-facing rotation.
  for(let j=0;j<=rows;j++){
    const v=j/rows;
    for(let i=0;i<=columns;i++){
      const u=i/columns;
      const azimuth=((u-.647)*58+10.5)*angle;
      const western=Math.exp(-Math.pow((u-.25)/.265,2));
      const foreground=1-T.MathUtils.smoothstep(v,.29,.62);
      const radius=3280-355*western-260*foreground+96*Math.cos((u-.68)*2.65);
      // Lower slightly so the luminous white-and-cobalt city rises straight from the sunlit horizon without muddy lower skirts.
      positions.push(radius*Math.sin(azimuth),radius*(v-.385)*1.24,-radius*Math.cos(azimuth));
      uv.push(u,v);
      if(i<columns&&j<rows){
        const a=j*(columns+1)+i,b=a+columns+1;
        indices.push(a,a+1,b+1,a,b+1,b);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return new Promise(resolve=>{
    new T.TextureLoader().load(textureUrl,map=>{
      map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
      const material=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.FrontSide,
        toneMapped:false,fog:false,alphaTest:.016});
      material.blending=T.CustomBlending;material.blendSrc=T.SrcAlphaFactor;material.blendDst=T.OneMinusSrcAlphaFactor;
      material.blendSrcAlpha=T.ZeroFactor;material.blendDstAlpha=T.OneFactor;
      material.onBeforeCompile=shader=>{
        // Retain the cobalt ambient shadows in the original print, while
        // allowing the white masonry to take on the distant blue air at its foot.
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
          #include <color_fragment>
          // AAA high-contrast anime monument lighting in TRUE Linear RGB:
          // Deep royal ultramarine-cobalt shadows + blazing HDR alabaster-white sunlit towers!
          float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          float lowerFoothill=1.-smoothstep(.26,.45,vMapUv.y);
          float greenness=clamp((diffuseColor.g-max(diffuseColor.r,diffuseColor.b))*3.2,0.,1.);
          vec3 deepCobalt=vec3(.028,.092,.62);
          vec3 radiantAlabaster=vec3(1.26,1.23,1.16);
          vec3 sculpted=mix(deepCobalt,radiantAlabaster,smoothstep(.06,.68,lum));
          diffuseColor.rgb=mix(diffuseColor.rgb*vec3(1.12,1.10,1.08),sculpted,.46+.48*lowerFoothill+.38*greenness);
          // Push pure sunlit tower faces into HDR bloom range
          diffuseColor.rgb+=vec3(.18,.16,.11)*smoothstep(.58,.95,lum)*(1.-lowerFoothill);
          vec3 skyScatter=mix(vec3(.22,.48,.94),vec3(.055,.21,.86),smoothstep(.25,.85,vMapUv.y));
          float air=.025+.11*(1.-smoothstep(.28,.72,vMapUv.y))+.34*lowerFoothill;
          diffuseColor.rgb=mix(diffuseColor.rgb,skyScatter,clamp(air,0.,.72));
          float baseFade=smoothstep(.27,.37,vMapUv.y);
          diffuseColor.a*=baseFade*smoothstep(.002,.04,min(vMapUv.x,1.-vMapUv.x));`);
      };
      material.customProgramCacheKey=()=>'north-great-arch';
      globalThis.RideWeather?.shadeMaterial(T,material);
      const city=new T.Mesh(geometry,material);
      city.name='The White City and its great crossing';city.renderOrder=-5;scene.add(city);
      resolve(true);
    },undefined,()=>{geometry.dispose();resolve(false);});
  });
};
