from app.data.locations.grid import haversine_distance_km, snap_to_grid


def test_snap_to_grid_basic():
    gp = snap_to_grid(20.0456, 73.8123)
    assert gp.grid_key == "20.0,73.8"
    assert round(gp.lat, 1) == 20.0
    assert round(gp.lon, 1) == 73.8


def test_snap_to_grid_rounding_up():
    gp = snap_to_grid(20.06, 73.86)
    assert gp.grid_key == "20.1,73.9"
    assert gp.lat == 20.1
    assert gp.lon == 73.9


def test_haversine_distance_same_point():
    d = haversine_distance_km(20.0, 73.8, 20.0, 73.8)
    assert d == 0.0


def test_haversine_distance_known_distance():
    # Mumbai (19.076, 72.877) to Pune (18.520, 73.856) is roughly 120-130 km
    d = haversine_distance_km(19.076, 72.877, 18.520, 73.856)
    assert 115 < d < 135
