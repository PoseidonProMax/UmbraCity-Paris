import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

// Local origin for coordinate offsets (center of Île de la Cité)
const ORIGIN_LNG = 2.349;
const ORIGIN_LAT = 48.853;

export class ThreeLayer {
  constructor() {
    this.id = 'umbracity-3d-layer';
    this.type = 'custom';
    this.renderingMode = '3d';
    
    this.map = null;
    this.gl = null;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunLight = null;
    this.ambientLight = null;
    this.sunSphere = null;
    
    this.buildingMeshes = [];
    this.treeCanopyMesh = null;
    this.treeTrunkMesh = null;
    this.groundPlane = null;
    this.placedMeshes = [];
    this.placedMeshMap = new Map(); // id -> THREE.Group
    
    // Mercator origin configuration
    this.mercatorOrigin = maplibregl.MercatorCoordinate.fromLngLat([ORIGIN_LNG, ORIGIN_LAT], 0);
    this.scale = this.mercatorOrigin.meterInMercatorCoordinateUnits();
    
    this.modelTransform = {
      translateX: this.mercatorOrigin.x,
      translateY: this.mercatorOrigin.y,
      translateZ: this.mercatorOrigin.z,
      scale: this.scale
    };
  }

  onAdd(map, gl) {
    this.map = map;
    this.gl = gl;

    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();

    // Set up WebGLRenderer reusing MapLibre WebGL context
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true
    });
    this.renderer.autoClear = false;
    
    // Enable shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ambient light (sky dome simulation)
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 0.45); // light sky blue ambient
    this.scene.add(this.ambientLight);

    // Directional Sun light
    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 1.25); // warm sunlight
    this.sunLight.castShadow = true;
    
    // Shadow Map configuration (4096 for extremely sharp & crisp shadows)
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;
    this.sunLight.shadow.camera.near = 0.0001;
    this.sunLight.shadow.camera.far = 0.5; // in Mercator units
    this.sunLight.shadow.radius = 3.0; // Soft shadow edges
    
    // Size of shadow frustum in Mercator units (covers focus area)
    const d = 500 * this.scale;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0001; // Avoid shadow acne
    
    this.scene.add(this.sunLight);
    
    // Visible Glowing Sun Sphere in the sky
    const sunGroup = new THREE.Group();
    const sunSphereGeo = new THREE.SphereGeometry(6 * this.scale, 32, 32);
    const sunSphereMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    const sunCore = new THREE.Mesh(sunSphereGeo, sunSphereMat);
    sunGroup.add(sunCore);

    const sunGlowGeo = new THREE.SphereGeometry(16 * this.scale, 32, 32);
    const sunGlowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.25
    });
    const sunGlow = new THREE.Mesh(sunGlowGeo, sunGlowMat);
    sunGroup.add(sunGlow);
    this.sunSphere = sunGroup;
    this.scene.add(this.sunSphere);

    // Visible Glowing Moon Sphere in the sky
    const moonGroup = new THREE.Group();
    const moonSphereGeo = new THREE.SphereGeometry(4 * this.scale, 32, 32);
    const moonSphereMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const moonCore = new THREE.Mesh(moonSphereGeo, moonSphereMat);
    moonGroup.add(moonCore);

    const moonGlowGeo = new THREE.SphereGeometry(10 * this.scale, 32, 32);
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.12
    });
    const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
    moonGroup.add(moonGlow);
    this.moonSphere = moonGroup;
    this.moonSphere.visible = false;
    this.scene.add(this.moonSphere);
    
    // Ground shadow receiver lying on the XY plane
    const groundGeo = new THREE.PlaneGeometry(0.25, 0.25);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.55 }); // High-visibility shadows
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.receiveShadow = true;
    this.groundPlane.position.z = 0.02 * this.scale; // Lifted slightly to prevent z-fighting
    this.scene.add(this.groundPlane);

    // Materials - Limestone Beige & Slate Gray Roofs (Haussmann architecture contrast)
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3efe6, // rich Haussmann limestone beige
      roughness: 0.7,
      metalness: 0.05,
      flatShading: true
    });
    
    this.roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569, // Classic slate blue/zinc gray
      roughness: 0.4,
      metalness: 0.25,
      flatShading: true
    });
    
    this.buildingMaterials = [this.roofMaterial, this.wallMaterial];
    
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Deep slate river blue
      roughness: 0.08, // Smooth water for sharp specular highlights
      metalness: 0.9,  // High reflectivity for sky reflections
      transparent: true,
      opacity: 0.85
    });
    
    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // glowing solar amber
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.4
    });
  }

  // Returns Mercator coordinate offsets relative to center origin
  lngLatToXY(lng, lat) {
    const coord = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
    const x = coord.x - this.modelTransform.translateX;
    const y = coord.y - this.modelTransform.translateY;
    return { x, y };
  }

  loadBuildings(buildingsGeoJSON) {
    console.log("Loading 3D buildings...");
    const features = buildingsGeoJSON.features || [];
    
    features.forEach(feature => {
      const geom = feature.geometry;
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;
      
      const height = feature.properties._height || 15;
      
      const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
      if (coords.length < 3) return;

      const shape = new THREE.Shape();
      const startPt = this.lngLatToXY(coords[0][0], coords[0][1]);
      shape.moveTo(startPt.x, startPt.y);
      
      for (let i = 1; i < coords.length; i++) {
        const pt = this.lngLatToXY(coords[i][0], coords[i][1]);
        shape.lineTo(pt.x, pt.y);
      }
      
      // Extrude upward along Z axis in Mercator units
      const extrudeSettings = {
        depth: height * this.scale,
        bevelEnabled: true,
        bevelThickness: 0.15 * this.scale,
        bevelSize: 0.08 * this.scale,
        bevelSegments: 1
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const mesh = new THREE.Mesh(geometry, this.buildingMaterials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Add subtle wireframe outlines for crisp architectural edges
      const edgesGeo = new THREE.EdgesGeometry(geometry, 25);
      const edgesLine = new THREE.LineSegments(
        edgesGeo,
        new THREE.LineBasicMaterial({
          color: 0x334155, // slate-700
          transparent: true,
          opacity: 0.35,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        })
      );
      mesh.add(edgesLine);
      
      mesh.userData = { feature };
      
      // Stop Three.js from updating matrices every frame for static mesh speed
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      
      this.scene.add(mesh);
      this.buildingMeshes.push(mesh);
    });
  }

  loadTrees(treesGeoJSON) {
    console.log("Loading 3D trees...");
    const features = treesGeoJSON.features || [];
    const count = features.length;
    if (count === 0) return;

    // Cylinder base geometry scaled and pre-rotated to stand along Z axis (Up)
    const trunkGeo = new THREE.CylinderGeometry(0.18 * this.scale, 0.28 * this.scale, 5 * this.scale, 6);
    trunkGeo.rotateX(Math.PI / 2);
    trunkGeo.translate(0, 0, (5 * this.scale) / 2); // Sit bottom on ground
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });
    this.treeTrunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    this.treeTrunkMesh.castShadow = true;
    this.treeTrunkMesh.receiveShadow = false;

    // Faceted Icosahedron foliage for low-poly high-end architectural style
    const canopyGeo = new THREE.IcosahedronGeometry(1.5 * this.scale, 1);
    canopyGeo.scale(1, 1, 0.8); // slightly squashed along vertical axis
    canopyGeo.translate(0, 0, 5 * this.scale); // sit canopy on top of trunk
    const canopyMat = new THREE.MeshStandardMaterial({ 
      color: 0x2d6a4f, // sophisticated hunter/forest green
      roughness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 0.95
    });
    this.treeCanopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    this.treeCanopyMesh.castShadow = true;
    this.treeCanopyMesh.receiveShadow = false;

    const dummy = new THREE.Object3D();

    features.forEach((tree, idx) => {
      const coords = tree.geometry.coordinates;
      const height = tree.properties._height || 8;
      const radius = tree.properties._canopyRadius || 3;
      
      const pos = this.lngLatToXY(coords[0], coords[1]);
      
      // Compute scaling factors relative to typical sizes
      const trunkHeightScale = height / 5;
      const canopyScale = radius / 1.5;
      
      // Position at base level (XY ground, Z height is 0)
      dummy.position.set(pos.x, pos.y, 0);
      dummy.scale.set(canopyScale, canopyScale, trunkHeightScale);
      dummy.updateMatrix();
      
      this.treeTrunkMesh.setMatrixAt(idx, dummy.matrix);
      
      // Position canopy (which handles its own trunk translation internally)
      dummy.scale.set(canopyScale, canopyScale, canopyScale);
      dummy.updateMatrix();
      this.treeCanopyMesh.setMatrixAt(idx, dummy.matrix);
    });

    this.treeTrunkMesh.instanceMatrix.needsUpdate = true;
    this.treeCanopyMesh.instanceMatrix.needsUpdate = true;
    
    this.scene.add(this.treeTrunkMesh);
    this.scene.add(this.treeCanopyMesh);
  }

  loadWater(waterGeoJSON) {
    console.log("Loading 3D water surface...");
    const features = waterGeoJSON.features || [];
    
    features.forEach(feature => {
      const geom = feature.geometry;
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;
      
      const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
      if (coords.length < 3) return;

      const shape = new THREE.Shape();
      const startPt = this.lngLatToXY(coords[0][0], coords[0][1]);
      shape.moveTo(startPt.x, startPt.y);
      
      for (let i = 1; i < coords.length; i++) {
        const pt = this.lngLatToXY(coords[i][0], coords[i][1]);
        shape.lineTo(pt.x, pt.y);
      }
      
      const geometry = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geometry, this.waterMaterial);
      mesh.receiveShadow = true;
      
      // Position slightly above ground to prevent z-fighting with MapLibre basemap
      mesh.position.z = 0.25 * this.scale;
      
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      
      this.scene.add(mesh);
    });
  }

  setWeatherState(state) {
    this.weatherState = state; // 'sunny', 'cloudy', 'rain'
  }

  updateSunLight(sunPos) {
    if (!this.sunLight) return;
    
    // Default weather state to sunny if not set
    const ws = this.weatherState || 'sunny';
    
    let weatherIntensityFactor = 1.0;
    let weatherAmbientFactor = 1.0;
    let shadowRadius = 1.5;
    let ambientHex = 0xdbeafe;
    
    if (ws === 'cloudy') {
      weatherIntensityFactor = 0.35;
      weatherAmbientFactor = 1.5;
      shadowRadius = 8.0;
    } else if (ws === 'rain') {
      weatherIntensityFactor = 0.15;
      weatherAmbientFactor = 0.9;
      shadowRadius = 15.0;
      ambientHex = 0x475569; // dark cloudy grey
    }
    
    this.sunLight.shadow.radius = shadowRadius;

    // Get current map viewport center in Mercator coordinates
    let cx = 0;
    let cy = 0;
    if (this.map) {
      const center = this.map.getCenter();
      const centerCoord = maplibregl.MercatorCoordinate.fromLngLat([center.lng, center.lat], 0);
      cx = centerCoord.x - this.modelTransform.translateX;
      cy = centerCoord.y - this.modelTransform.translateY;
    }
    
    // Always center the ground shadow plane and light target on the map viewport center
    if (this.groundPlane) {
      this.groundPlane.position.set(cx, cy, 0.02 * this.scale);
      this.groundPlane.updateMatrix();
    }
    
    if (this.sunLight.target) {
      this.sunLight.target.position.set(cx, cy, 0);
      this.sunLight.target.updateMatrixWorld();
    }

    if (sunPos.isNight) {
      this.sunLight.intensity = 0.0;
      this.ambientLight.intensity = 0.15; // Dark night glow
      this.ambientLight.color.setHex(0x312e81); // Indigo night sky
      
      if (this.sunSphere) this.sunSphere.visible = false;
      
      if (this.moonSphere) {
        this.moonSphere.visible = true;
        // Position moon opposite to sun
        const alt = -sunPos.altitude;
        const az = sunPos.azimuth + Math.PI;
        const moonDist = 400 * this.scale;
        const mxs = cx + moonDist * Math.cos(alt) * Math.sin(az);
        const mys = cy - moonDist * Math.cos(alt) * Math.cos(az);
        const mzs = moonDist * Math.sin(alt);
        this.moonSphere.position.set(mxs, mys, mzs);
      }
      return;
    }

    if (this.sunSphere) this.sunSphere.visible = true;
    if (this.moonSphere) this.moonSphere.visible = false;

    // Convert azimuth and altitude to Cartesian coordinate values in Mercator space
    const alt = sunPos.altitude;
    const az = sunPos.azimuth;

    // Directional light position offset from center
    const r = 0.15;
    const sz = r * Math.sin(alt);
    const sx = r * Math.cos(alt) * Math.sin(az);
    const sy = -r * Math.cos(alt) * Math.cos(az); // North is negative Y

    this.sunLight.position.set(cx + sx, cy + sy, sz);

    // Position visible sun sphere high in the sky (within far clipping plane)
    if (this.sunSphere) {
      const sunDist = 400 * this.scale;
      const sxs = cx + sunDist * Math.cos(alt) * Math.sin(az);
      const sys = cy - sunDist * Math.cos(alt) * Math.cos(az);
      const szs = sunDist * Math.sin(alt);
      this.sunSphere.position.set(sxs, sys, szs);
    }
    
    // Scale intensity based on solar altitude (overhead noon is brightest)
    const altitudeDegrees = (alt * 180) / Math.PI;
    const intensity = Math.min(1.4, Math.max(0.1, Math.sin(alt) * 1.8));
    
    // Dynamic Color Temperature Transition (sunset/sunrise golden hour)
    if (altitudeDegrees < 20) {
      const t = (20 - altitudeDegrees) / 20; // 0 to 1 as sun sets
      const sunColor = new THREE.Color(0xfff8e7).lerp(new THREE.Color(0xf97316), t * 0.85);
      this.sunLight.color.copy(sunColor);
      
      const ambientBase = new THREE.Color(ambientHex);
      const ambientColor = ambientBase.lerp(new THREE.Color(0x312e81), t * 0.75);
      this.ambientLight.color.copy(ambientColor);
      this.ambientLight.intensity = (0.45 * weatherAmbientFactor) - t * 0.2;
      this.sunLight.intensity = intensity * weatherIntensityFactor * (1.0 - t * 0.5);
    } else {
      this.sunLight.color.setHex(0xfff8e7);
      this.ambientLight.color.setHex(ambientHex);
      this.ambientLight.intensity = 0.45 * weatherAmbientFactor;
      this.sunLight.intensity = intensity * weatherIntensityFactor;
    }
  }

  highlightBuilding(buildingFeature) {
    this.buildingMeshes.forEach(mesh => {
      mesh.material = this.buildingMaterials;
    });

    if (!buildingFeature) return;

    const targetMesh = this.buildingMeshes.find(mesh => 
      mesh.userData.feature.properties.name === buildingFeature.properties.name &&
      mesh.userData.feature.properties._height === buildingFeature.properties._height
    );

    if (targetMesh) {
      targetMesh.material = this.highlightMaterial;
    }
  }

  addUserElement(id, type, lngLat, height, canopyRadius) {
    const pos = this.lngLatToXY(lngLat[0], lngLat[1]);
    const group = new THREE.Group();
    // Position at base level (XY ground, Z height is 0)
    group.position.set(pos.x, pos.y, 0);
    
    if (type === 'tree') {
      const hScale = height * this.scale;
      const rScale = canopyRadius * this.scale;
      
      const trunkGeo = new THREE.CylinderGeometry(0.18 * this.scale, 0.28 * this.scale, hScale, 6);
      trunkGeo.rotateX(Math.PI / 2);
      trunkGeo.translate(0, 0, hScale / 2);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.castShadow = true;
      group.add(trunk);

      const canopyGeo = new THREE.IcosahedronGeometry(rScale, 1);
      canopyGeo.scale(1, 1, 0.8);
      canopyGeo.translate(0, 0, hScale);
      const canopyMat = new THREE.MeshStandardMaterial({ 
        color: 0x10b981, // Vibrant emerald green for user-placed tree
        roughness: 0.8,
        flatShading: true,
        emissive: 0x064e3b,
        emissiveIntensity: 0.1
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.castShadow = true;
      group.add(canopy);
      
    } else if (type === 'canopy') {
      const hScale = height * this.scale;
      const shelterGroup = new THREE.Group();
      
      const rw = 6 * this.scale;
      const rh = 4 * this.scale;
      // Beautiful curved arch using a cylinder segment
      const roofGeo = new THREE.CylinderGeometry(rw / 2, rw / 2, rh, 24, 1, true, 0, Math.PI);
      roofGeo.rotateX(Math.PI / 2); // align along Y
      roofGeo.scale(1, 1, 0.35); // squish into an arch
      roofGeo.translate(0, 0, hScale);
      
      const roofMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x0ea5e9, // Electric cyan-blue glassmorphic roof
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
        transmission: 0.6,
        ior: 1.5,
        thickness: 0.2 * this.scale,
        side: THREE.DoubleSide
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.castShadow = true;
      roof.receiveShadow = true;
      shelterGroup.add(roof);
      
      const pillarGeo = new THREE.CylinderGeometry(0.06 * this.scale, 0.06 * this.scale, hScale, 12);
      pillarGeo.rotateX(Math.PI / 2);
      pillarGeo.translate(0, 0, hScale / 2);
      const pillarMat = new THREE.MeshStandardMaterial({ 
        color: 0xf1f5f9, // polished silver/chrome
        metalness: 0.95,
        roughness: 0.05
      });
      
      const offsets = [
        [-2.8 * this.scale, -1.8 * this.scale],
        [2.8 * this.scale, -1.8 * this.scale],
        [-2.8 * this.scale, 1.8 * this.scale],
        [2.8 * this.scale, 1.8 * this.scale]
      ];
      offsets.forEach(([ox, oy]) => {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(ox, oy, 0);
        pillar.castShadow = true;
        shelterGroup.add(pillar);
      });
      
      group.add(shelterGroup);
    }
    
    this.scene.add(group);
    this.placedMeshes.push(group);
    this.placedMeshMap.set(id, group);
    
    if (this.map) this.map.triggerRepaint();
  }

  removeUserElement(id) {
    const group = this.placedMeshMap.get(id);
    if (group) {
      this.scene.remove(group);
      
      group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      
      this.placedMeshMap.delete(id);
      this.placedMeshes = this.placedMeshes.filter(m => m !== group);
      
      if (this.map) this.map.triggerRepaint();
    }
  }

  clearUserElements() {
    this.placedMeshMap.forEach((group) => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.placedMeshMap.clear();
    this.placedMeshes = [];
    if (this.map) this.map.triggerRepaint();
  }

  render(gl, matrix) {
    if (!this.renderer || !this.scene) return;
    
    // Matrix transformation: Translate the projection matrix to offset coordinates relative to origin
    const m = new THREE.Matrix4().fromArray(matrix);
    
    const translate = new THREE.Matrix4().makeTranslation(
      this.modelTransform.translateX,
      this.modelTransform.translateY,
      this.modelTransform.translateZ
    );

    this.camera.projectionMatrix = m.multiply(translate);
    
    // Render and reset GL state
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    
    this.map.triggerRepaint();
  }
}
