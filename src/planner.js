import * as turf from '@turf/turf';

export class ShadePlanner {
  constructor(map, threeLayer, shadowEngine, onUpdateCallback) {
    this.map = map;
    this.threeLayer = threeLayer;
    this.shadowEngine = shadowEngine;
    this.onUpdateCallback = onUpdateCallback;
    
    this.placedElements = []; // { id, type, lngLat, height, canopyRadius }
    this.suggestions = [];
  }

  addElement(type, lngLat) {
    const id = 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const height = type === 'tree' ? 10.0 : 3.5; // Tree is 10m, Canopy is 3.5m high
    const canopyRadius = type === 'tree' ? 3.5 : 2.5; // canopy radius or width helper
    
    const elem = { id, type, lngLat, height, canopyRadius };
    this.placedElements.push(elem);
    
    // Add to 3D view
    this.threeLayer.addUserElement(id, type, lngLat, height, canopyRadius);
    
    // Trigger update callback
    this.onUpdateCallback();
    
    // Show toast message with dynamic shade area estimate
    // A tree of 3.5m radius has area = pi * 3.5^2 ~= 38m2
    const shadeArea = type === 'tree' ? 38 : 24;
    this.showToast(`Placed a ${type}! Added ~${shadeArea}m² of potential shade coverage.`);
    
    return elem;
  }

  undo() {
    if (this.placedElements.length === 0) return;
    const popped = this.placedElements.pop();
    this.threeLayer.removeUserElement(popped.id);
    this.onUpdateCallback();
    this.showToast(`Removed last placed ${popped.type}.`);
  }

  clearAll() {
    if (this.placedElements.length === 0) return;
    this.placedElements = [];
    this.threeLayer.clearUserElements();
    this.onUpdateCallback();
    this.showToast("Cleared all custom shade placements.");
  }

  showToast(message) {
    // Remove existing toasts
    const existing = document.querySelector('.impact-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'impact-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-remove after 3.5s
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  // Suggest where to place trees along the hottest, most exposed roads
  generateSuggestions(roadsFeatureCollection, date) {
    if (!roadsFeatureCollection) return [];
    
    const sunPos = this.shadowEngine.getSunPosition(date);
    const candidates = [];
    
    // Loop through roads and check shade
    roadsFeatureCollection.features.forEach(road => {
      const geom = road.geometry;
      if (geom.type !== 'LineString') return;
      
      const comfortScore = road.properties._comfortScore;
      const roadName = road.properties.name || "Pedestrian Path";
      
      // Target roads that are Hot (1) or Dangerous (0)
      if (comfortScore <= 1) {
        const coords = geom.coordinates;
        // Sample candidate spots along the line (endpoints and midpoints)
        const samplePoints = [
          coords[0],
          coords[Math.floor(coords.length / 2)],
          coords[coords.length - 1]
        ];
        
        samplePoints.forEach(pt => {
          // Check if already shaded. If not, it's a good place for a tree!
          const isShaded = this.shadowEngine.isCoordinateShaded(pt[0], pt[1], sunPos, this.placedElements);
          if (!isShaded) {
            candidates.push({
              lngLat: pt,
              roadName: roadName,
              score: comfortScore === 0 ? 100 : 50 // higher priority for dangerous streets
            });
          }
        });
      }
    });

    // Sort candidates by score and grab top 6 unique locations, spreading them across different streets
    candidates.sort((a, b) => b.score - a.score);
    
    const uniqueCandidates = [];
    const seenStreets = new Set();
    
    for (const cand of candidates) {
      // 1. Enforce unique street name (if not generic path) to avoid clustering
      if (cand.roadName !== "Pedestrian Path" && seenStreets.has(cand.roadName)) {
        continue;
      }
      
      // 2. Enforce minimum distance separation of 120 meters
      let tooClose = false;
      for (const selected of uniqueCandidates) {
        const dist = turf.distance(turf.point(cand.lngLat), turf.point(selected.lngLat), { units: 'meters' });
        if (dist < 120) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      seenStreets.add(cand.roadName);
      uniqueCandidates.push(cand);
      
      if (uniqueCandidates.length >= 6) break;
    }
    
    this.suggestions = uniqueCandidates;
    return this.suggestions;
  }
}
