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

  // Simple Dijkstra's Shortest Path Algorithm
  findPath(startKey, endKey, weightFn) {
    const distances = {};
    const previous = {};
    const queue = new Set();
    
    // Initialise
    Object.keys(this.graph).forEach(node => {
      distances[node] = Infinity;
      previous[node] = null;
      queue.add(node);
    });
    
    distances[startKey] = 0;
    
    while (queue.size > 0) {
      // Find node in queue with smallest distance
      let u = null;
      let minDistance = Infinity;
      
      queue.forEach(node => {
        if (distances[node] < minDistance) {
          minDistance = distances[node];
          u = node;
        }
      });
      
      // If we can't find a path or destination reached
      if (u === null || u === endKey) break;
      
      queue.delete(u);
      
      const neighbors = this.graph[u] || [];
      neighbors.forEach(edge => {
        const alt = distances[u] + weightFn(edge);
        if (alt < distances[edge.node]) {
          distances[edge.node] = alt;
          previous[edge.node] = u;
        }
      });
    }
    
    // Reconstruct path
    const pathCoords = [];
    let curr = endKey;
    while (curr !== null) {
      pathCoords.unshift(this.fromKey(curr));
      curr = previous[curr];
    }
    
    // If the start and end are not connected, return empty
    if (pathCoords.length < 2 || this.toKey(pathCoords[0]) !== startKey) {
      return null;
    }
    
    return pathCoords;
  }

  // Generate route stats and LineString geometry
  getRouteDetails(pathCoords, shadowEngine, sunPos, userElements) {
    if (!pathCoords) return null;
    
    let totalDistance = 0;
    let shadedDistance = 0;
    
    for (let i = 0; i < pathCoords.length - 1; i++) {
      const p1 = pathCoords[i];
      const p2 = pathCoords[i + 1];
      const dist = turf.distance(turf.point(p1), turf.point(p2), { units: 'meters' });
      totalDistance += dist;
      
      // Sample midpoint shade
      const midLng = (p1[0] + p2[0]) / 2;
      const midLat = (p1[1] + p2[1]) / 2;
      const isShaded = shadowEngine.isCoordinateShaded(midLng, midLat, sunPos, userElements);
      
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
    
    // 1. FASTEST ROUTE WEIGHT: simple physical length
    const fastestPathCoords = this.findPath(startNode, endNode, (edge) => edge.length);
    const fastestDetails = this.getRouteDetails(fastestPathCoords, shadowEngine, sunPos, userElements);
    
    // 2. COOLEST ROUTE WEIGHT: heavily penalises exposed segments
    const coolestPathCoords = this.findPath(startNode, endNode, (edge) => {
      // Find midpoint coordinates
      const p1 = edge.coords[0];
      const p2 = edge.coords[1];
      const midLng = (p1[0] + p2[0]) / 2;
      const midLat = (p1[1] + p2[1]) / 2;
      
      const isShaded = shadowEngine.isCoordinateShaded(midLng, midLat, sunPos, userElements);
      const penalty = isShaded ? 1.0 : 4.0; // 4x penalty for sun exposed paths
      return edge.length * penalty;
    });
    
    const coolestDetails = this.getRouteDetails(coolestPathCoords, shadowEngine, sunPos, userElements);
    
    return {
      fastest: fastestDetails,
      coolest: coolestDetails
    };
  }
}
