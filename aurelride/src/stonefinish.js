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
        // Guarantee outward-facing normal toward the viewer even on DoubleSide quads!
        if(dot(stoneNormal,cameraPosition-dressedStonePoint)<0.)stoneNormal=-stoneNormal;
        float stoneSun=dot(stoneNormal,normalize(vec3(.55,.62,.56)));
        float value=${colorLine};
        // True Linear-RGB AAA anime chiaroscuro: deep royal ultramarine-cobalt shadow flank
        // vs crisp sunlit warm alabaster top deck, southeast faces & parapet rims!
        float exposure=smoothstep(-.10,.28,stoneSun);
        float topRim=smoothstep(.65,.95,stoneNormal.y);
        exposure=max(exposure,topRim*.94);
        float dressed=smoothstep(.035,.76,value);
        float recess=smoothstep(.045,.32,value);
        vec3 cobaltShadow=mix(vec3(.006,.018,.15),vec3(.024,.076,.45),dressed);
        vec3 sunlitAlabaster=mix(vec3(.24,.30,.52),vec3(1.06,1.04,.98),dressed);
        vec3 finished=mix(cobaltShadow,sunlitAlabaster,exposure);
        finished*=mix(.42,1.0,recess)*(.85+.20*sqrt(max(.0,value)));
        finished+=vec3(.09,.08,.05)*topRim*exposure*smoothstep(.50,.92,value);
        diffuseColor.rgb=mix(diffuseColor.rgb,finished,.95);`
      );
    };
    material.customProgramCacheKey = () => key + '-dressed-limestone-3';
  }

  globalThis.RideStoneFinish = {limestone};
})();
