from datetime import date
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_and_get_farmer_profile():
    test_id = str(uuid4())
    payload = {
        "id": test_id,
        "full_name": "Ramesh Patel",
        "preferred_language": "gu",
        "phone": "+919876543210",
    }
    res = client.post("/api/farmer/profile", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == test_id
    assert data["full_name"] == "Ramesh Patel"
    assert data["preferred_language"] == "gu"

    # Get profile
    res_get = client.get(f"/api/farmer/profile/{test_id}")
    assert res_get.status_code == 200
    assert res_get.json()["phone"] == "+919876543210"

    # Update profile
    res_patch = client.patch(f"/api/farmer/profile/{test_id}", json={"full_name": "Ramesh K. Patel", "preferred_language": "hi"})
    assert res_patch.status_code == 200
    assert res_patch.json()["full_name"] == "Ramesh K. Patel"
    assert res_patch.json()["preferred_language"] == "hi"


def test_create_farm_and_grid_key():
    test_id = str(uuid4())
    # Create profile first
    client.post("/api/farmer/profile", json={"id": test_id, "full_name": "Suresh Kumar"})

    # Create farm with lat 20.1427, lon 74.23946 (Lasalgaon area)
    farm_payload = {
        "farmer_id": test_id,
        "name": "North Field",
        "lat": 20.1427,
        "lon": 74.23946,
        "state": "Maharashtra",
        "district": "Nashik",
        "soil_type": "black cotton",
        "irrigation_type": "drip",
        "field_size_acres": 4.5,
    }
    res = client.post("/api/farmer/farms", json=farm_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "North Field"
    assert data["grid_key"] == "20.1,74.2"
    assert data["field_size_acres"] == 4.5

    farm_id = data["id"]

    # List farms
    res_list = client.get(f"/api/farmer/farms?farmer_id={test_id}")
    assert res_list.status_code == 200
    farms = res_list.json()
    assert len(farms) >= 1
    assert any(f["id"] == farm_id for f in farms)


def test_add_and_list_crops():
    test_id = str(uuid4())
    client.post("/api/farmer/profile", json={"id": test_id, "full_name": "Kishan Singh"})
    farm_res = client.post(
        "/api/farmer/farms",
        json={
            "farmer_id": test_id,
            "name": "Main Plot",
            "lat": 30.9,
            "lon": 75.8,
            "state": "Punjab",
            "district": "Ludhiana",
        },
    )
    farm_id = farm_res.json()["id"]

    # Add crop
    crop_payload = {
        "farm_id": farm_id,
        "crop": "Wheat",
        "variety": "HD-2967",
        "sowing_date": "2026-11-05",
        "season": "rabi",
    }
    res = client.post(f"/api/farmer/farms/{farm_id}/crops", json=crop_payload)
    assert res.status_code == 201
    crop_data = res.json()
    assert crop_data["crop"] == "Wheat"
    assert crop_data["variety"] == "HD-2967"
    assert crop_data["status"] == "active"

    # List crops
    res_list = client.get(f"/api/farmer/farms/{farm_id}/crops?status=active")
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1


def test_multi_step_onboard_endpoint():
    # Test unified onboarding with optional soil skipped
    payload = {
        "full_name": "Anil Sharma",
        "preferred_language": "hi",
        "phone": "+919988776655",
        "farm_name": "Riverside Farm",
        "lat": 23.2,
        "lon": 77.4,
        "state": "Madhya Pradesh",
        "district": "Bhopal",
        "crops": [
            {
                "crop": "Soybean",
                "variety": "JS-335",
                "sowing_date": "2026-06-25",
                "season": "kharif",
            }
        ],
    }
    res = client.post("/api/farmer/onboard", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "profile" in data
    assert "farm" in data
    assert "crops" in data
    assert data["profile"]["full_name"] == "Anil Sharma"
    assert data["farm"]["grid_key"] == "23.2,77.4"
    assert len(data["crops"]) == 1
    assert data["crops"][0]["crop"] == "Soybean"


def test_multi_step_onboard_with_soil_health_card():
    # Test onboarding with explicit soil Health Card NPK & pH data
    payload = {
        "full_name": "Manish Patil",
        "preferred_language": "mr",
        "farm_name": "Vineyard Plot A",
        "lat": 20.0,
        "lon": 73.8,
        "state": "Maharashtra",
        "district": "Nashik",
        "soil_type": "clay loam",
        "soil_npk": {"n": 240.0, "p": 18.5, "k": 310.0, "ph": 6.8},
        "irrigation_type": "drip",
        "field_size_acres": 3.0,
        "crops": [
            {
                "crop": "Tomato",
                "variety": "Abhinav",
                "sowing_date": "2026-08-15",
                "season": "kharif",
            }
        ],
    }
    res = client.post("/api/farmer/onboard", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["farm"]["soil_type"] == "clay loam"
    assert data["farm"]["soil_npk"]["ph"] == 6.8
    assert data["crops"][0]["crop"] == "Tomato"
