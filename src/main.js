import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { ThreeLayer } from './three-layer.js';
import { ShadowEngine } from './shadow-engine.js';
import { UI } from './ui.js';
import { ShadePlanner } from './planner.js';
import { Router } from './router.js';

// Configuration Constants
const PARIS_CENTER = [2.349, 48.853]; // Île de la Cité
const BASE_DATE_STR = '2025-07-15T'; // Hot summer day

class App {
  constructor() {
    this.map = null;
    this.threeLayer = null;
    this.shadowEngine = null;
    this.ui = null;
    this.planner = null;
    this.router = null;
    
    // Application state
    this.currentMinutes = 720; // 12:00 PM solar noon
    this.activeTool = 'none';
    this.selectedPoint = null;
    
    // Routing state
    this.routeStartLngLat = null;
    this.routeEndLngLat = null;
    this.activeRouteView = 'coolest'; // default to coolest shaded route!
    this.routeData = null;
    
    // Snapping / selection state
    this.cursorMarker = null;
    this.startMarker = null;
    this.endMarker = null;
    
    // Live / Weather state
    this.currentMode = 'live'; // 'live' or 'manual'
    this.cityName = 'Paris, France';
    this.timezone = 'Europe/Paris';
    this.weatherInfo = null;
    this.liveClockInterval = null;
    this.weatherRefreshInterval = null;
    
    // Suggestion markers references
    this.suggestionMarkers = [];

    // Data cache
    this.data = {
      buildings: null,
      trees: null,
      roads: null,
      parks: null,
      water: null
    };
  }

  getCurrentDate() {
    const hours = Math.floor(this.currentMinutes / 60);
    const mins = this.currentMinutes % 60;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    const minsStr = mins < 10 ? '0' + mins : mins;
    return new Date(`${BASE_DATE_STR}${hoursStr}:${minsStr}:00`);
  }

  // Resolves local timezone and city name from loaded dataset center
  getCityFromCoordinates(lng, lat) {
    const cities = [
      { name: "Paris, France", lat: 48.8566, lng: 2.3522, timezone: "Europe/Paris" },
      { name: "London, UK", lat: 51.5074, lng: -0.1278, timezone: "Europe/London" },
      { name: "New York, USA", lat: 40.7128, lng: -74.0060, timezone: "America/New_York" },
      { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503, timezone: "Asia/Tokyo" }
    ];
    
    let nearest = cities[0];
    let minDist = Infinity;
    for (const city of cities) {
      const dist = Math.hypot(city.lat - lat, city.lng - lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = city;
      }
    }
    
    if (minDist < 1.0) {
      return nearest;
    }
    return {
      name: `City at [${lat.toFixed(3)}, ${lng.toFixed(3)}]`,
      lat: lat,
      lng: lng,
      timezone: "UTC"
    };
  }

  getDatasetCenter() {
    if (!this.data.roads || this.data.roads.features.length === 0) {
      return PARIS_CENTER;
    }
    
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    
    const sampleSize = Math.min(this.data.roads.features.length, 50);
    for (let i = 0; i < sampleSize; i++) {
      const geom = this.data.roads.features[i].geometry;
      if (geom.type === 'LineString' && geom.coordinates.length > 0) {
        geom.coordinates.forEach(c => {
          sumLng += c[0];
          sumLat += c[1];
          count++;
        });
      }
    }
    
    if (count > 0) {
      return [sumLng / count, sumLat / count];
    }
    return PARIS_CENTER;
  }

  async syncLiveWeather(lat, lng) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather API failed");
      const data = await res.json();
      
      const current = data.current;
      const weather = this.interpretWeatherCode(current.weather_code);
      
      this.weatherInfo = {
        cityName: this.cityName,
        temp: Math.round(current.temperature_2m),
        condition: weather.text,
        icon: weather.icon,
        state: weather.state,
        windSpeed: Math.round(current.wind_speed_10m),
        offline: false,
        lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
      };
      
      this.ui.updateWeatherCard(this.weatherInfo);
      this.updateEnvironmentFromWeather(weather.state);
      console.log("Live weather sync completed:", this.weatherInfo);
    } catch (err) {
      console.warn("Failed to sync live weather, using simulated conditions:", err);
      this.setSimulatedWeather();
    }
  }

  interpretWeatherCode(code) {
    if (code === 0) return { text: "Clear Sky", icon: "☀️", state: "sunny" };
    if (code >= 1 && code <= 3) return { text: "Cloudy", icon: "⛅", state: "cloudy" };
    if (code === 45 || code === 48) return { text: "Foggy", icon: "🌫", state: "cloudy" };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { text: "Rainy", icon: "🌧", state: "rain" };
    if (code >= 71 && code <= 77) return { text: "Snowy", icon: "❄️", state: "cloudy" };
    if (code >= 95) return { text: "Thunderstorm", icon: "⛈", state: "rain" };
    return { text: "Clear Sky", icon: "☀️", state: "sunny" };
  }

  setSimulatedWeather() {
    this.weatherInfo = {
      cityName: this.cityName,
      temp: 31, // Hot summer day
      condition: "Sunny",
      icon: "☀️",
      state: "sunny",
      windSpeed: 8,
      offline: true,
      lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    };
    this.ui.updateWeatherCard(this.weatherInfo);
    this.updateEnvironmentFromWeather("sunny");
  }

  updateEnvironmentFromWeather(state) {
    if (this.threeLayer) {
      this.threeLayer.setWeatherState(state);
      this.updateScene();
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    this.ui.setMode(mode);
    
    if (mode === 'live') {
      this.syncLiveClockAndTime();
      if (!this.liveClockInterval) {
        this.liveClockInterval = setInterval(() => {
          if (this.currentMode === 'live') {
            this.syncLiveClockAndTime();
          }
        }, 10000); // check every 10 seconds
      }
    } else {
      if (this.liveClockInterval) {
        clearInterval(this.liveClockInterval);
        this.liveClockInterval = null;
      }
    }
  }

  getLocalTimeInTimezone(timezone) {
    try {
      const options = {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat([], options);
      const parts = formatter.formatToParts(new Date());
      
      let hour = 12;
      let minute = 0;
      parts.forEach(p => {
        if (p.type === 'hour') hour = parseInt(p.value);
        if (p.type === 'minute') minute = parseInt(p.value);
      });
      
      return { hour, minute, totalMinutes: hour * 60 + minute };
    } catch (e) {
      const now = new Date();
      return { hour: now.getHours(), minute: now.getMinutes(), totalMinutes: now.getHours() * 60 + now.getMinutes() };
    }
  }

  syncLiveClockAndTime() {
    const localTime = this.getLocalTimeInTimezone(this.timezone);
    this.currentMinutes = localTime.totalMinutes;
    
    // Update UI slider values without triggering the input event loop
    const slider = document.getElementById('timeline-slider');
    const display = document.getElementById('time-display-lbl');
    if (slider) {
      slider.value = this.currentMinutes;
    }
    if (display) {
      display.textContent = this.ui.formatTime(this.currentMinutes);
    }
    
    const cityStatus = document.getElementById('slider-city-status');
    if (cityStatus) {
      cityStatus.innerHTML = `🕒 Local Time: ${this.ui.formatTime(this.currentMinutes)} in ${this.cityName.split(',')[0]}`;
    }
    
    this.updateScene();
  }

  async run() {
    // 1. Initialise the map (wider and flatter for cinematic ease-in)
    this.map = new maplibregl.Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: PARIS_CENTER,
      zoom: 14.5, // wider starting view
      pitch: 20,  // flatter starting view
      bearing: 0,
      antialias: true
    });

    // Add navigation controls (zoom, rotate)
    this.map.addControl(new maplibregl.NavigationControl());

    this.map.on('load', async () => {
      console.log("Base map loaded. Initialising application layers...");
      
      // 2. Fetch preprocessed data
      await this.loadData();
      
      // Resolve city coordinates dynamically from loaded dataset
      const center = this.getDatasetCenter();
      const city = this.getCityFromCoordinates(center[0], center[1]);
      this.cityName = city.name;
      this.timezone = city.timezone;
      
      // 3. Setup core engines
      this.shadowEngine = new ShadowEngine();
      this.shadowEngine.setData(this.data.buildings, this.data.trees, this.data.parks);
      
      this.router = new Router(this.data.roads);
      
      // 4. Setup 2D layers
      this.setupMapLayers();
      
      // 5. Setup Three.js custom 3D layer
      this.threeLayer = new ThreeLayer();
      this.map.addLayer(this.threeLayer);
      
      // Load 3D assets
      this.threeLayer.loadBuildings(this.data.buildings);
      this.threeLayer.loadTrees(this.data.trees);
      this.threeLayer.loadWater(this.data.water);
      
      // 6. Setup Planner
      this.planner = new ShadePlanner(
        this.map, 
        this.threeLayer, 
        this.shadowEngine, 
        () => this.updateScene()
      );
      
      // 7. Setup UI and callbacks
      this.setupUI();
      
      // Sync clock and weather
      this.setMode('live');
      await this.syncLiveWeather(center[1], center[0]);
      
      // Auto weather refresh forecasting loop
      this.weatherRefreshInterval = setInterval(() => {
        this.syncLiveWeather(center[1], center[0]);
      }, 600000); // 10 minutes
      
      // Initial scene rendering calculation
      this.updateScene();
      
      // Trigger cinematic intro!
      this.startCinematicIntro();
      
      // Setup Click listener
      this.map.on('click', (e) => this.handleMapClick(e));
      
      // Setup mousemove snap listener
      this.map.on('mousemove', (e) => this.handleMapMouseMove(e));
    });
  }

  // Cinematic fade-in and viewport easing animation on startup
  startCinematicIntro() {
    // 1. Smoothly ease map viewport to target cinematic default
    this.map.easeTo({
      zoom: 16.6,
      pitch: 58,
      bearing: -45,
      duration: 3000,
      easing: (t) => t * (2 - t) // Cubic ease-out
    });
    
    // 2. Fade in the UI container
    const ui = document.getElementById('ui-container');
    if (ui) {
      ui.style.opacity = '0';
      ui.style.transition = 'opacity 2.2s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => {
        ui.style.opacity = '1';
      }, 150);
    }
    
    // 3. Smoothly fade in ambient light and comfort overlay opacity
    let start = null;
    const duration = 2000; // 2 seconds
    
    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const t = Math.min(progress / duration, 1.0);
      
      // Fade in Three.js light intensity
      if (this.threeLayer && this.threeLayer.sunLight) {
        const date = this.getCurrentDate();
        const sunPos = this.shadowEngine.getSunPosition(date);
        const targetIntensity = Math.min(1.3, Math.max(0.1, Math.sin(sunPos.altitude) * 1.8));
        this.threeLayer.sunLight.intensity = targetIntensity * t;
      }
      
      // Fade in MapLibre comfort roads line opacity
      if (this.map.getLayer('comfort-roads-layer')) {
        this.map.setPaintProperty('comfort-roads-layer', 'line-opacity', 0.75 * t);
      }
      
      if (progress < duration) {
        requestAnimationFrame(animate);
      } else {
        this.updateScene(); // final enforce values
      }
    };
    
    requestAnimationFrame(animate);
  }

  async loadData() {
    try {
      const fetchJson = async (url) => {
        const res = await fetch(url);
        return await res.json();
      };
      
      this.data.buildings = await fetchJson('/data/buildings.json');
      this.data.trees = await fetchJson('/data/trees.json');
      this.data.roads = await fetchJson('/data/roads.json');
      this.data.parks = await fetchJson('/data/parks.json');
      this.data.water = await fetchJson('/data/water.json');
      
      console.log("Geospatial data successfully cached.");
    } catch (e) {
      console.error("Failed to load preprocessed data", e);
    }
  }

  setupMapLayers() {
    // Add custom comfort road lines source
    this.map.addSource('comfort-roads', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // Add rendering layer for comfort road paths
    // Thicker lines that change color based on shade comfort index
    this.map.addLayer({
      id: 'comfort-roads-layer',
      type: 'line',
      source: 'comfort-roads',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': ['get', '_comfortColor'],
        'line-width': 4.5,
        'line-opacity': 0.75
      }
    });

    // Add local parks layer
    this.map.addSource('local-parks', {
      type: 'geojson',
      data: this.data.parks
    });

    this.map.addLayer({
      id: 'local-parks-layer',
      type: 'fill',
      source: 'local-parks',
      paint: {
        'fill-color': '#14532d', // soft forest green
        'fill-opacity': 0.5
      }
    });

    // Add local water layer
    this.map.addSource('local-water', {
      type: 'geojson',
      data: this.data.water
    });

    this.map.addLayer({
      id: 'local-water-layer',
      type: 'fill',
      source: 'local-water',
      paint: {
        'fill-color': '#1e3a8a', // deep water blue
        'fill-opacity': 0.7
      }
    });

    // Visual indicators for routing paths
    this.map.addSource('route-path', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    this.map.addLayer({
      id: 'route-path-layer',
      type: 'line',
      source: 'route-path',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity']
      }
    });

    // Add icons for route start and end markers (used as fallback or cleared)
    this.map.addSource('route-endpoints', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    this.map.addLayer({
      id: 'route-endpoints-layer',
      type: 'circle',
      source: 'route-endpoints',
      paint: {
        'circle-radius': 0, // hide since we use custom animated HTML pins!
        'circle-color': '#ffffff'
      }
    });
  }

  setupUI() {
    this.ui = new UI('ui-container', {
      onTimeChange: (minutes) => {
        this.currentMinutes = minutes;
        this.updateScene();
      },
      onToolChange: (tool) => {
        this.activeTool = tool;
        this.clearSuggestions();
      },
      onClearAll: () => {
        this.planner.clearAll();
      },
      onUndo: () => {
        this.planner.undo();
      },
      onSuggest: () => {
        this.generateSmartSuggestions();
      },
      onToggleHeatmap: (checked) => {
        this.map.setLayoutProperty(
          'comfort-roads-layer', 
          'visibility', 
          checked ? 'visible' : 'none'
        );
      },
      onSelectRoute: (type) => {
        this.activeRouteView = type;
        this.renderRouteResult();
      },
      onClearRoute: () => {
        this.routeStartLngLat = null;
        this.routeEndLngLat = null;
        if (this.startMarker) { this.startMarker.remove(); this.startMarker = null; }
        if (this.endMarker) { this.endMarker.remove(); this.endMarker = null; }
        this.map.getSource('route-path').setData({ type: 'FeatureCollection', features: [] });
        this.ui.renderRouteSetup();
      },
      onModeChange: (mode) => {
        this.setMode(mode);
      },
      onStartSelection: (type) => {
        this.startRoutePointSelection(type);
      }
    });
  }

  // Update logic: recalculates sun, shadows, and updates rendering layers
  updateScene() {
    const date = this.getCurrentDate();
    const sunPos = this.shadowEngine.getSunPosition(date);
    
    // 1. Update 3D Three.js lighting
    if (this.threeLayer) {
      this.threeLayer.updateSunLight(sunPos);
    }
    
    // 2. Re-compute comfort values for roads
    const updatedRoads = this.shadowEngine.calculateRoadComfort(
      this.data.roads, 
      date, 
      this.planner ? this.planner.placedElements : []
    );
    
    if (this.map.getSource('comfort-roads')) {
      this.map.getSource('comfort-roads').setData(updatedRoads);
    }

    // 3. Recalculate routes if active
    if (this.routeStartLngLat && this.routeEndLngLat) {
      this.calculateRoutes(true); // silent update without animation
    }

    // 4. Update click analysis popup if showing
    if (this.selectedPoint) {
      const data = this.shadowEngine.analyzePoint(
        this.selectedPoint.lng,
        this.selectedPoint.lat,
        date,
        this.planner ? this.planner.placedElements : []
      );
      this.ui.showAnalysis(data);
    }
  }

  // Starts the interactive marker snapping placement workflow
  startRoutePointSelection(type) {
    this.activeTool = `select-${type}`;
    this.planner.showToast(`Move cursor & click to place the ${type} marker.`);
    
    // Create cursor follower marker if not exists
    if (this.cursorMarker) this.cursorMarker.remove();
    
    const el = document.createElement('div');
    el.className = `route-pin-container ${type} dragging`;
    el.innerHTML = `
      <div class="pin-shadow"></div>
      <div class="pin-icon">
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 9.27 12 20 12 20s12-10.73 12-20c0-6.63-5.37-12-12-12zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="${type === 'start' ? '#22c55e' : '#ef4444'}"/>
        </svg>
      </div>
    `;
    
    this.cursorMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(this.map.getCenter())
      .addTo(this.map);
  }

  handleMapMouseMove(e) {
    if (this.activeTool === 'select-start' || this.activeTool === 'select-end') {
      if (this.cursorMarker) {
        // Snap cursor marker to nearest road node dynamically
        const nearestKey = this.router.findNearestNode(e.lngLat.lng, e.lngLat.lat);
        if (nearestKey) {
          const nearestNodeCoords = this.router.fromKey(nearestKey);
          const dist = turf.distance(turf.point([e.lngLat.lng, e.lngLat.lat]), turf.point(nearestNodeCoords), { units: 'meters' });
          if (dist < 100) {
            this.cursorMarker.setLngLat(nearestNodeCoords);
            return;
          }
        }
        this.cursorMarker.setLngLat(e.lngLat);
      }
    }
  }

  handleMapClick(e) {
    const lngLat = [e.lngLat.lng, e.lngLat.lat];
    
    // If active placement tool is active
    if (this.activeTool === 'tree' || this.activeTool === 'canopy') {
      this.planner.addElement(this.activeTool, lngLat);
      this.ui.resetToolbar(); // reset back to select tool
      return;
    }

    // Handle Interactive Route Selection click
    if (this.activeTool === 'select-start' || this.activeTool === 'select-end') {
      const isStart = this.activeTool === 'select-start';
      const nearestKey = this.router.findNearestNode(lngLat[0], lngLat[1]);
      if (!nearestKey) return;
      const nearestNodeCoords = this.router.fromKey(nearestKey);
      const distance = turf.distance(turf.point(lngLat), turf.point(nearestNodeCoords), { units: 'meters' });
      
      if (distance > 100) {
        this.planner.showToast("Please click closer to a pedestrian path.");
        return;
      }
      
      // Remove cursor marker
      if (this.cursorMarker) {
        this.cursorMarker.remove();
        this.cursorMarker = null;
      }
      
      if (isStart) {
        this.routeStartLngLat = nearestNodeCoords;
        if (this.startMarker) this.startMarker.remove();
        
        const el = document.createElement('div');
        el.className = 'route-pin-container start dropping';
        el.innerHTML = `
          <div class="pin-shadow"></div>
          <div class="pin-icon">
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9.27 12 20 12 20s12-10.73 12-20c0-6.63-5.37-12-12-12zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="#22c55e"/>
            </svg>
          </div>
        `;
        this.startMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(this.routeStartLngLat)
          .addTo(this.map);
          
        this.ui.updateRouteSetup('start', this.routeStartLngLat);
        this.activeTool = 'none';
        
        // Auto trigger destination selection for smoother demo flow!
        setTimeout(() => {
          this.startRoutePointSelection('end');
        }, 800);
      } else {
        this.routeEndLngLat = nearestNodeCoords;
        if (this.endMarker) this.endMarker.remove();
        
        const el = document.createElement('div');
        el.className = 'route-pin-container end dropping';
        el.innerHTML = `
          <div class="pin-shadow"></div>
          <div class="pin-icon">
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9.27 12 20 12 20s12-10.73 12-20c0-6.63-5.37-12-12-12zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="#ef4444"/>
            </svg>
          </div>
        `;
        this.endMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(this.routeEndLngLat)
          .addTo(this.map);
          
        this.ui.updateRouteSetup('end', this.routeEndLngLat);
        this.activeTool = 'none';
        
        // Generate routes and trigger drawing animation
        this.calculateRoutes(false);
      }
      return;
    }

    // Standard point click analysis
    this.selectedPoint = e.lngLat;
    const date = this.getCurrentDate();
    const data = this.shadowEngine.analyzePoint(
      lngLat[0], 
      lngLat[1], 
      date,
      this.planner ? this.planner.placedElements : []
    );
    
    this.ui.showAnalysis(data);
    
    // Highlight clicked building in 3D
    let buildingFeature = null;
    const pt = turf.point(lngLat);
    for (const b of this.data.buildings.features) {
      if (turf.booleanPointInPolygon(pt, b)) {
        buildingFeature = b;
        break;
      }
    }
    
    this.threeLayer.highlightBuilding(buildingFeature);
  }

  // Routing Calculation
  calculateRoutes(silent = false) {
    if (!this.routeStartLngLat || !this.routeEndLngLat) return;
    
    const date = this.getCurrentDate();
    const routeResults = this.router.compareRoutes(
      this.routeStartLngLat,
      this.routeEndLngLat,
      this.shadowEngine,
      date,
      this.planner.placedElements
    );
    
    if (!routeResults) {
      this.planner.showToast("Could not find a valid walking route between these points.");
      return;
    }
    
    this.routeData = routeResults;
    
    if (silent) {
      this.renderRouteResult();
    } else {
      this.animateRouteDrawing(routeResults);
    }
  }

  // Incremental drawing animation for drawing both paths
  animateRouteDrawing(routeResults) {
    const fastestCoords = routeResults.fastest.geometry.coordinates;
    const coolestCoords = routeResults.coolest.geometry.coordinates;
    
    let step = 0;
    const steps = 45; // ~750ms
    
    const drawFrame = () => {
      step++;
      const progress = Math.min(step / steps, 1.0);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      
      const fCount = Math.max(2, Math.ceil(fastestCoords.length * easeProgress));
      const cCount = Math.max(2, Math.ceil(coolestCoords.length * easeProgress));
      
      const fCoords = fastestCoords.slice(0, fCount);
      const cCoords = coolestCoords.slice(0, cCount);
      
      const features = [
        {
          type: 'Feature',
          properties: {
            color: '#f59e0b', // amber fastest
            width: 5,
            opacity: 0.65
          },
          geometry: { type: 'LineString', coordinates: fCoords }
        },
        {
          type: 'Feature',
          properties: {
            color: '#0ea5e9', // sky blue coolest
            width: 5,
            opacity: 0.65
          },
          geometry: { type: 'LineString', coordinates: cCoords }
        }
      ];
      
      this.map.getSource('route-path').setData({
        type: 'FeatureCollection',
        features: features
      });
      
      if (step < steps) {
        requestAnimationFrame(drawFrame);
      } else {
        // Enforce final selected visual styles and trigger comparison reveal
        this.ui.showRouteComparison(routeResults);
        this.renderRouteResult();
        this.ui.animateRoutePanelReveal();
      }
    };
    
    requestAnimationFrame(drawFrame);
  }

  renderRouteResult() {
    if (!this.routeData) return;
    
    const fastestCoords = this.routeData.fastest.geometry.coordinates;
    const coolestCoords = this.routeData.coolest.geometry.coordinates;
    
    const features = [];
    
    // Render both paths together for visual comparison. Highlight the selected one.
    features.push({
      type: 'Feature',
      properties: {
        color: '#f59e0b',
        width: this.activeRouteView === 'fastest' ? 8 : 4.5,
        opacity: this.activeRouteView === 'fastest' ? 0.95 : 0.35
      },
      geometry: { type: 'LineString', coordinates: fastestCoords }
    });
    
    features.push({
      type: 'Feature',
      properties: {
        color: '#0ea5e9',
        width: this.activeRouteView === 'coolest' ? 8 : 4.5,
        opacity: this.activeRouteView === 'coolest' ? 0.95 : 0.35
      },
      geometry: { type: 'LineString', coordinates: coolestCoords }
    });
    
    this.map.getSource('route-path').setData({
      type: 'FeatureCollection',
      features: features
    });
  }

  // Planner Suggestions
  generateSmartSuggestions() {
    this.clearSuggestions();
    
    const date = this.getCurrentDate();
    const suggestions = this.planner.generateSuggestions(this.data.roads, date);
    
    if (suggestions.length === 0) {
      this.planner.showToast("No hot spots found! Placements are already optimal.");
      return;
    }
    
    this.planner.showToast(`Found ${suggestions.length} hot spots! Click on any bulb marker to plant a tree.`);
    
    suggestions.forEach(cand => {
      const el = document.createElement('div');
      el.className = 'suggestion-marker';
      el.title = `Suggested Tree Placement for ${cand.roadName}`;
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(cand.lngLat)
        .addTo(this.map);
        
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.planner.addElement('tree', cand.lngLat);
        marker.remove();
        this.suggestionMarkers = this.suggestionMarkers.filter(m => m !== marker);
      });
      
      this.suggestionMarkers.push(marker);
    });
  }

  clearSuggestions() {
    this.suggestionMarkers.forEach(m => m.remove());
    this.suggestionMarkers = [];
  }
}

// Start application on load
const app = new App();
app.run();
