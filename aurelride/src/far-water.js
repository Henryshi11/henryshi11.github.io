/* A flow map for the painted southern gorge. Coordinates are measured on a
   1250 × 516 copy of the atlas, from its upper-left corner. Every strip follows
   a visible stream over its own ledge. Dry gaps keep the rock between them. */
(function(root){
  'use strict';
  const W=1250,H=516;
  const curtains=[
    // Snowmelt on the far western terraces.
    [[185,235,246],[194,234,246],[209,230,244],[218,229,244]],
    [[185,249,259],[197,248,259],[211,245,257],[219,245,257]],
    [[190,305,312],[207,307,318],[218,309,319]],
    [[197,337,344],[213,338,345],[219,338,345]],
    [[198,347,355],[210,347,353],[217,345,352]],
    [[198,359,369],[208,359,367],[217,357,365]],
    [[232,280,289],[239,278,288],[245,275,287]],
    [[232,292,304],[238,289,302],[246,286,299]],
    [[231,307,316],[238,305,313],[246,302,311]],
    [[235,350,357],[245,350,357],[253,350,357]],
    // The high spring below the upper eastern palace.
    [[83,1003,1014],[99,1000,1012],[128,995,1009],[151,993,1008],[166,990,1007]],
    [[81,1023,1046],[95,1020,1045],[120,1017,1044],[145,1015,1041],[154,1012,1038]],
    [[78,1071,1088],[94,1073,1089],[130,1073,1091],[151,1071,1087]],
    // A descending series of openings in the rear limestone wall.
    [[149,780,800],[168,783,804],[198,783,805],[219,779,803],[231,777,801]],
    [[150,809,817],[168,807,818],[197,807,819],[221,805,821],[234,804,822]],
    [[148,828,842],[170,823,839],[200,820,837],[224,818,837],[233,816,836]],
    [[144,847,856],[170,843,854],[193,840,854],[217,836,852],[227,834,850]],
    [[127,873,902],[142,867,901],[178,858,897],[205,854,891],[219,850,886]],
    [[112,913,922],[145,906,916],[180,901,912],[207,900,910]],
    [[104,925,936],[120,920,939],[164,916,941],[189,913,940],[200,911,936]],
    // The large foreground drop on the right, separated by dark stone ribs.
    [[221,927,936],[240,922,935],[277,918,933],[317,917,934],[348,916,935]],
    [[215,956,999],[232,949,996],[263,944,994],[305,941,990],[340,936,985],[352,932,979]],
    [[212,1009,1019],[236,1006,1016],[280,1003,1013],[322,1001,1012],[346,999,1010]],
    [[212,1028,1047],[230,1023,1047],[268,1020,1047],[314,1017,1044],[340,1014,1040]],
    // Overhanging foreground shelves; each lip, fall and landing is distinct.
    [[245,850,877],[252,844,873],[272,839,865],[282,836,862]],
    [[248,880,894],[260,874,891],[280,870,888]],
    [[260,731,752],[272,724,749],[292,720,745],[305,716,741]],
    [[259,754,795],[275,748,791],[295,745,785],[305,741,782]],
    [[257,800,809],[277,795,804],[297,792,801],[305,791,799]],
    [[286,844,860],[300,842,857],[334,838,854],[363,835,851],[371,832,850]],
    [[284,871,884],[297,873,889],[328,872,894],[356,870,894],[370,868,893]],
    [[316,704,719],[332,696,717],[352,691,712],[371,687,709]],
    [[312,725,761],[327,717,755],[351,712,751],[371,708,746]],
    [[311,765,781],[328,758,776],[350,755,774],[371,750,771]],
    [[311,798,810],[325,793,807],[354,792,804],[374,789,802]]
  ];
  // Animated spray stays within the white toes of the falls. The long, low
  // spans trace the turquoise outlet, stopping at islands and the shoreline.
  const pools=[
    [239,220,10,3],[316,220,8,2],[345,219,10,2],[295,247,17,2],
    [788,233,25,10],[819,235,23,8],[866,216,31,7],[924,200,23,7],
    [1005,159,14,7],[1024,151,16,6],
    [740,305,25,5],[776,305,19,5],[864,280,24,4],
    [721,370,43,9],[779,374,18,6],[840,368,23,8],[889,366,31,8],
    [948,351,33,9],[1023,340,25,7]
  ];
  const reaches=[
    [[376,687,880],[384,673,902],[389,666,886]],
    [[388,709,831],[395,701,815],[401,710,782]],
    [[390,600,653],[398,620,705],[402,637,700]],
    [[357,256,291],[362,266,326],[367,287,330]],
    [[367,318,351],[371,336,380],[376,341,382]]
  ];
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function smooth(a,b,n){const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);}
  function flowMap(T){
    const data=new Uint8Array(W*H*4);
    function writeDrops(rows,waterfall){
      const y0=rows[0][0],y1=rows[rows.length-1][0],height=y1-y0;
      const ledgeWidth=rows[0][2]-rows[0][1];
      for(let j=0;j+1<rows.length;j++){
        const a=rows[j],b=rows[j+1];
        for(let y=a[0];y<b[0];y++){
          const q=(y+.5-a[0])/(b[0]-a[0]),l=a[1]+(b[1]-a[1])*q,r=a[2]+(b[2]-a[2])*q;
          const station=(y+.5-y0)/height;
          for(let x=Math.floor(l);x<Math.ceil(r);x++){
            const edge=Math.min(x+.5-l,r-x-.5),pixel=4*((H-1-y)*W+x);
            const coverage=smooth(0,waterfall?1.5:2,edge)*
              smooth(0,waterfall?.045:.16,station)*(1-smooth(waterfall?.95:.81,1,station));
            if(waterfall){
              if(coverage*255<=data[pixel])continue;
              data[pixel]=Math.round(coverage*255);
              data[pixel+1]=Math.round(255*clamp((x+.5-l)/(r-l)*ledgeWidth/52,0,1));
              data[pixel+2]=Math.round(255*station);
            }else{
              data[pixel+3]=Math.max(data[pixel+3],Math.round(125*coverage));
            }
          }
        }
      }
    }
    for(const strip of curtains)writeDrops(strip,true);
    for(const span of reaches)writeDrops(span,false);
    for(const [cx,cy,rx,ry] of pools){
      for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){
        const r=Math.hypot((x+.5-cx)/rx,(y+.5-cy)/ry),i=4*((H-1-y)*W+x);
        const power=1-smooth(.26,1,r);
        if(power>0)data[i+3]=Math.max(data[i+3],Math.round(255*power));
      }
    }
    const tex=new T.DataTexture(data,W,H,T.RGBAFormat);
    tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;
    tex.anisotropy=4;tex.needsUpdate=true;tex.name='Southern gorge watercourses';
    return tex;
  }
  const shaderSource=`
    uniform sampler2D paintedWatercourses;
    uniform float paintedWaterTime;
    float gorgeHash(vec2 p){
      vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
    }
    float gorgeNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(gorgeHash(i),gorgeHash(i+vec2(1.,0.)),f.x),
                 mix(gorgeHash(i+vec2(0.,1.)),gorgeHash(i+1.),f.x),f.y);
    }
    vec3 animateGorgeWater(vec3 paint,vec2 uv){
      vec4 flow=texture2D(paintedWatercourses,uv);
      if(max(flow.r,flow.a)<.014)return paint;
      float time=paintedWaterTime;
      vec2 pixel=uv*vec2(1250.,516.);
      // Independent streams grow longer streaks as they accelerate. Their
      // cross-stream coordinates interpolate between hand-surveyed banks.
      if(flow.r>.014){
        float station=(sqrt(.17+.83*flow.b)-.4123)*1.70;
        float width=flow.g*41.;
        float lane=gorgeNoise(vec2(width*.31,pixel.y*.018));
        float sheets=gorgeNoise(vec2(width*.30+lane*.41,station*8.2-time*2.65+lane*2.));
        float strands=gorgeNoise(vec2(width*1.07,station*16.-time*5.08+sheets*.63));
        float water=.70*sheets+.30*strands;
        float daylight=dot(paint,vec3(.22,.67,.11));
        vec3 shadow=paint*vec3(.56,.73,.83);
        vec3 sun=mix(paint,vec3(.92,.985,.977),.15+.48*daylight);
        vec3 moving=mix(shadow,sun,smoothstep(.22,.76,water));
        paint=mix(paint,moving,flow.r*.89);
      }
      if(flow.a>.014){
        float puffs=gorgeNoise(vec2(pixel.x*.16-time*.52,pixel.y*.23-time*.63));
        float eddies=gorgeNoise(vec2(pixel.x*.065+time*.51,pixel.y*.48+puffs));
        vec3 moving=mix(paint*vec3(.67,.83,.85),mix(paint,vec3(.85,.99,.96),.59),
                        smoothstep(.25,.74,.6*puffs+.4*eddies));
        paint=mix(paint,moving,flow.a*.84);
        // Only impact pools occupy the upper half of the spray channel.
        // A slow veil rises there while the smaller foam eddies move sideways
        // along the painted outlet. Dark rock outside these toe masks stays dry.
        float toe=smoothstep(.50,.92,flow.a);
        float plume=gorgeNoise(vec2(pixel.x*.069-time*.34,pixel.y*.102-time*1.04));
        float veil=toe*smoothstep(.34,.74,plume)*(.12+.15*puffs);
        paint=mix(paint,vec3(.87,.967,.962),veil);
      }
      return paint;
    }`;
  function attach(T,material,key,clock){
    if(key!=='range')return true;
    const map=flowMap(T),previous=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,renderer){
      previous.call(this,shader,renderer);
      shader.uniforms.paintedWatercourses={value:map};shader.uniforms.paintedWaterTime=clock;
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+shaderSource)
        .replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=animateGorgeWater(diffuseColor.rgb,vMapUv);');
    };
    material.customProgramCacheKey=()=>priorKey+' / animated southern water';
    return true;
  }
  root.RideFarWater={attach};
})(globalThis);
