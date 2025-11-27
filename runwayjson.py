#!/usr/bin/env python3
import json
import math

# --- Input coordinates ---
runway_coords = [
    [28.56883, 77.08464],
    [28.56000, 77.12600],
    [28.55500, 77.12525],
    [28.56550, 77.08200]
]

# Heights in meters
ellipse1_height = 5.0
ellipse2_height = 10.0

# Trapezoid/extension parameters
extension_distance = 1000  # meters
extension_angle_deg = 35.0
height_increase_deg1 = 3.5
height_increase_deg2 = 7.5

# Earth radius
R = 6378137.0

def midpoint(a, b):
    return [(a[0]+b[0])/2, (a[1]+b[1])/2]

def destination(latlon, distance_m, bearing_deg):
    """Given lat/lon, distance (m), and bearing (deg), return destination lat/lon"""
    lat1 = math.radians(latlon[0])
    lon1 = math.radians(latlon[1])
    brng = math.radians(bearing_deg)
    dr = distance_m / R

    lat2 = math.asin(math.sin(lat1)*math.cos(dr) + math.cos(lat1)*math.sin(dr)*math.cos(brng))
    lon2 = lon1 + math.atan2(math.sin(brng)*math.sin(dr)*math.cos(lat1),
                             math.cos(dr) - math.sin(lat1)*math.sin(lat2))
    return [math.degrees(lat2), math.degrees(lon2)]

def distance_m(a, b):
    """Haversine distance in meters"""
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    x = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(x))

def compute_ellipse_coords(a, b, center, angle_deg, num_points=180):
    """Generate geodesic ellipse coordinates"""
    coords = []
    theta0 = math.radians(angle_deg)
    for i in range(num_points+1):
        t = i / num_points * 2 * math.pi
        u = a * math.cos(t)
        v = b * math.sin(t)
        north = u*math.cos(theta0) - v*math.sin(theta0)
        east  = u*math.sin(theta0) + v*math.cos(theta0)
        dist = math.hypot(north, east)
        brng = math.degrees(math.atan2(east, north))
        coords.append(destination(center, dist, brng))
    return coords

# --- Compute rectangle bounds ---
rect = runway_coords

# Foci (midpoints of short sides)
shortA = midpoint(rect[1], rect[2])
shortB = midpoint(rect[0], rect[3])
foci_dist = distance_m(shortA, shortB)

# Semi-major axes
runway_length = max(distance_m(rect[i], rect[(i+1)%4]) for i in range(4))
major1 = runway_length / 2 + 250  # ellipse1
major2 = runway_length / 2 + 500  # ellipse2
c = foci_dist / 2
a1 = max(major1, c+10)
a2 = max(major2, c+10)
b1 = math.sqrt(a1**2 - c**2)
b2 = math.sqrt(a2**2 - c**2)

center = midpoint(shortA, shortB)
bearing = math.degrees(math.atan2(shortB[1]-shortA[1], shortB[0]-shortA[0]))

# --- Build GeoJSON ---
features = []

# Runway rectangle
features.append({
    "type": "Feature",
    "properties": {"type": "runway", "height": 0},
    "geometry": {"type": "Polygon", "coordinates": [rect + [rect[0]]] }
})

# Ellipses
ellipse1_coords = compute_ellipse_coords(a1, b1, center, bearing)
ellipse2_coords = compute_ellipse_coords(a2, b2, center, bearing)
features.append({
    "type": "Feature",
    "properties": {"type": "ellipse1", "height": ellipse1_height},
    "geometry": {"type": "Polygon", "coordinates": [ellipse1_coords]}
})
features.append({
    "type": "Feature",
    "properties": {"type": "ellipse2", "height": ellipse2_height},
    "geometry": {"type": "Polygon", "coordinates": [ellipse2_coords]}
})

# Runway trapezoid extensions (simplified as widening each short side)
def build_extension(p1, p2, angle_deg, height_inc):
    mid = midpoint(p1, p2)
    bearing_to_center = math.degrees(math.atan2(center[1]-mid[1], center[0]-mid[0])) + 180
    ext1 = destination(p1, extension_distance, bearing_to_center-angle_deg)
    ext2 = destination(p1, extension_distance, bearing_to_center+angle_deg)
    ext3 = destination(p2, extension_distance, bearing_to_center+angle_deg)
    ext4 = destination(p2, extension_distance, bearing_to_center-angle_deg)
    return [p1, p2, ext3, ext4]

features.append({
    "type": "Feature",
    "properties": {"type": "extensionA", "height": ellipse1_height * 0.7},
    "geometry": {"type": "Polygon", "coordinates": [build_extension(rect[1], rect[2], extension_angle_deg, height_increase_deg1)]}
})
features.append({
    "type": "Feature",
    "properties": {"type": "extensionB", "height": ellipse2_height * 0.75},
    "geometry": {"type": "Polygon", "coordinates": [build_extension(rect[0], rect[3], extension_angle_deg, height_increase_deg2)]}
})

geojson = {"type": "FeatureCollection", "features": features}

with open("runway_ellipses.geojson", "w") as f:
    json.dump(geojson, f, indent=2)

print("GeoJSON file 'runway_ellipses.geojson' generated!")
