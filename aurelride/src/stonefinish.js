/* Directional daylight on the dressed limestone of the aqueduct. */
(() => {
  'use strict';
  const colorLine = 'dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))';

  function limestone(material) {
    const before = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.onBeforeCompile = function (shader, renderer) {
      before.call(this, shader, renderer);
      shader.vertexShader = 'varying vec3 dressedStonePoint;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\ndressedStonePoint=(modelMatrix*vec4(transformed,1.)).xyz;'
      );
      shader.fragmentShader = 'varying vec3 dressedStonePoint;\n' + shader.fragmentShader.replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        // Screen derivatives recover the dressed face, including the sloping
        // corbels and round towers, from the existing batched triangles.
        vec3 stoneCross=cross(dFdx(dressedStonePoint),dFdy(dressedStonePoint));
        vec3 stoneNormal=stoneCross*inversesqrt(max(dot(stoneCross,stoneCross),1.e-12));
        float stoneSun=dot(stoneNormal,vec3(.447,.696,.563));
        float value=${colorLine};
        float exposure=smoothstep(-.67,.70,stoneSun);
        float openFace=smoothstep(.17,.43,value)*(.5+.5*max(0.,-stoneNormal.x));
        exposure+=.36*(1.-exposure)*openFace;
        float dressed=smoothstep(.037,.74,value);
        float recess=smoothstep(.046,.29,value);
        vec3 northLight=mix(vec3(.135,.225,.535),vec3(.68,.78,.96),dressed);
        vec3 ivory=mix(vec3(.40,.45,.60),vec3(.97,.95,.90),dressed);
        vec3 finished=mix(northLight,ivory,exposure);
        // Strong dressed-stone block contrast & deep cobalt mortar cavities so walls never look flat plastic white.
        finished*=mix(.42,1.0,recess)*(.82+.22*sqrt(max(.0,value)));
        diffuseColor.rgb=mix(diffuseColor.rgb,finished,.86);`
      );
    };
    material.customProgramCacheKey = () => key + '-dressed-limestone-3';
  }

  globalThis.RideStoneFinish = {limestone};
})();
