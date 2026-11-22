(() => {
  const M = Marketplace;
  const radians = degrees => degrees * Math.PI / 180;
  function distance(a, b) {
    const lat = radians(b[0] - a[0]), lon = radians(b[1] - a[1]);
    const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(lon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }
  const point = barangay => window.SanPedroGeo?.barangays[barangay]?.point || null;
  function nearby(rows, barangay) {
    const origin = point(barangay);
    return rows.map(row => {
      const area = M.barangayOf(row.profile), target = point(area);
      return { row, area, distance: origin && target ? distance(origin, target) : null };
    }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.row.name.localeCompare(b.row.name));
  }
  function distanceLabel(area, home, km) {
    if (area === home && home) return 'Your barangay';
    return km == null ? area : `About ${km.toFixed(1)} km from your barangay`;
  }
  function avatar(name, photo) {
    const safe = M.image(photo);
    const initials = String(name || '?').trim().split(/\s+/).map(word => word[0]).slice(0, 2).join('');
    return safe ? `<img src="${M.escape(safe)}" alt="" loading="lazy">` : `<span>${M.escape(initials)}</span>`;
  }
  function create({ profile, onSelect }) {
    const root = document.querySelector('#freelancer-map');
    const status = document.querySelector('#map-status');
    const list = document.querySelector('#nearby-freelancers');
    const home = profile.client_profile?.barangay || '';
    const origin = point(home);
    const L = window.L, geo = window.SanPedroGeo, streets = window.SanPedroStreets;
    let map, markers, signature = '', selected = '', rows = [], hover;
    const label = document.querySelector('#map-home-label');
    label.textContent = origin ? `Near your saved location: ${home}` : 'Add your barangay to your profile to find nearby creatives.';
    document.querySelector('#map-my-area').disabled = !origin;
    function showArea(area) {
      if (!map) return;
      const center = point(area);
      if (center) map.setView(center, 15, { animate: false });
      else map.fitBounds(geo.bounds, { padding: [12, 12], animate: false });
    }
    function popup(area, people) {
      return `<div class="map-popup"><strong>${M.escape(area)}</strong><p>Approximate barangay location</p><div class="map-popup-people">${people.map(person => {
        const p = person.profile, km = origin ? distance(origin, point(area)) : null;
        return `<a href="freelancer-view.html?id=${encodeURIComponent(person.id)}"><span class="map-person-avatar">${avatar(person.name, p.photoData)}</span><span><b>${M.escape(person.name)}</b><small>${M.escape((p.services || []).join(', '))}</small><small>${M.escape(distanceLabel(area, home, km))}</small><em>View profile →</em></span></a>`;
      }).join('')}</div></div>`;
    }
    function renderNearby() {
      const people = nearby(rows, home).slice(0, 5);
      list.innerHTML = people.length ? people.map(({row, area, distance:km}) => `<a class="nearby-person" href="freelancer-view.html?id=${encodeURIComponent(row.id)}"><span class="map-person-avatar">${avatar(row.name,row.profile.photoData)}</span><span><b>${M.escape(row.name)}</b><small>${M.escape(area)}</small><small>${M.escape(distanceLabel(area,home,km))}</small></span><span aria-hidden="true">↗</span></a>`).join('') : '<p class="map-empty">No matching freelancers in this area. Try All San Pedro or another service.</p>';
    }
    if (!L || !geo || !streets) {
      root.hidden = true;
      status.textContent = 'The map could not load. You can still browse freelancers below.';
    } else {
      map = L.map(root, { maxBounds: streets.coverageBounds, maxBoundsViscosity: 1, minZoom: 12, maxZoom: 19, preferCanvas: true, scrollWheelZoom: true, zoomAnimation: false, fadeAnimation: false });
      map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · Local street map');
      const featureColors = {residential:'#e8e6e1',commercial:'#e6e0e5',green:'#d7e5c5',water:'#aad5e6'};
      for (const [type,color] of Object.entries(featureColors)) {
        const polygons = streets.features.filter(feature => feature.type === type).map(feature => feature.paths);
        L.polygon(polygons, {stroke:false,fillColor:color,fillOpacity:1,interactive:false}).addTo(map);
      }
      L.polyline(streets.features.filter(feature => feature.type === 'waterway').flatMap(feature => feature.paths), {color:'#aad5e6',weight:3,interactive:false}).addTo(map);
      const majorTypes = ['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link'];
      // Batch paths by style so the complete network needs only a few canvas layers.
      const roadGroups = new Map();
      streets.roads.forEach(road => {
        const type = majorTypes.includes(road.type) ? 'major' : ['footway','path','steps','pedestrian'].includes(road.type) ? 'walking' : 'local';
        if (!roadGroups.has(type)) roadGroups.set(type,[]);
        roadGroups.get(type).push(road.path);
      });
      for (const type of ['local','walking','major']) {
        const paths = roadGroups.get(type) || [], major = type === 'major', walking = type === 'walking';
        if (!walking) L.polyline(paths, {color:major?'#c3b394':'#cccac4',weight:major?6:3.5,interactive:false}).addTo(map);
        L.polyline(paths, {color:major?'#ffe3a0':walking?'#a6b891':'#ffffff',weight:major?4:walking?1:2,dashArray:walking?'3 4':null,interactive:false}).addTo(map);
      }
      map.createPane('streetNames').style.zIndex = 450;
      const streetLabels = L.layerGroup().addTo(map);
      function labelStreets() {
        streetLabels.clearLayers();
        const names = new Set(), bounds = map.getBounds(), detailed = map.getZoom() >= 16;
        const candidates = streets.roads.filter(road => road.name && (detailed || majorTypes.includes(road.type))).sort((a,b) => b.path.length-a.path.length);
        for (const road of candidates) {
          const center = road.path[Math.floor(road.path.length/2)];
          if (names.has(road.name) || !bounds.contains(center)) continue;
          names.add(road.name);
          L.marker(center, {pane:'streetNames',interactive:false,keyboard:false,icon:L.divIcon({className:'map-street-name',html:M.escape(road.name),iconSize:[120,16],iconAnchor:[60,8]})}).addTo(streetLabels);
          if (names.size >= (detailed ? 45 : 12)) break;
        }
      }
      map.on('moveend',labelStreets);
      Object.entries(geo.barangays).forEach(([name,area]) => L.marker(area.point, {
        pane:'streetNames',interactive:false,keyboard:false,
        icon:L.divIcon({className:'map-barangay-name',html:M.escape(name),iconSize:[100,24],iconAnchor:[50,-24]})
      }).addTo(map));
      L.marker([14.398,121.106], {interactive:false,keyboard:false,icon:L.divIcon({className:'map-water-name',html:'Laguna de Bay',iconSize:[140,24],iconAnchor:[70,12]})}).addTo(map);
      // Keep the geography continuous across the city boundary; only profile pins are San Pedro-specific.
      markers = L.layerGroup().addTo(map);
      if (origin) {
        L.marker(origin, {icon:L.divIcon({className:'map-home-marker',html:`<div class="map-person-avatar">${avatar(profile.name,profile.client_profile?.photoData)}</div><b>Your area</b>`,iconSize:[52,68],iconAnchor:[26,34]}),title:`Your saved barangay: ${home}`,zIndexOffset:1000})
          .addTo(map).bindPopup(`<b>Your saved location</b><p>${M.escape(home)}, San Pedro</p><p>Based on your profile, not live GPS.</p><a href="client-profile.html">Update profile location →</a>`);
        map.setView(origin, 14);
      } else showArea('');
      status.textContent = '';
      function resizeMap() {
        if (!root.clientWidth || !root.clientHeight) return;
        map.invalidateSize({pan:false});
        // At the minimum zoom, the viewport must fit INSIDE the downloaded coverage.
        map.setMinZoom(Math.max(12, map.getBoundsZoom(streets.coverageBounds, true)));
        map.panInsideBounds(streets.coverageBounds, {animate:false});
      }
      resizeMap();
      labelStreets();
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resizeMap) : null;
      observer?.observe(root);
      window.addEventListener('pagehide', () => {observer?.disconnect();map.remove();}, {once:true});
    }
    const expand = document.querySelector('#map-expand');
    const frame = document.querySelector('.map-frame');
    function setExpanded(value) {
      frame.classList.toggle('is-expanded',value);
      document.body.classList.toggle('map-expanded',value);
      expand.textContent = value ? 'Close map' : 'Expand map';
      expand.setAttribute('aria-expanded',String(value));
      if (map) map.invalidateSize({pan:false});
    }
    expand.onclick = () => setExpanded(!frame.classList.contains('is-expanded'));
    document.addEventListener('keydown',event => {if(event.key === 'Escape') setExpanded(false);});
    document.querySelector('#map-my-area').onclick = () => {if(origin) {onSelect('');showArea(home);}};
    document.querySelector('#map-city').onclick = () => {onSelect('');showArea('');};
    return {
      update(people, area) {
        const section = document.querySelector('.discovery-map-section');
        section.hidden = Boolean(area);
        if (area) {setExpanded(false);selected = area;return;}
        if (map && selected) map.invalidateSize({pan:false});
        rows = people; renderNearby();
        if (!map) return;
        const nextSignature = JSON.stringify(people.map(row => [row.id,row.name,row.profile]));
        if (signature !== nextSignature) {
          signature = nextSignature; markers.clearLayers();
          const groups = new Map();
          people.forEach(row => {const area = M.barangayOf(row.profile);if(point(area)) groups.set(area,[...(groups.get(area) || []),row]);});
          groups.forEach((people, area) => {
            const shown = people.slice(0,3);
            const isHome = area === home;
            const marker = L.marker(point(area), {
              icon:L.divIcon({className:'map-freelancer-marker',html:`<div class="map-avatar-stack">${shown.map(row => `<span class="map-person-avatar">${avatar(row.name,row.profile.photoData)}</span>`).join('')}</div>`,iconSize:[44 + (shown.length-1)*27,44],iconAnchor:[isHome ? -30 : 22,22]}),
              title:`Freelancers in ${area}: ${people.map(row=>row.name).join(', ')}`,keyboard:true,riseOnHover:true
            });
            marker.addTo(markers).bindPopup(popup(area,people),{maxWidth:310,maxHeight:290});
          });
        }
        if (area !== selected) {selected = area;showArea(area);}
      },
      highlight(area) {
        if(!map || document.querySelector('.discovery-map-section').hidden) return;
        if(hover) {map.removeLayer(hover);hover = null;}
        if(point(area)) hover = L.circleMarker(point(area), {radius:32,color:'#87aa45',weight:2,fillOpacity:0.12,interactive:false}).addTo(map);
      }
    };
  }
  window.DiscoveryMap = {create,point,distance,nearby,distanceLabel};
})();
