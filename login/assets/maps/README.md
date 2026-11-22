# San Pedro discovery map

The client discovery page uses locally bundled Leaflet 1.9.4 and locally served OpenStreetMap street geometry. It does not request external map tiles, so tile-provider blocks cannot replace the map with an access-blocked image. `san-pedro-streets.js` contains 22,407 street segments and 3,127 geographic features across San Pedro and its surrounding context, exported on October 2, 2026 and simplified to roughly 1.5-metre tolerance. Attribution remains visible on the map. This is a street-data snapshot, not a continuously updated basemap.

`san-pedro.js` contains public geography downloaded on October 2, 2026:
- City outline: https://www.openstreetmap.org/relation/1552543
- Barangay reference points: the bounding-box centers of mapped barangay relations, or place nodes for Maharlika and San Lorenzo Ruiz. Each entry contains its own OpenStreetMap source URL and derivation method.
- Aliases match the names used in the application: GSIS → G.S.I.S., Sampaguita → Sampaguita Village, Pacita I / II → Pacita 1 / 2.

These points are approximate area references. They do not represent users' homes. The map uses only the current client's saved barangay and the public freelancer directory. It never requests GPS, sends private addresses to a geocoder, or loads other clients' profiles. Distances are straight-line estimates between area references, not road distances or travel times.

The map and nearby panel appear only when All San Pedro is selected. Selecting a barangay hides the map and shows the matching profile cards. The street network continues across the city boundary without an exterior mask. Water, parks and land-use areas supply geographic context, including the actual Laguna de Bay shoreline. Only San Pedro freelancer profiles are shown. Resize-aware minimum zoom and bounds keep the viewport inside downloaded coverage. Expand map fills the viewport; Escape closes it. Freelancers in the same barangay share an avatar group; its popup lists all matching profiles. The nearby list and map follow the existing name/service/barangay filters.

Geographic data © OpenStreetMap contributors, licensed under the Open Database License (ODbL): https://www.openstreetmap.org/copyright
Leaflet's license is bundled in `../vendor/leaflet/LICENSE`.

References:
- https://leafletjs.com/reference.html
- https://operations.osmfoundation.org/policies/tiles/

Tests: `node --test tests/discovery-map.test.cjs`; `tests/discovery-map-dom.cjs` exports a DOM test runner accepting LinkeDOM's `parseHTML`. The tests cover coordinate coverage, proximity, avatar grouping, filters, errors, and fallback behavior. A connected browser is still required for visual desktop/mobile verification.

Rebuild the snapshot: `node assets/maps/build-map.cjs roads-overpass.json land-overpass.json`. Export OSM highways and landuse/natural water/wood/scrub/wetland/waterway/park features using Overpass `out geom` for bbox `(14.30,120.99,14.43,121.165)`. Keep full water-relation member geometry so rings close without fabricated shorelines. Rendering batches streets by style to avoid thousands of independent layers.
