/* A fine section of the rideable surface follows the cyclist. Vertices stay
   anchored to world coordinates. Only newly exposed strips resample the hill. */
globalThis.RideTerrainDetail=function(T,scene,material,rows,height,soil){
  'use strict';
  const step=1.25,half=56,side=half*2+1,count=side*side,snap=8;
  const ground=new T.BufferGeometry();
  function attribute(name,size){
    const a=new T.BufferAttribute(new Float32Array(count*size),size).setUsage(T.DynamicDrawUsage);
    ground.setAttribute(name,a);return a;
  }
  const positions=attribute('position',3),normals=attribute('normal',3),zones=attribute('aZone',4),coarseY=attribute('aCoarseY',1);
  const indices=new T.BufferAttribute(new Uint16Array(half*half*24),1).setUsage(T.DynamicDrawUsage);
  ground.setIndex(indices);
  const local=new T.ShaderMaterial({uniforms:material.uniforms,vertexShader:material.vertexShader,
    fragmentShader:material.fragmentShader,defines:{LOCAL_MEADOW:1}});
  const mesh=new T.Mesh(ground,local);mesh.name='Ground beneath the blades';mesh.frustumCulled=false;scene.add(mesh);
  const slot=(x,z)=>((z%side+side)%side)*side+(x%side+side)%side;
  const pixels=soil.uMeadowHeights.value.image.data;
  let priorX=Infinity,priorZ=Infinity;

  function refresh(x,z){
    material.uniforms.uGroundCenter.value.set(x,z);
    const cx=Math.round(x/(snap*step))*snap,cz=Math.round(z/(snap*step))*snap;
    if(cx===priorX&&cz===priorZ)return;
    let n=0;
    for(let iz=cz-half;iz<=cz+half;iz++){
      const wz=iz*step;
      const river=RideWorld.river(wz);
      // Meadow rows follow the river at variable x, but are horizontal in z.
      let lo=0,hi=rows.length-1;
      while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][0][2]<=wz)lo=m;else hi=m;}
      const south=rows[lo],north=rows[hi];
      const fz=(wz-south[0][2])/(north[0][2]-south[0][2]);
      let column=0;
      for(let ix=cx-half;ix<=cx+half;ix++){
        const v=slot(ix,iz);
        if(ix<cx+half&&iz<cz+half){
          const right=slot(ix+1,iz),up=slot(ix,iz+1),diagonal=slot(ix+1,iz+1);
          indices.array[n++]=v;indices.array[n++]=up;indices.array[n++]=right;
          indices.array[n++]=right;indices.array[n++]=up;indices.array[n++]=diagonal;
        }
        if(Math.abs(ix-priorX)<=half&&Math.abs(iz-priorZ)<=half)continue;
        const wx=ix*step;
        while(column<south.length-2&&south[column+1][0]+fz*(north[column+1][0]-south[column+1][0])<wx)column++;
        const a=south[column],b=south[column+1],c=north[column],d=north[column+1];
        const splitX=b[0]+fz*(c[0]-b[0]);
        // Reproduce the actual triangle heights at the outer transition,
        // including trapezoids drawn around the winding banks.
        const coarse=wx<=splitX?a[1]+fz*(c[1]-a[1])+(b[1]-a[1])*(wx-a[0]-fz*(c[0]-a[0]))/(b[0]-a[0])
          :b[1]+fz*(c[1]-b[1])+(d[1]-c[1])*(wx-splitX)/(d[0]-c[0]);
        const surface=height(wx,wz);
        positions.setXYZ(v,wx,surface,wz);coarseY.setX(v,coarse);
        const pixel=4*((iz&127)*128+(ix&127));
        const fineCode=Math.round((surface+64)*256),coarseCode=Math.round((coarse+64)*256);
        pixels[pixel]=fineCode>>>8;pixels[pixel+1]=fineCode&255;
        pixels[pixel+2]=coarseCode>>>8;pixels[pixel+3]=coarseCode&255;
        const dx=height(wx+.5,wz)-height(wx-.5,wz),dz=height(wx,wz+.5)-height(wx,wz-.5);
        const len=Math.hypot(dx,1,dz);normals.setXYZ(v,-dx/len,1/len,-dz/len);
        const biome=RideWorld.zones(wx,wz);zones.setXYZW(v,biome.flowers,biome.river,biome.plateau,Math.abs(wx-river.x)-river.halfWidth);
      }
    }
    for(const a of [positions,normals,zones,coarseY,indices])a.needsUpdate=true;
    soil.uMeadowHeights.value.needsUpdate=true;
    priorX=cx;priorZ=cz;
  }
  return refresh;
};
// The botanical shaders read the same fine and distant surfaces. Both fit in
// two bytes over this valley's height range, with a quantization of 3.9 mm.
RideTerrainDetail.createUniforms=function(T){
  const map=new T.DataTexture(new Uint8Array(128*128*4),128,128,T.RGBAFormat);
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.minFilter=map.magFilter=T.LinearFilter;
  map.generateMipmaps=false;map.needsUpdate=true;
  return {uMeadowHeights:{value:map},uGroundCenter:{value:new T.Vector2()}};
};
