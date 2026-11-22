const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
 const context={window:{},document:{getElementById:()=>null},URL,Intl,Date};
 for(const file of ['marketplace.js','assets/maps/san-pedro.js','clients/discovery-map.js']) {
  if(context.window.Marketplace) context.Marketplace=context.window.Marketplace;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 }
 return {geo:context.window.SanPedroGeo,map:context.window.DiscoveryMap,market:context.Marketplace};
}
function inside(point,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j];if((a[0]>point[0])!==(b[0]>point[0]) && point[1]<(b[1]-a[1])*(point[0]-a[0])/(b[0]-a[0])+a[1])yes=!yes;}return yes;}
test('all supported barangays have sourced reference points inside San Pedro',()=>{
 const {geo,map,market}=setup();
 assert.equal(Object.keys(geo.barangays).length,27);
 for(const name of market.barangays){assert.ok(map.point(name),name);assert.match(geo.barangays[name].source,/^https:\/\/www.openstreetmap.org\/(node|relation)\/\d+$/);assert.ok(inside(map.point(name),geo.boundary),name+' outside city');}
 assert.equal(map.point('Metro Manila'),null);
});
test('nearby sorting uses the saved barangay and treats unknown locations as unknown',()=>{
 const {map,market}=setup();
 const rows=['Landayan','Pacita 1','Pacita 2'].map((b,i)=>({id:String(i),name:b,profile:{location:market.location(b)}}));
 const results=map.nearby(rows,'Pacita 1');
 assert.equal(results[0].area,'Pacita 1');assert.equal(results[0].distance,0);
 assert.ok(results[1].distance<=results[2].distance);
 assert.equal(map.distanceLabel('Pacita 1','Pacita 1',0),'Your barangay');
 assert.match(map.distanceLabel('Landayan','Pacita 1',2),/About 2.0 km/);
 assert.ok(map.nearby(rows,'Unknown').every(r=>r.distance===null));
});
test('distance calculation is symmetric and in kilometres',()=>{
 const {map}=setup();const a=map.point('Pacita 1'),b=map.point('Landayan');
 assert.equal(map.distance(a,a),0);assert.ok(Math.abs(map.distance(a,b)-map.distance(b,a))<1e-10);assert.ok(map.distance(a,b)>0&&map.distance(a,b)<10);
});
test('street context extends beyond the city and includes Cuyab, San Roque and the lake',()=>{
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/maps/san-pedro-streets.js'),'utf8'),context);
 const streets=context.window.SanPedroStreets;
 const {geo,map}=setup();
 for(const name of ['Cuyab','San Roque']) {
  const nearby=streets.roads.filter(road=>road.path.some(p=>map.distance(p,map.point(name))<0.7));
  assert.ok(nearby.length>20,name+' has mapped streets');
 }
 assert.ok(streets.roads.some(road=>road.path.some(p=>!inside(p,geo.boundary))),'retain streets outside city boundary to prevent cutout edges');
 const lake=streets.features.find(feature=>feature.name==='Laguna de Bay');
 assert.equal(lake.type,'water');
 assert.ok(lake.paths.some(ring=>inside([14.398,121.106],ring)),'lake label must be over actual mapped water');
 for(const feature of streets.features.filter(feature=>feature.type!=='waterway')) {
  for(const ring of feature.paths) assert.deepEqual(ring[0],ring.at(-1),'area geometry must have complete boundaries');
 }
});
