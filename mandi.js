const NEAR_RANGE = 30;
const map = new maplibregl.Map({  container: "map",  center: [76.935, 31.596],  zoom: 12,  pitch: 70,  bearing: -20,  antialias: true,  style: { version: 8, sources: {}, layers: [] }});
map.on("load", async () => {
  map.addSource("satellite", {
    type: "raster",
    tiles: ["https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"],
    tileSize: 256
  });
  map.addLayer({ id: "satellite", type: "raster", source: "satellite" });
  map.addSource("terrain", {
    type: "raster-dem",
    url: "https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=02HlfJk4sT6qL6sbYhX7",
    tileSize: 256
  });
  map.setTerrain({ source: "terrain", exaggeration: 1.6 });
  const res = await fetch("OBS1_updated.geojson");
  const data = await res.json();
  const processed = data.features.map(f => {
    let top  = Number(f.properties.TOP_ELEV) || 0;
    let pTop = Number(f.properties.P_TOP_ELEV) || 0;
    let ihs  = Number(f.properties.IHS_ELEV) || 0;
    top= top-744;    pTop= pTop - 744;    ihs = ihs - 744;
    const limit = pTop > 0 ? pTop : ihs;
    const diff  = limit - top;
    const poly = turf.buffer(f, 8, { units: "meters" });
    poly.properties = {
      GREEN_TOP:
        top >= limit ? limit :
        diff <= NEAR_RANGE ? limit - NEAR_RANGE :
        top,
      YELLOW_BASE: limit - NEAR_RANGE,
      YELLOW_TOP: top,
      SHOW_YELLOW: diff > 0 && diff <= NEAR_RANGE,
      RED_BASE: limit,
      RED_TOP: top,
      SHOW_RED: top > limit
    };
    return poly;
  });
  map.addSource("obstacles", {    type: "geojson",    data: { type: "FeatureCollection", features: processed } });
  map.addLayer({    id: "green",    type: "fill-extrusion",    source: "obstacles",    paint: {      "fill-extrusion-base": 0,      "fill-extrusion-height": ["get", "GREEN_TOP"],     "fill-extrusion-color": "#00aa55",      "fill-extrusion-opacity": 0.85    }  });
  map.addLayer({    id: "yellow",    type: "fill-extrusion",    source: "obstacles",    filter: ["==", ["get", "SHOW_YELLOW"], true],    paint: {      "fill-extrusion-base": ["get", "YELLOW_BASE"],      "fill-extrusion-height": ["get", "YELLOW_TOP"],      "fill-extrusion-color": "#ffd400",      "fill-extrusion-opacity": 0.95    }  });
  map.addLayer({    id: "red",    type: "fill-extrusion",    source: "obstacles",    filter: ["==", ["get", "SHOW_RED"], true],    paint: {      "fill-extrusion-base": ["get", "RED_BASE"],      "fill-extrusion-height": ["get", "RED_TOP"],      "fill-extrusion-color": "#ff0000",      "fill-extrusion-opacity": 0.95    }  });
  const A=[76.92809,31.58309];  const B=[76.94438,31.60906];  const C=[76.94179,31.61025];  const D=[76.92545,31.58429];
  const LOW = 25;  const HIGH = 25;
  const planeLayer = {
    id: "sloped-plane",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();

      const toVec = ([lng, lat], z) => {
        const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], z);
        return new THREE.Vector3(m.x, m.y, m.z);
      };
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(
        new Float32Array([
          ...toVec(A, LOW).toArray(),
          ...toVec(B, LOW).toArray(),
          ...toVec(C, HIGH).toArray(),

          ...toVec(A, LOW).toArray(),
          ...toVec(C, HIGH).toArray(),
          ...toVec(D, HIGH).toArray()
        ]), 3
      ));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ffffd,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.mesh);
      const light = new THREE.DirectionalLight(0xffffff, 1.2);
      light.position.set(0, 0, 10);
      this.scene.add(light);
      this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
      this.renderer.autoClear = false;
    },
    render(gl, matrix) {this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);this.renderer.resetState(); this.renderer.render(this.scene, this.camera);map.triggerRepaint();}};
  map.addLayer(planeLayer);
  map.addControl(new maplibregl.NavigationControl());
const RUNWAY_ELEV = 25;
const HEIGHT_GAIN = 1984;
const DIST = 15000;
const DIVERGENCE = 15;
const bearingAB = turf.bearing(A, B);
const takeoffBearing = bearingAB + 180;
const midAD = turf.midpoint(A, D).geometry.coordinates;
const midEF = turf.destination(midAD, DIST, takeoffBearing, { units: "meters" }).geometry.coordinates;
const halfWidth = Math.tan(THREE.MathUtils.degToRad(DIVERGENCE)) * DIST;
const A_left  = A;
const A_right = D;
const E_left = turf.destination(midEF, halfWidth, takeoffBearing - 90, { units: "meters" }).geometry.coordinates;
const F_right = turf.destination(midEF, halfWidth, takeoffBearing + 90, { units: "meters" }).geometry.coordinates;
const createTakeoffLayer = (id, pLeft, pRight, fRight, eLeft, baseZ, topZ, hexColor) => {
  return {
    id: id,
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      const toVec = ([lng, lat], z) => {const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], z);return new THREE.Vector3(m.x, m.y, m.z);};
      const geometry = new THREE.BufferGeometry();
      const vL = toVec(pLeft, baseZ), vR = toVec(pRight, baseZ);
      const vFR = toVec(fRight, topZ), vEL = toVec(eLeft, topZ);
      const vertices = new Float32Array([
        ...vL.toArray(), ...vR.toArray(), ...vFR.toArray(),
        ...vL.toArray(), ...vFR.toArray(), ...vEL.toArray()
      ]);
      const strongColor = new THREE.Color(hexColor);
      const lightColor = new THREE.Color(0xffffff); 
      const colors = new Float32Array([
        ...lightColor.toArray(), ...lightColor.toArray(), ...strongColor.toArray(),
        ...lightColor.toArray(), ...strongColor.toArray(), ...strongColor.toArray()
      ]);
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({ vertexColors: true,transparent: true,opacity: 0.6,side: THREE.DoubleSide});
      this.scene.add(new THREE.Mesh(geometry, material));
      this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
      this.renderer.autoClear = false;
    },
    render(gl, matrix) {
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    }
  };
};
const midBC = turf.midpoint(B, C).geometry.coordinates;
const takeoffBearingBC = bearingAB;
const midGH = turf.destination(  midBC,  DIST,  takeoffBearingBC,  { units: "meters" }).geometry.coordinates;
const G_left = turf.destination(  midGH,  halfWidth,  takeoffBearingBC + 90,  { units: "meters" }).geometry.coordinates;
const H_right = turf.destination(  midGH,  halfWidth,  takeoffBearingBC - 90,  { units: "meters" }).geometry.coordinates;
const B_left  = B;
const B_right = C;
const takeoffSurfaceBC = {
  id: "takeoff-surface-bc-gh",
  type: "custom",
  renderingMode: "3d",
  onAdd(map, gl) {
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();
    const toVec = ([lng, lat], z) => {
      const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], z);
      return new THREE.Vector3(m.x, m.y, m.z);
    };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          ...toVec(B_left,  RUNWAY_ELEV).toArray(),
          ...toVec(B_right, RUNWAY_ELEV).toArray(),
          ...toVec(H_right, RUNWAY_ELEV + HEIGHT_GAIN).toArray(),
          ...toVec(B_left,  RUNWAY_ELEV).toArray(),
          ...toVec(H_right, RUNWAY_ELEV + HEIGHT_GAIN).toArray(),
          ...toVec(G_left,  RUNWAY_ELEV + HEIGHT_GAIN).toArray()
        ]),
        3
      )
    );
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({      color: 0x00ffff,      transparent: true,      opacity: 0.6,      side: THREE.DoubleSide    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(0, 0, 10);
    this.scene.add(light);
    this.renderer = new THREE.WebGLRenderer({canvas: map.getCanvas(),context: gl});
    this.renderer.autoClear = false;
  },
  render(gl, matrix) {
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    map.triggerRepaint();
  }
};
const TRANS_BREADTH = 315; 
const TRANS_SLOPE = 1/7; 
const TRANS_HEIGHT = TRANS_BREADTH * TRANS_SLOPE; 
const FLARE_DIST = 1450; 
const bearingAD = turf.bearing(A, D);
const getFlaredPoint = (start, sideDist, sideBearing, longDist, longBearing) => {
    const intermediate = turf.destination(start, sideDist, sideBearing, {units: 'meters'});
    return turf.destination(intermediate, longDist, longBearing, {units: 'meters'}).geometry.coordinates;
};
const A_out_AB = getFlaredPoint(A, TRANS_BREADTH, bearingAD + 180, FLARE_DIST, bearingAB + 180);
const B_out_AB = getFlaredPoint(B, TRANS_BREADTH, bearingAD + 180, FLARE_DIST, bearingAB);
const D_out_CD = getFlaredPoint(D, TRANS_BREADTH, bearingAD, FLARE_DIST, bearingAB + 180);
const C_out_CD = getFlaredPoint(C, TRANS_BREADTH, bearingAD, FLARE_DIST, bearingAB);
const A_out_AD = getFlaredPoint(A, TRANS_BREADTH, bearingAB + 180, FLARE_DIST, bearingAD + 180);
const D_out_AD = getFlaredPoint(D, TRANS_BREADTH, bearingAB + 180, FLARE_DIST, bearingAD);
const B_out_BC = getFlaredPoint(B, TRANS_BREADTH, bearingAB, FLARE_DIST, bearingAD + 180);
const C_out_BC = getFlaredPoint(C, TRANS_BREADTH, bearingAB, FLARE_DIST, bearingAD);
const createSideLayer = (id, p1, p2, p1_out, p2_out, baseZ, topZ, hexColor) => {
    return {
        id: id,
        type: "custom",
        renderingMode: "3d",
        onAdd(map, gl) {
            this.camera = new THREE.Camera();
            this.scene = new THREE.Scene();
            const toVec = ([lng, lat], z) => {
                const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], z);
                return new THREE.Vector3(m.x, m.y, m.z);
            };
            const geometry = new THREE.BufferGeometry();
            const v1 = toVec(p1, baseZ), v2 = toVec(p2, baseZ);
            const v1o = toVec(p1_out, topZ), v2o = toVec(p2_out, topZ);
            const vertices = new Float32Array([
                ...v1.toArray(), ...v2.toArray(), ...v2o.toArray(),
                ...v1.toArray(), ...v2o.toArray(), ...v1o.toArray()
            ]);
            const strongColor = new THREE.Color(hexColor);
            const lightColor = new THREE.Color(0xffffff); // White base           
            const colors = new Float32Array([
                ...lightColor.toArray(), ...lightColor.toArray(), ...strongColor.toArray(),
                ...lightColor.toArray(), ...strongColor.toArray(), ...strongColor.toArray()
            ]);
            geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            geometry.computeVertexNormals();
            const material = new THREE.MeshBasicMaterial({ // BasicMaterial ignores lights to avoid "grey" look
                vertexColors: true,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            this.scene.add(new THREE.Mesh(geometry, material));
            this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
            this.renderer.autoClear = false;
        },
        render(gl, matrix) {
            this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
            map.triggerRepaint();
        }
    };
};
const INNER_RAD = 4000;
const OUTER_RAD = 6000;
const INNER_HEIGHT = 45 + RUNWAY_ELEV; 
const OUTER_HEIGHT = 90 + RUNWAY_ELEV; 
const CAPSULE_COLOR = 0xff0055; 
const runwayBearing = turf.bearing(midAD, midBC);
const getCapsulePoints = (center, radius, startAngle) => {
    let pts = [];
    for (let i = 0; i <= 180; i += 5) {
        let angle = startAngle + i;
        pts.push(turf.destination(center, radius, angle, {units: 'meters'}).geometry.coordinates);
    }
    return pts;
};
const innerArc1 = getCapsulePoints(midAD, INNER_RAD, runwayBearing + 90);
const innerArc2 = getCapsulePoints(midBC, INNER_RAD, runwayBearing - 90);
let innerPoints = [...innerArc1, ...innerArc2];
innerPoints.push(innerPoints[0]);
const outerArc1 = getCapsulePoints(midAD, OUTER_RAD, runwayBearing + 90);
const outerArc2 = getCapsulePoints(midBC, OUTER_RAD, runwayBearing - 90);
let outerPoints = [...outerArc1, ...outerArc2];
outerPoints.push(outerPoints[0]);
const conicalSurfaceLayer = {
    id: "conical-capsule",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        const toVec = ([lng, lat], z) => {
            const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], z);
            return new THREE.Vector3(m.x, m.y, m.z);
        };
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        const strongCol = new THREE.Color(CAPSULE_COLOR);
        const lightCol = new THREE.Color(0xffffff);
        for (let i = 0; i < innerPoints.length - 1; i++) {
            const pI1 = toVec(innerPoints[i], INNER_HEIGHT);
            const pI2 = toVec(innerPoints[i+1], INNER_HEIGHT);
            const pO1 = toVec(outerPoints[i], OUTER_HEIGHT);
            const pO2 = toVec(outerPoints[i+1], OUTER_HEIGHT);
            vertices.push(...pI1.toArray(), ...pI2.toArray(), ...pO2.toArray());
            colors.push(...lightCol.toArray(), ...lightCol.toArray(), ...strongCol.toArray());
            vertices.push(...pI1.toArray(), ...pO2.toArray(), ...pO1.toArray());
            colors.push(...lightCol.toArray(), ...strongCol.toArray(), ...strongCol.toArray());
        }
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
        geometry.computeVertexNormals();
        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.scene.add(new THREE.Mesh(geometry, material));
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
        this.renderer.autoClear = false;
    },
    render(gl, matrix) {
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        map.triggerRepaint();
    }
};
map.addLayer(conicalSurfaceLayer);
map.addLayer(createSideLayer("ext-ab", A, B, A_out_AB, B_out_AB, RUNWAY_ELEV, RUNWAY_ELEV + TRANS_HEIGHT, 0x0055ff)); // Orange-Red-0xff5500
map.addLayer(createSideLayer("ext-cd", D, C, D_out_CD, C_out_CD, RUNWAY_ELEV, RUNWAY_ELEV + TRANS_HEIGHT, 0x0055ff)); // Blue
map.addLayer(createTakeoffLayer("takeoff-surface-ad-ef", A_left, A_right, F_right, E_left, RUNWAY_ELEV, RUNWAY_ELEV + HEIGHT_GAIN, 0x00ffff));
map.addLayer(createTakeoffLayer("takeoff-surface-bc-gh", B_left, B_right, H_right, G_left, RUNWAY_ELEV, RUNWAY_ELEV + HEIGHT_GAIN, 0x00ffff));
});