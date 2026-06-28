import * as turf from '@turf/turf';

export class Router {
  constructor(roadsFeatureCollection) {
    this.roads = roadsFeatureCollection.features || [];
    this.graph = {};
    this.buildGraph();
  }

  // Coordinate string key helper
  toKey(coords) {
    return `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
  }

  // Parse key back to [lng, lat]
  fromKey(key) {
    const [lng, lat] = key.split(',').map(Number);
    return [lng, lat];
  }

  buildGraph() {
    this.graph = {};
    
    this.roads.forEach(road => {
      const geom = road.geometry;
      if (geom.type !== 'LineString') return;
      
      const coords = geom.coordinates;
      if (coords.length < 2) return;
      
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        
        const nodeA = this.toKey(p1);
        const nodeB = this.toKey(p2);
        
        // Calculate segment distance in meters
        const dist = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' });
        
        if (!this.graph[nodeA]) this.graph[nodeA] = [];
        if (!this.graph[nodeB]) this.graph[nodeB] = [];
        
        this.graph[nodeA].push({ node: nodeB, length: dist, coords: [p1, p2], road });
        this.graph[nodeB].push({ node: nodeA, length: dist, coords: [p2, p1], road });
      }
    });
    
    console.log(`Routable graph built: ${Object.keys(this.graph).length} nodes.`);
  }

  // Find the closest graph node to a click coordinate
  findNearestNode(lng, lat) {
    const pt = [lng, lat];
    let nearestNode = null;
    let minDistance = Infinity;
    
    Object.keys(this.graph).forEach(key => {
      const nodeCoords = this.fromKey(key);
      const dist = turf.distance(turf.point(pt), turf.point(nodeCoords), { units: 'meters' });
      if (dist < minDistance) {
        minDistance = dist;
        nearestNode = key;
      }
    });
    
    return nearestNode;
  }

  // Optimized Dijkstra's Pathfinding Algorithm using dynamic active node tracking
  findPath(startKey, endKey, weightFn) {
    const distances = {};
    const previous = {};
    
    distances[startKey] = 0;
    
    const active = new Set();
    active.add(startKey);
    const visited = new Set();
    
    while (active.size > 0) {
      let u = null;
      let minDistance = Infinity;
      
      active.forEach(node => {
        const d = distances[node];
        if (d < minDistance) {
          minDistance = d;
          u = node;
        }
      });
      
      if (u === null || u === endKey) break;
      
      active.delete(u);
      visited.add(u);
      
      const neighbors = this.graph[u] || [];
      for (let i = 0; i < neighbors.length; i++) {
        const edge = neighbors[i];
        const neighbor = edge.node;
        
        if (visited.has(neighbor)) continue;
        
        const alt = distances[u] + weightFn(edge);
        const currentDist = distances[neighbor] !== undefined ? distances[neighbor] : Infinity;
        
        if (alt < currentDist) {
          distances[neighbor] = alt;
          previous[neighbor] = u;
          active.add(neighbor);
        }
      }
    }
    
    if (distances[endKey] === undefined) return null;
    
    const pathCoords = [];
    let curr = endKey;
    while (curr !== null && curr !== undefined) {
      pathCoords.unshift(this.fromKey(curr));
      curr = previous[curr];
    }
    
    if (pathCoords.length < 2 || this.toKey(pathCoords[0]) !== startKey) {
      return null;
    }
    
    return pathCoords;
  }

  // Generate route stats and LineString geometry
  getRouteDetails(pathCoords, shadowEngine, sunPos, userElements, roadShadeCache = null) {
    if (!pathCoords) return null;
    
    let totalDistance = 0;
    let shadedDistance = 0;
    
    for (let i = 0; i < pathCoords.length - 1; i++) {
      const p1 = pathCoords[i];
      const p2 = pathCoords[i + 1];
      const dist = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' });
      totalDistance += dist;
      
      // Sample midpoint shade (use lazy cache if available to avoid duplicate computations)
      let isShaded = false;
      const key1 = this.toKey(p1);
      const key2 = this.toKey(p2);
      const neighbors = this.graph[key1] || [];
      const edge = neighbors.find(e => e.node === key2);
      
      if (edge && roadShadeCache && roadShadeCache.has(edge.road)) {
        isShaded = roadShadeCache.get(edge.road);
      } else {
        const midLng = (p1[0] + p2[0]) / 2;
        const midLat = (p1[1] + p2[1]) / 2;
        isShaded = shadowEngine.isCoordinateShaded(midLng, midLat, sunPos, userElements);
        if (edge && roadShadeCache) {
          roadShadeCache.set(edge.road, isShaded);
        }
      }
      
      if (isShaded) {
        shadedDistance += dist;
      }
    }
    
    const shadePercent = totalDistance > 0 ? (shadedDistance / totalDistance) * 100 : 0;
    const walkingSpeedKmh = 4.5; // average pedestrian speed
    const durationMin = (totalDistance / 1000) / walkingSpeedKmh * 60;
    
    // Comfort level mapping
    let comfort = 'Warm';
    if (shadePercent > 70) comfort = 'Comfortable';
    else if (shadePercent < 15) comfort = 'Dangerous';
    else if (shadePercent < 40) comfort = 'Hot';
    
    return {
      geometry: {
        type: 'LineString',
        coordinates: pathCoords
      },
      distance: Math.round(totalDistance),
      duration: Math.round(durationMin),
      shadePercent: Math.round(shadePercent),
      comfortLevel: comfort
    };
  }

  // Orchestrator to calculate both Fastest and Coolest routes
  compareRoutes(startLngLat, endLngLat, shadowEngine, date, userElements = []) {
    const sunPos = shadowEngine.getSunPosition(date);
    
    const startNode = this.findNearestNode(startLngLat[0], startLngLat[1]);
    const endNode = this.findNearestNode(endLngLat[0], endLngLat[1]);
    
    if (!startNode || !endNode || startNode === endNode) return null;

    // Cache to share computed shade states during pathfinding relaxations
    const roadShadeCache = new Map();
    
    // 1. FASTEST ROUTE WEIGHT: simple physical length
    const fastestPathCoords = this.findPath(startNode, endNode, (edge) => edge.length);
    const fastestDetails = this.getRouteDetails(fastestPathCoords, shadowEngine, sunPos, userElements, roadShadeCache);
    
    // 2. COOLEST ROUTE WEIGHT: heavily penalises exposed segments
    const coolestPathCoords = this.findPath(startNode, endNode, (edge) => {
      let isShaded = roadShadeCache.get(edge.road);
      if (isShaded === undefined) {
        // Evaluate midpoint coordinates
        const coords = edge.road.geometry.coordinates;
        const midIdx = Math.floor(coords.length / 2);
        const pMid = coords[midIdx];
        isShaded = pMid ? shadowEngine.isCoordinateShaded(pMid[0], pMid[1], sunPos, userElements) : false;
        roadShadeCache.set(edge.road, isShaded);
      }
      
      const penalty = isShaded ? 1.0 : 4.0; // 4x penalty for sun exposed paths
      return edge.length * penalty;
    });
    
    const coolestDetails = this.getRouteDetails(coolestPathCoords, shadowEngine, sunPos, userElements, roadShadeCache);
    
    return {
      fastest: fastestDetails,
      coolest: coolestDetails
    };
  }
}
