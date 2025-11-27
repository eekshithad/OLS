
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
});
const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  subdomains:['mt0','mt1','mt2','mt3'],
  attribution: '&copy; Google Satellite'
});

const initialCenter = [28.5562, 77.0995];

const map = L.map('map2d', {
  center: initialCenter,
  layers: [osm]
});

const baseMaps = {
  "OpenStreetMap": osm,
  "Satellite": satellite
};

let overlayMaps = {};

map.createPane('capsulePane');
map.getPane('capsulePane').style.zIndex = 200; // lower than default pane (400)
map.getPane('capsulePane').style.pointerEvents = 'none'; // capsules won't block clicks

const centerA = [77.0995, 28.5562]; // [lng, lat]
const centerB = [77.0868, 28.5566]; // [lng, lat]

function makeCapsule(radiusKm){

  const circleA = turf.circle(centerA, radiusKm, {steps:64, units:'kilometers'});
  const circleB = turf.circle(centerB, radiusKm, {steps:64, units:'kilometers'});
  const bearingAB = turf.bearing(turf.point(centerA), turf.point(centerB));
  const leftA = turf.destination(centerA, radiusKm, bearingAB + 90, {units:'kilometers'}).geometry.coordinates;
  const rightA = turf.destination(centerA, radiusKm, bearingAB - 90, {units:'kilometers'}).geometry.coordinates;
  const leftB = turf.destination(centerB, radiusKm, bearingAB + 90, {units:'kilometers'}).geometry.coordinates;
  const rightB = turf.destination(centerB, radiusKm, bearingAB - 90, {units:'kilometers'}).geometry.coordinates;

  const capsuleBody = turf.polygon([[leftA, leftB, rightB, rightA, leftA]]);
  const merged = turf.dissolve(turf.featureCollection([circleA, circleB, capsuleBody]));
  return merged.features[0];
}

let buildingLayer = null;
let buildingsGeo = null; 
const capsuleLayers = {};

fetch('heights_building.geojson')
  .then(r => r.json())
  .then(data => {
    data.features.forEach(f => {
      f.properties._center = turf.centerOfMass(f).geometry.coordinates; 
    });
    buildingsGeo = data;

    buildingLayer = L.geoJSON(data, {
      style: ()=>({color:'blue', weight:1, fillOpacity:0.6}),
      onEachFeature: (feature, layer) => {
        const h = feature.properties.mean_height_m ?? 'N/A';
        layer.bindPopup(`<b>Height Of Building:</b> ${h} m`);
        layer.on('click', ()=> layer.openPopup());
      },
      preferCanvas: true
    }).addTo(map);

    overlayMaps["Buildings"] = buildingLayer;
    L.control.layers(baseMaps, overlayMaps).addTo(map);

    const bounds = buildingLayer.getBounds();
    if(bounds.isValid()){
      map.fitBounds(bounds, { maxZoom: 19, padding: [40, 40] });
      map.setZoom(14);   // <--- force zoom you want
    }
  })
  .catch(err => {
    console.error("Failed to load GeoJSON:", err);
    alert("Failed to load Delhi_Buildings.geojson — check path/filename.");
  });

document.querySelectorAll('.capsuleChk').forEach(cb => {
  cb.addEventListener('change', () => {
    const r = parseFloat(cb.value);
    if(cb.checked) {
      const cap = makeCapsule(r);
      const layer = L.geoJSON(cap, {
        style: { color: 'green', weight: 2, fillOpacity: 0.12 },
        pane: 'capsulePane'
      }).addTo(map);
      capsuleLayers[r] = layer;
    } else {
      if(capsuleLayers[r]) {
        map.removeLayer(capsuleLayers[r]);
        delete capsuleLayers[r];
      }
    }
    recolorBuildings();
  });
});

function recolorBuildings(){
  if(!buildingLayer || !buildingsGeo) return;
  const active = Object.keys(capsuleLayers).map(Number);
  const thresholds = {0.5:5, 1:7.5, 2:10}; // m

  buildingLayer.eachLayer(layer => {
    const props = layer.feature.properties;
    const h = props.mean_height_m || 0;
    const centerLngLat = props._center; // [lng, lat]
    let isRed = false;

    for(const r of active){
      const capsuleGeo = capsuleLayers[r].toGeoJSON();
      const capsulePoly = capsuleGeo.features ? capsuleGeo.features[0] : capsuleGeo;
      // fast bbox test using turf.bbox
      const [minX,minY,maxX,maxY] = turf.bbox(capsulePoly);
      const lng = centerLngLat[0], lat = centerLngLat[1];
      if(lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
      if(turf.booleanPointInPolygon([lng,lat], capsulePoly)){
        if(h > thresholds[r]) { isRed = true; break; }
      }
    }

    layer.setStyle({ color: isRed ? 'red' : 'blue', weight:1, fillOpacity:0.6 });
  });
}

let map3d = new maplibregl.Map({
  container: 'map3d',
  style: "https://demotiles.maplibre.org/style.json", // free demo style
  center: [77.095, 28.556], // [lng, lat]
  zoom: 15,
  pitch: 55,
  bearing: -20,
  antialias: true
});

map3d.on('load', () => {

  // 🛰 Add ESRI Satellite Basemap
  map3d.addSource('esri-satellite', {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ],
    tileSize: 256
  });

  map3d.addLayer({
    id: "esri-satellite",
    type: "raster",
    source: "esri-satellite"
  });

  // 🟢 Load Your GeoJSON File
  map3d.addSource("buildings", {
    type: "geojson",
    data: "Delhi_Buildings.geojson"   // <-- change to your file path
  });

  // 🟢 3D Extrusion Layer
  map3d.addLayer({
    id: "3d-buildings",
    type: "fill-extrusion",
    source: "buildings",
    paint: {
      "fill-extrusion-color": "#00FF00",   // green color
      "fill-extrusion-height": ["get", "mean_height_m"],  
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.9
    }
  });

});


const btn = document.getElementById('modeSwitch');
btn.addEventListener('click', () => {
  const m2d = document.getElementById('map2d');
  const m3d = document.getElementById('map3d');

  // ✔ Detect current mode using visibility (NOT display)
  const is3D = (m3d.style.visibility === 'visible');

  if(!is3D){
    // Switch TO 3D
    const c = map.getCenter(); 
    const zoom = map.getZoom();

    m3d.style.visibility = 'visible';
    m2d.style.visibility = 'hidden';

    map3d.jumpTo({
      center: [c.lng, c.lat],
      zoom: Math.max(zoom - 0.4, 12), 
      pitch: 55,
      bearing: -20
    });

    btn.innerText = 'Switch to 2D';

    setTimeout(()=> map3d.resize(), 300);

  } else {
    // Switch BACK to 2D
    const c3 = map3d.getCenter();
    const z3 = map3d.getZoom();

    m3d.style.visibility = 'hidden';
    m2d.style.visibility = 'visible';

    map.setView([c3.lat, c3.lng], Math.round(z3 + 0.5));

    btn.innerText = 'Switch to 3D';
  }
});
