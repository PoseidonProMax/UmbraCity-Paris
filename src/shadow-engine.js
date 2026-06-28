import * as turf from '@turf/turf';
import SunCalc from 'suncalc';

// Paris Coordinates
const LAT = 48.853;
const LNG = 2.349;

export class ShadowEngine {
  constructor() {
    this.buildings = [];
    this.trees = [];
    this.parks = [];
    
    // Spatial grid bounding box: [2.340, 48.845, 2.360, 48.858]
    this.gridMinLng = 2.340;
    this.gridMaxLng = 2.360;
    this.gridMinLat = 48.845;
    this.gridMaxLat = 48.858;
    this.gridCols = 15;
    this.gridRows = 15;
    
    this.clearGrid();
    
    // Cache for projected shadow geometries
    this.cachedShadows = []; // Array of shadow polygons corresponding to building indices
    this.currentSunPos = null;
  }

  setData(buildings, trees, parks) {
    this.buildings = buildings.features || [];
    this.trees = trees.features || [];
    this.parks = parks.features || [];
  }

  clearGrid() {
    this.grid = Array(this.gridCols * this.gridRows).fill(null).map(() => []);
  }

  getBucketIndices(lng, lat) {
    const col = Math.floor(((lng - this.gridMinLng) / (this.gridMaxLng - this.gridMinLng)) * this.gridCols);
    const row = Math.floor(((lat - this.gridMinLat) / (this.gridMaxLat - this.gridMinLat)) * this.gridRows);
    return { col, row };
  }

  getShadowsNear(lng, lat, radiusBuckets = 1) {
    const { col, row } = this.getBucketIndices(lng, lat);
    const indices = new Set();
    
    for (let c = col - radiusBuckets; c <= col + radiusBuckets; c++) {
      for (let r = row - radiusBuckets; r <= row + radiusBuckets; r++) {
        if (c >= 0 && c < this.gridCols && r >= 0 && r < this.gridRows) {
          const bucket = this.grid[r * this.gridCols + c];
          bucket.forEach(idx => indices.add(idx));
        }
      }
    }
    
    return Array.from(indices).map(idx => this.cachedShadows[idx]).filter(Boolean);
  }

  getSunPosition(date) {
    const sc = SunCalc.getPosition(date, LAT, LNG);
    
    let azimuthDeg = (sc.azimuth * 180) / Math.PI + 180;
    azimuthDeg = (azimuthDeg + 180) % 360; // Shadow direction
    
    return {
      altitude: sc.altitude, // radians
      azimuth: sc.azimuth,   // radians
      shadowDirectionDeg: azimuthDeg,
      isNight: sc.altitude <= 0.02
    };
  }

  // Projects building shadow polygon (highly optimized using turf.convex instead of turf.union)
  projectShadow(feature, sunPos) {
    if (sunPos.isNight) return null;
    
    const height = feature.properties._height || 15;
    const shadowLength = height / Math.tan(sunPos.altitude);
    const finalLength = Math.min(shadowLength, 120); 
    
    try {
      const translated = turf.transformTranslate(
        feature,
        finalLength,
        sunPos.shadowDirectionDeg,
        { units: 'meters' }
      );
      
      const geom = feature.geometry;
      const tGeom = translated.geometry;
      
      const coords1 = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
      const coords2 = tGeom.type === 'Polygon' ? tGeom.coordinates[0] : tGeom.coordinates[0][0];
      
      // Combine points and compute convex hull
      const points = [];
      coords1.forEach(c => points.push(turf.point(c)));
      coords2.forEach(c => points.push(turf.point(c)));
      
      const fc = turf.featureCollection(points);
      const unioned = turf.convex(fc);
      
      return unioned || feature;
    } catch (e) {
      return feature;
    }
  }

  // Pre-calculate and index all building shadow polygons once per time step
  cacheAllShadows(sunPos) {
    this.currentSunPos = sunPos;
    this.cachedShadows = [];
    this.clearGrid();
    
    if (sunPos.isNight) return;
    
    this.buildings.forEach((building, idx) => {
      const shadowPoly = this.projectShadow(building, sunPos);
      this.cachedShadows.push(shadowPoly);
      
      if (shadowPoly) {
        // Index the shadow polygon in our grid
        const bbox = turf.bbox(shadowPoly);
        const start = this.getBucketIndices(bbox[0], bbox[1]);
        const end = this.getBucketIndices(bbox[2], bbox[3]);
        
        const startCol = Math.max(0, start.col);
        const endCol = Math.min(this.gridCols - 1, end.col);
        const startRow = Math.max(0, start.row);
        const endRow = Math.min(this.gridRows - 1, end.row);
        
        for (let c = startCol; c <= endCol; c++) {
          for (let r = startRow; r <= endRow; r++) {
            this.grid[r * this.gridCols + c].push(idx);
          }
        }
      }
    });
  }

  // Check if a coordinate is in shadow of cached buildings or trees
  isCoordinateShaded(lng, lat, sunPos, userElements = []) {
    if (sunPos.isNight) return true;
    
    const pt = turf.point([lng, lat]);
    
    // 1. Check user-placed elements
    for (const elem of userElements) {
      if (elem.type === 'tree') {
        const treePt = turf.point(elem.lngLat);
        const shadowLength = elem.height / Math.tan(sunPos.altitude);
        const finalLength = Math.min(shadowLength, 50);
        
        const projectedCenter = turf.destination(
          treePt,
          finalLength,
          sunPos.shadowDirectionDeg,
          { units: 'meters' }
        );
        
        const distToShadowCenter = turf.distance(pt, projectedCenter, { units: 'meters' });
        if (distToShadowCenter <= elem.canopyRadius) {
          return true;
        }
      } else if (elem.type === 'canopy') {
        const canopyPt = turf.point(elem.lngLat);
        const shadowLength = elem.height / Math.tan(sunPos.altitude);
        const projectedCenter = turf.destination(
          canopyPt,
          shadowLength,
          sunPos.shadowDirectionDeg,
          { units: 'meters' }
        );
        const distToShadowCenter = turf.distance(pt, projectedCenter, { units: 'meters' });
        if (distToShadowCenter <= 4) {
          return true;
        }
      }
    }

    // 2. Check nearby OSM trees
    for (const tree of this.trees) {
      const distance = turf.distance(pt, tree, { units: 'meters' });
      if (distance < 80) {
        const height = tree.properties._height || 8;
        const radius = tree.properties._canopyRadius || 3;
        const shadowLength = height / Math.tan(sunPos.altitude);
        
        const projectedCenter = turf.destination(
          tree,
          shadowLength,
          sunPos.shadowDirectionDeg,
          { units: 'meters' }
        );
        
        const distToShadowCenter = turf.distance(pt, projectedCenter, { units: 'meters' });
        if (distToShadowCenter <= radius) {
          return true;
        }
      }
    }

    // 3. Check cached building shadow polygons near the coordinate
    const nearbyShadows = this.getShadowsNear(lng, lat, 1);
    for (const shadowPoly of nearbyShadows) {
      if (turf.booleanPointInPolygon(pt, shadowPoly)) {
        return true;
      }
    }
    
    return false;
  }

  analyzePoint(lng, lat, date, userElements = []) {
    const sunPos = this.getSunPosition(date);
    
    // Ensure shadows are cached for the current sun position before querying
    if (!this.currentSunPos || Math.abs(this.currentSunPos.altitude - sunPos.altitude) > 0.01) {
      this.cacheAllShadows(sunPos);
    }
    
    const isShaded = this.isCoordinateShaded(lng, lat, sunPos, userElements);
    
    let inPark = false;
    const pt = turf.point([lng, lat]);
    for (const park of this.parks) {
      if (turf.booleanPointInPolygon(pt, park)) {
        inPark = true;
        break;
      }
    }

    let comfortScore = 0;
    if (sunPos.isNight) {
      comfortScore = 3;
    } else {
      if (isShaded) {
        comfortScore = 3;
      } else if (inPark) {
        comfortScore = 2;
      } else {
        const altDeg = (sunPos.altitude * 180) / Math.PI;
        if (altDeg > 50) {
          comfortScore = 0;
        } else if (altDeg > 30) {
          comfortScore = 1;
        } else {
          comfortScore = 2;
        }
      }
    }

    const comfortLevels = ['Dangerous', 'Hot', 'Warm', 'Comfortable'];
    const recommendations = [
      "⚠️ Critical sun exposure! Seek shade immediately under building awnings.",
      "🔥 High heat exposure. Walk on the shaded side of the street.",
      "☀️ Warm area. Comfortable for walking, but avoid standing in direct sun.",
      "🟢 Fully shaded and comfortable. Ideal pedestrian route."
    ];

    return {
      shaded: isShaded,
      inPark: inPark,
      comfortLevel: comfortLevels[comfortScore],
      comfortScore: comfortScore,
      recommendation: recommendations[comfortScore],
      sunAltitude: (sunPos.altitude * 180) / Math.PI,
      isNight: sunPos.isNight
    };
  }

  calculateRoadComfort(roadsFeatureCollection, date, userElements = []) {
    const sunPos = this.getSunPosition(date);
    
    // Refresh cached building shadows once at the start of calculation!
    this.cacheAllShadows(sunPos);
    
    const processedFeatures = [];

    roadsFeatureCollection.features.forEach(road => {
      const geom = road.geometry;
      if (geom.type !== 'LineString') return;
      
      const coords = geom.coordinates;
      if (coords.length < 2) return;
      
      // Check midpoint shade for extreme speed
      const midIdx = Math.floor(coords.length / 2);
      const pMid = coords[midIdx];
      
      const isShaded = this.isCoordinateShaded(pMid[0], pMid[1], sunPos, userElements);
      const shadeFraction = isShaded ? 1.0 : 0.0;
      
      let comfortScore = 0;
      if (sunPos.isNight) {
        comfortScore = 3;
      } else {
        if (isShaded) {
          comfortScore = 3;
        } else {
          // Check park overlap
          let inPark = false;
          const pt = turf.point(pMid);
          for (const park of this.parks) {
            if (turf.booleanPointInPolygon(pt, park)) {
              inPark = true;
              break;
            }
          }
          
          if (inPark) {
            comfortScore = 2; // Warm in parks
          } else {
            const altDeg = (sunPos.altitude * 180) / Math.PI;
            if (altDeg > 50) {
              comfortScore = 0; // Dangerous
            } else {
              comfortScore = 1; // Hot
            }
          }
        }
      }

      const comfortColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
      
      const cleanRoad = {
        type: 'Feature',
        properties: {
          ...road.properties,
          _comfortScore: comfortScore,
          _comfortColor: comfortColors[comfortScore],
          _shadeFraction: shadeFraction
        },
        geometry: geom
      };
      
      processedFeatures.push(cleanRoad);
    });

    return {
      type: 'FeatureCollection',
      features: processedFeatures
    };
  }
}
