/* The meadow and river share an open, two-bank loop. The two crossings use
   the timber deck and the shallow southern ford. */
(() => {
  'use strict';
  const river=globalThis.RideWorld.river;
  const bridge=globalThis.RideTrails.bridge;
  const bank=(z,offset)=>[river(z).x+offset,z];
  const deck=offset=>[bridge.x+offset,bridge.z];

  const meadow=[
    [-761,291],[-773,268],[-788,238],[-805,216],[-818,194],[-828,173],
    [-839,148],[-850,126],[-856,114],[-869,91],[-883,63],[-899,40]
  ];
  const westBank=[
    [-918,4],[-919,-40],[-896,-79],[-853,-116],[-805,-147],[-775,-173],
    bank(-207,-81),bank(-252,-86),bank(-292,-100),[-802,-337],
    [-800,-370],[-787,-393],[-768,-403]
  ];
  // Keep the incoming and outgoing knots level with the narrow bridge.
  const creekCrossing=[deck(-48),deck(-34),deck(-24),deck(0),deck(24),deck(36),deck(55)];
  const eastBank=[
    deck(78),[-618,-393],[-603,-368],bank(-315,87),bank(-254,75),
    bank(-205,76),bank(-157,102),bank(-111,139),[-477,-74],
    [-451,-45],[-438,-15],[-438,12],[-448,35]
  ];
  // The first part of this sweeping bend looks across the wide
  // river. The turn opens out again before either wheel reaches deep water.
  const riverBend=[
    [-472,51],[-498,57],[-516,62],[-530,72],[-539,87],[-541,105],
    bank(132,54),bank(167,68),bank(211,82),bank(257,88),bank(302,75)
  ];
  const ford=[bank(327,56),bank(335,37),bank(335,18),bank(335,0),
    bank(335,-18),bank(335,-40),bank(339,-66)];
  const returnMeadow=[[-676,356],[-702,362],[-725,351],[-745,320]];
  const points=[...meadow,...westBank,...creekCrossing,...eastBank,...riverBend,...ford,...returnMeadow];
  const [[x,z],[nextX,nextZ]]=meadow;
  const landmark={id:'vale',name:'薰衣草谷',x,z,heading:Math.atan2(nextX-x,z-nextZ)};
  const route={id:'vale',name:'花谷与双岸环线',points};

  // The name follows the actual grass valley when a rider leaves the guide.
  function near(x,z){
    return ((x+844)/183)**2+((z-133)/226)**2<1;
  }
  const bloomPoints=[[-100,805],[-137,770],[-181,716],[-202,648],[-180,588],[-134,547],[-59,564],[13,604],
    [67,665],[94,737],[73,818],[11,860],[-49,851]];
  const bloomRoute={id:'bloom',name:'金穗与紫丘环线',points:bloomPoints};
  const bloomLandmark={id:'bloom',name:'金穗花坡',x:-100,z:805,heading:Math.atan2(-37,35)};
  const bloomNear=(x,z)=>((x+60)/290)**2+((z-711)/230)**2<1;
  globalThis.RideVale={route,landmark,near,bloomRoute,bloomLandmark,bloomNear};
})();
