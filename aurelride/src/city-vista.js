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
          // Unify the entire White City into a cohesive luminous alabaster-white + cobalt-blue monument,
          // stripping mismatched muddy green/pink lower foothills cleanly into distant blue-white horizon mist.
          float lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));
          float lowerFoothill=1.-smoothstep(.26,.46,vMapUv.y);
          float greenness=clamp((diffuseColor.g-max(diffuseColor.r,diffuseColor.b))*3.0,0.,1.);
          vec3 cleanWhite=mix(vec3(.23,.43,.85),vec3(1.04,1.05,1.08),smoothstep(.15,.82,lum));
          diffuseColor.rgb=mix(diffuseColor.rgb*vec3(1.06,1.07,1.10),cleanWhite,.38+.52*lowerFoothill+.35*greenness);
          float air=.032+.12*(1.-smoothstep(.28,.72,vMapUv.y))+.30*lowerFoothill;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.60,.91),clamp(air,0.,.72));
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
