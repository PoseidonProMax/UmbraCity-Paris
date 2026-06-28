# 🌆 UmbraCity

> **The coolest route is the shadiest one — sun-smart streets for smarter walkers.**

UmbraCity is a real-time, 3D pedestrian navigation system that routes you through the **shadiest streets** in the city. It uses actual building heights, tree canopy data, and live sun geometry to calculate where shadows fall *right now* — and colors every road by how comfortable (or dangerous) it is to walk on.

Built for **FutureHacks 2026** — *Build the city of tomorrow, today.*

🔗 **GitHub:** [github.com/PoseidonProMax/UmbraCity-Paris](https://github.com/PoseidonProMax/UmbraCity-Paris)

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
| 🎵 **Ambient Audio** | Procedurally synthesized soundscape — zero audio files |

---

## 🚀 Installation & Running

### Prerequisites

- **Node.js** (v18 or higher) — [nodejs.org](https://nodejs.org/)

That's it. No Python, no database, no cloud setup required to run the app.

---

### Option A — Download ZIP from GitHub

1. Go to [github.com/PoseidonProMax/UmbraCity-Paris](https://github.com/PoseidonProMax/UmbraCity-Paris)
2. Click **Code → Download ZIP**
3. Extract the ZIP to a folder of your choice
4. Open a terminal in that folder and run:

```bash
npm install
npm run dev
```

5. Open your browser and go to **`http://localhost:5173`**

> ✅ The preprocessed map data is already included in `public/data/` — no extra steps needed.

---

### Option B — Clone with Git

```bash
git clone https://github.com/PoseidonProMax/UmbraCity-Paris.git
cd UmbraCity-Paris
npm install
npm run dev
```

Then open **`http://localhost:5173`**.

---

## 📁 Project Structure

```
UmbraCity-Paris/
├── src/
│   ├── main.js            # App entry point & orchestration
│   ├── shadow-engine.js   # Sun position, shadow projection & comfort scoring
│   ├── router.js          # Dijkstra's pathfinding (fastest & coolest routes)
│   ├── planner.js         # Shade placement tool & AI smart suggestions
│   ├── three-layer.js     # Three.js 3D buildings, trees, water & lighting
│   ├── ui.js              # All UI panels, modals & interactions
│   └── audio-engine.js    # Procedural ambient audio synthesizer
├── scripts/
│   └── preprocess.py      # (Optional) OSM GeoJSON → optimized JSON pipeline
├── data/
│   └── osm/paris/         # Raw OpenStreetMap source exports
├── public/
│   └── data/              # ✅ Pre-built data — ready to use, no setup needed
│       ├── buildings.json
│       ├── trees.json
│       ├── roads.json
│       ├── parks.json
│       └── water.json
├── index.html
├── style.css
├── package.json
└── vite.config.js
```

---

## 🧠 How It Works

### Shadow Engine
For any given time of day, UmbraCity computes sun position using the SunCalc library and projects shadows from every building and tree:

$$\text{shadowLength} = \frac{\text{height}}{\tan(\text{sunAltitude})}$$

All shadows are indexed in a **15×15 spatial grid** for fast O(1) lookup, making real-time road analysis possible at 60fps.

### Comfort Scoring

| Score | Label | Condition | Color |
|---|---|---|---|
| 3 | Comfortable | Shaded by building or tree | 🟢 |
| 2 | Warm | In a park, unshaded | 🟡 |
| 1 | Hot | Exposed, sun altitude ≤ 50° | 🟠 |
| 0 | Dangerous | Exposed, sun altitude > 50° | 🔴 |

### Shade-Aware Routing
Dijkstra's algorithm with a custom edge weight:

$$w = \text{length} \times \begin{cases} 1.0 & \text{if shaded} \\ 7.0 & \text{if exposed} \end{cases}$$

The **7× penalty** on exposed segments steers routes through shade — even if the path is slightly longer.

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (ES Modules), Python |
| Build Tool | Vite |
| Map Engine | MapLibre GL JS |
| 3D Rendering | Three.js |
| Geospatial | Turf.js |
| Sun Position | SunCalc |
| Weather API | Open-Meteo |
| Audio | Web Audio API |
| Data Source | OpenStreetMap |

---

## 🗄️ (Optional) Regenerating Map Data

The `public/data/` files are already included so you don't need to do this. But if you want to update the OSM data:

1. Make sure you have **Python 3** installed
2. Create a virtual environment and install nothing (only built-in libraries used):

```bash
python scripts/preprocess.py
```

Or use the npm shortcut (requires `.venv` to be set up):

```bash
npm run preprocess
```

---

## 🌍 Adapting to Another City

1. Export OSM layers for your city from [overpass-turbo.eu](https://overpass-turbo.eu/)
2. Place the `.geojson` files in `data/osm/<your-city>/`
3. Update the `BBOX` in `scripts/preprocess.py` to your city's bounding box
4. Run `python scripts/preprocess.py`
5. Update `PARIS_CENTER` in `src/main.js` with your city's coordinates
6. Add your city to the `cities` lookup in `getCityFromCoordinates()`

---

## 📜 License

MIT © 2026 UmbraCity

---

## 💡 Acknowledgements

- [OpenStreetMap](https://www.openstreetmap.org/) contributors for open geodata
- [SunCalc](https://github.com/mourner/suncalc) by Vladimir Agafonkin
- [MapLibre GL JS](https://maplibre.org/) — open-source map renderer
- [Turf.js](https://turfjs.org/) — geospatial analysis
- [Three.js](https://threejs.org/) — WebGL 3D rendering
- [Open-Meteo](https://open-meteo.com/) — free weather API

---

> *Heat doesn't discriminate, but survival does. The least we can do is make the street a little cooler.*
>
> **Follow the shadows, not the sun. 🌿**
