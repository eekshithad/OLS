import geopandas as gpd
import rasterio
import numpy as np
from rasterstats import zonal_stats

# -----------------------------
# INPUT FILES
# -----------------------------
buildings_geojson = r"D:\building\polygon_all.geojson"
dsm_path = r"D:\tif files\DIAL_DSM_50cm.tif"
dtm_path = r"D:\tif files\DIAL_DTM_50cm.tif"
output_geojson = r"D:\building\heights_building.geojson"

# -----------------------------
# READ BUILDINGS
# -----------------------------
gdf = gpd.read_file(buildings_geojson)

# -----------------------------
# READ RASTERS
# -----------------------------
with rasterio.open(dsm_path) as src_dsm:
    dsm = src_dsm.read(1).astype(float)
    raster_crs = src_dsm.crs
    transform = src_dsm.transform

with rasterio.open(dtm_path) as src_dtm:
    dtm = src_dtm.read(1).astype(float)

# -----------------------------
# COMPUTE HEIGHT RASTER
# -----------------------------
height_raster = dsm - dtm

# -----------------------------
# REPROJECT POLYGONS IF NEEDED
# -----------------------------
if gdf.crs != raster_crs:
    print("Reprojecting polygons to raster CRS...")
    gdf = gdf.to_crs(raster_crs)

# -----------------------------
# ZONAL STATS ON HEIGHT RASTER
# -----------------------------
height_stats = zonal_stats(
    gdf,
    height_raster,
    affine=transform,
    stats=["mean", "median", "majority"],
    nodata=0
)

# -----------------------------
# ATTACH RESULTS TO GEODATAFRAME
# -----------------------------
gdf["height_mean"] = [s["mean"] for s in height_stats]
gdf["height_median"] = [s["median"] for s in height_stats]
gdf["height_mode"] = [s["majority"] for s in height_stats]

# -----------------------------
# SAVE GEOJSON (BACK TO EPSG:4326)
# -----------------------------
gdf = gdf.to_crs(epsg=4326)
gdf.to_file(output_geojson, driver="GeoJSON")

print("✔ Height statistics saved to:", output_geojson)
