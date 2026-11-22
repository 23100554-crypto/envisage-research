// Usage: node build-map.cjs roads-overpass.json land-overpass.json
const fs = require('node:fs');
const path = require('node:path');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8')).elements;
const coordinates = geometry => geometry.map(p => [p.lat, p.lon]);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
function simplify(points) {
  if (points.length < 3) return points;
  const a = points[0], b = points.at(-1), dx = b[0]-a[0], dy = b[1]-a[1], length = dx*dx+dy*dy;
  let maximum = 0, index = 0;
  for (let i = 1; i < points.length-1; i++) {
    const p = points[i], t = length ? Math.max(0, Math.min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) : 0;
    const distance = (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
    if (distance > maximum) { maximum = distance; index = i; }
  }
  return maximum > 0.000015**2 ? [...simplify(points.slice(0,index+1)).slice(0,-1), ...simplify(points.slice(index))] : [a,b];
}
const compact = points => simplify(points).map(p => p.map(n => Number(n.toFixed(6))));
function rings(members) {
  const pending = members.filter(m => m.geometry?.length > 1).map(m => coordinates(m.geometry)), result = [];
  while (pending.length) {
    let ring = pending.pop();
    while (!same(ring[0],ring.at(-1))) {
      const index = pending.findIndex(p => same(ring.at(-1),p[0]) || same(ring.at(-1),p.at(-1)));
      if (index < 0) throw Error('Incomplete water boundary: refusing to invent a closing edge');
      let next = pending.splice(index,1)[0];
      if (!same(ring.at(-1),next[0])) next = next.reverse();
      ring.push(...next.slice(1));
    }
    result.push(compact(ring));
  }
  return result;
}
const roads = read(process.argv[2]).filter(e => e.geometry?.length > 1 && !['proposed','construction'].includes(e.tags?.highway)).map(e => ({id:e.id,name:e.tags?.name || '',type:e.tags.highway,path:compact(coordinates(e.geometry))}));
const features = [];
for (const element of read(process.argv[3])) {
  const tags = element.tags || {};
  const type = tags.natural === 'water' || tags.waterway === 'riverbank' ? 'water' : tags.waterway ? 'waterway' : tags.landuse === 'residential' ? 'residential' : ['industrial','commercial','retail'].includes(tags.landuse) ? 'commercial' : 'green';
  if (element.type === 'relation') {
    const outer = rings(element.members.filter(m => m.role === 'outer'));
    const inner = rings(element.members.filter(m => m.role === 'inner'));
    features.push({id:element.id,name:tags.name || '',type,paths:[...outer,...inner]});
  } else if (element.geometry?.length > 1) {
    const points = coordinates(element.geometry);
    if (type !== 'waterway' && !same(points[0],points.at(-1))) continue;
    features.push({id:element.id,name:tags.name || '',type,paths:[compact(points)]});
  }
}
const data = {source:'https://www.openstreetmap.org/copyright',downloaded:'2026-10-02',license:'ODbL-1.0',coverageBounds:[[14.305,120.995],[14.425,121.16]],roads,features};
fs.writeFileSync(path.join(__dirname,'san-pedro-streets.js'),'// OpenStreetMap contributors, ODbL 1.0. Local streets and geographic context.\nwindow.SanPedroStreets = '+JSON.stringify(data)+';\n');
console.log(JSON.stringify({roads:roads.length,features:features.length}));
