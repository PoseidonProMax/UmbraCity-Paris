# 🌆 UmbraCity

> **The coolest route is the shadiest one — sun-smart streets for smarter walkers.**

UmbraCity is a real-time, 3D pedestrian navigation system that routes you through the shadiest streets in the city. It uses actual building heights, tree canopy data, and live sun geometry to calculate where shadows fall *right now* — and colors every road by how comfortable (or dangerous) it is to walk on.

Built for **FutureHacks 2026** — *Build the city of tomorrow, today.*

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Live Heat Map** | Every pedestrian road color-coded by shade comfort in real time |
| 🧭 **Coolest vs Fastest Route** | Shade-optimized routing using a modified Dijkstra's algorithm |
| 🌳 **Urban Shade Planner** | Place virtual trees and canopies, watch shadows update live |
| 💡 **Smart Suggest** | Auto-detects the 6 hottest exposed road segments and recommends tree placements |
| 🏛️ **Landmark Explorer** | Interactive 3D markers for Notre-Dame, Pont Neuf, Sorbonne, and more |
| ⏱️ **Time Slider** | Scrub through the day and watch sun shadows sweep across the city |
| 🌤️ **Live Weather** | Real-time weather from Open-Meteo API synced to the 3D scene |
| 🎵 **Ambient Audio** | Procedurally synthesized soundscape — zero audio files downloaded |

---

## 🖼️ Screenshots

> *Paris, Île de la Cité — 3D shadow simulation at solar noon*

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (ES Modules), Python |
| Build Tool | Vite |
| Map Engine | MapLibre GL JS |
| 3D Rendering | Three.js (custom WebGL layer) |
| Geospatial | Turf.js |
| Sun Position | SunCalc |
| Weather API | Open-Meteo |
| Audio | Web Audio API (procedural synthesis) |
| Data Source | OpenStreetMap (GeoJSON exports) |
| Preprocessing | Python 3 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Python 3 (for data preprocessing only)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/umbracity.git
cd umbracity

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

> **Note:** The preprocessed data files in `public/data/` are already included. You only need to re-run the Python script if you change the OSM source data.

---

## 📁 Project Structure

```
umbracity/
├── src/
│   ├── main.js            # App entry point & orchestration
│   ├── shadow-engine.js   # Sun position, shadow projection & comfort scoring
│   ├── router.js          # Dijkstra's pathfinding (fastest & coolest routes)
│   ├── planner.js         # Urban shade placement tool & smart suggestions
│   ├── three-layer.js     # Three.js 3D buildings, trees, water & lighting
│   ├── ui.js              # All UI panels, modals & interactions
│   └── audio-engine.js    # Procedural ambient audio synthesizer
├── scripts/
│   └── preprocess.py      # OSM GeoJSON → optimized JSON pipeline
├── data/
│   └── osm/paris/         # Raw OpenStreetMap exports (6 datasets)
│       ├── export_buildings.geojson   (35 MB)
│       ├── export_trees.geojson       (9.2 MB)
│       ├── export_highways.geojson    (30.7 MB)
│       ├── export_parks.geojson
│       ├── export_water.geojson
│       └── export_river.geojson
├── public/
│   └── data/              # Preprocessed, minified JSON (served to browser)
│       ├── buildings.json
│       ├── trees.json
│       ├── roads.json
│       ├── parks.json
│       └── water.json
├── index.html
├── style.css
└── vite.config.js
```

---

## 🧠 How the Shadow Engine Works

### 1. Sun Position
Using [SunCalc](https://github.com/mourner/suncalc) with Paris coordinates (48.853°N, 2.349°E) and the current time to compute sun altitude and azimuth.

### 2. Shadow Projection
For every building and tree:

$$\text{shadowLength} = \frac{\text{height}}{\tan(\text{sunAltitude})}$$

Building shadows are computed as the **convex hull** of the original footprint + the footprint translated in the shadow direction. Tree shadows are modeled as **projected circles**.

### 3. Spatial Indexing
All shadows are indexed into a **15×15 spatial grid** over the map area for O(1) lookup — making real-time road analysis possible without freezing the browser.

### 4. Comfort Scoring

| Score | Label | Condition | Color |
|---|---|---|---|
| 3 | Comfortable | Night or shaded by building/tree | 🟢 `#22c55e` |
| 2 | Warm | In a park, unshaded | 🟡 `#eab308` |
| 1 | Hot | Exposed, sun altitude ≤ 50° | 🟠 `#f97316` |
| 0 | Dangerous | Exposed, sun altitude > 50° | 🔴 `#ef4444` |

### 5. Shade-Aware Routing
Dijkstra's algorithm with a custom edge weight:

$$w = \text{length} \times \begin{cases} 1.0 & \text{if shaded} \\ 7.0 & \text{if exposed} \end{cases}$$

The 7× penalty on exposed segments steers the route through shade, even at the cost of a slightly longer distance.

---

## 🗄️ Data Preprocessing

To regenerate the processed data from OSM exports:

```bash
# Place your .geojson files in data/osm/paris/
python scripts/preprocess.py
```

The script:
- Clips features to the bounding box (`2.340°–2.360°E`, `48.845°–48.858°N`)
- Estimates building heights from OSM tags (`height`, `building:levels`)
- Calculates tree canopy radii (`min(height × 0.35, 6.0m)`)
- Filters roads to pedestrian-relevant highway types only
- Outputs minified JSON to `public/data/`

---

## 🌍 Using a Different City

UmbraCity is designed to generalize. To use it for another city:

1. Export the relevant OSM layers for your city from [Overpass Turbo](https://overpass-turbo.eu/) or [OpenStreetMap](https://www.openstreetmap.org/export)
2. Place the GeoJSON files in `data/osm/<your-city>/`
3. Update the `BBOX` in `scripts/preprocess.py` to match your city bounds
4. Run `python scripts/preprocess.py`
5. Update `PARIS_CENTER` in `src/main.js` to your city's coordinates
6. Add your city to the `cities` lookup in `getCityFromCoordinates()`

---

## 📜 License

MIT © 2026 UmbraCity

---

## 💡 Acknowledgements

- **OpenStreetMap** contributors for the incredible open geodata
- **SunCalc** by Vladimir Agafonkin for accurate sun position math
- **MapLibre GL JS** for the open-source map renderer
- **Turf.js** for geospatial operations
- **Three.js** for WebGL 3D rendering
- **Open-Meteo** for free weather API access

---

> *Heat doesn't discriminate, but survival does. The least we can do is make the street a little cooler.*
>
> **Follow the shadows, not the sun. 🌿**
