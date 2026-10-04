import math
from app.data.types import GridPoint


def snap_to_grid(lat: float, lon: float, resolution: float = 0.1) -> GridPoint:
    """
    Snap latitude and longitude to the nearest ERA5-Land grid cell (0.1 degree resolution ~9-11 km).
    Returns GridPoint with standard grid_key format 'lat,lon' (e.g., '20.0,73.8').
    """
    snapped_lat = round(round(lat / resolution) * resolution, 4)
    snapped_lon = round(round(lon / resolution) * resolution, 4)
    grid_key = f"{snapped_lat:.1f},{snapped_lon:.1f}"
    return GridPoint(grid_key=grid_key, lat=snapped_lat, lon=snapped_lon)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in kilometers between two points
    on the earth (specified in decimal degrees).
    """
    r = 6371.0  # Earth's radius in kilometers

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c
