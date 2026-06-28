import os
import json
import glob

# Constants
BBOX = {
    'min_lng': 2.340,
    'max_lng': 2.360,
    'min_lat': 48.845,
    'max_lat': 48.858
}

def is_point_in_bbox(lng, lat):
    return BBOX['min_lng'] <= lng <= BBOX['max_lng'] and BBOX['min_lat'] <= lat <= BBOX['max_lat']

def bbox_intersects(feature_bbox):
    # check if feature bbox overlaps target bbox
    return not (feature_bbox['max_lng'] < BBOX['min_lng'] or
                feature_bbox['min_lng'] > BBOX['max_lng'] or
                feature_bbox['max_lat'] < BBOX['min_lat'] or
                feature_bbox['min_lat'] > BBOX['max_lat'])

def get_coords_bbox(coords, geom_type):
    # Flatten coordinates to find bounding box
    flat = []
    if geom_type == 'Point':
        flat = [coords]
    elif geom_type == 'LineString':
        flat = coords
    elif geom_type == 'Polygon':
        flat = [pt for ring in coords for pt in ring]
    elif geom_type == 'MultiLineString':
        flat = [pt for line in coords for pt in line]
    elif geom_type == 'MultiPolygon':
        flat = [pt for poly in coords for ring in poly for pt in ring]
    
    if not flat:
        return None
        
    lngs = [pt[0] for pt in flat]
    lats = [pt[1] for pt in flat]
    return {
        'min_lng': min(lngs),
        'max_lng': max(lngs),
        'min_lat': min(lats),
        'max_lat': max(lats)
    }

def process_file(file_path, output_path, type_name):
    print(f"Processing {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    features = data.get('features', [])
    processed_features = []
    
    for feature in features:
        geom = feature.get('geometry')
        if not geom:
            continue
            
        g_type = geom.get('type')
        coords = geom.get('coordinates')
        if not coords:
            continue
            
        # Get coordinates bounding box
        f_bbox = get_coords_bbox(coords, g_type)
        if not f_bbox or not bbox_intersects(f_bbox):
            continue
            
        # Enrich and filter
        props = feature.get('properties', {})
        new_props = {}
        
        if type_name == 'buildings':
            # Skip non-buildings or building nodes
            if props.get('building') is None:
                continue
            # Height estimation
            height = None
            if 'height' in props:
                try:
                    height = float(props['height'].replace('m', '').strip())
                except ValueError:
                    pass
            
            if height is None and 'building:levels' in props:
                try:
                    levels = float(props['building:levels'])
                    height = levels * 3.5
                except ValueError:
                    pass
            
            if height is None:
                b_type = props.get('building', 'yes')
                if b_type == 'apartments':
                    height = 18.0
                elif b_type in ['church', 'cathedral']:
                    height = 25.0
                else:
                    height = 15.0 # Typical Paris height
                    
            new_props['_height'] = height
            new_props['name'] = props.get('name')
            new_props['building'] = props.get('building')
            
        elif type_name == 'trees':
            # Height estimation
            height = 8.0
            if 'height' in props:
                try:
                    height = float(props['height'].replace('m', '').strip())
                except ValueError:
                    pass
            
            new_props['_height'] = height
            new_props['_canopyRadius'] = min(height * 0.35, 6.0)
            new_props['species'] = props.get('species')
            new_props['genus'] = props.get('genus')
            
        elif type_name == 'roads':
            hw = props.get('highway')
            if hw not in ['footway', 'pedestrian', 'residential', 'path', 'living_street', 'steps', 'service']:
                continue
            new_props['highway'] = hw
            new_props['name'] = props.get('name')
            new_props['surface'] = props.get('surface')
            
        elif type_name == 'parks':
            if props.get('leisure') != 'park' and props.get('landuse') != 'grass':
                continue
            new_props['leisure'] = props.get('leisure')
            new_props['name'] = props.get('name')
            
        elif type_name == 'water':
            new_props['natural'] = props.get('natural')
            new_props['water'] = props.get('water')
            new_props['name'] = props.get('name')
            
        # construct clean feature
        clean_feature = {
            'type': 'Feature',
            'properties': new_props,
            'geometry': geom
        }
        processed_features.append(clean_feature)
        
    output_collection = {
        'type': 'FeatureCollection',
        'features': processed_features
    }
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_collection, f, separators=(',', ':'))
    print(f"Saved {len(processed_features)} features to {output_path}")

def main():
    search_dir = 'data/osm/paris/'
    files = glob.glob(os.path.join(search_dir, '*.geojson'))
    
    if not files:
        print(f"No GeoJSON files found in {search_dir}")
        return
        
    # Auto-discover categories based on filenames
    mapping = {
        'building': ('buildings', 'public/data/buildings.json'),
        'tree': ('trees', 'public/data/trees.json'),
        'highway': ('roads', 'public/data/roads.json'),
        'park': ('parks', 'public/data/parks.json'),
        'water': ('water', 'public/data/water.json')
    }
    
    for fp in files:
        filename = os.path.basename(fp).lower()
        matched = False
        for key, (type_name, out_path) in mapping.items():
            if key in filename:
                process_file(fp, out_path, type_name)
                matched = True
                break
        if not matched:
            print(f"Skipping unmapped file: {fp}")

if __name__ == '__main__':
    main()
