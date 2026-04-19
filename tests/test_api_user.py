"""API tests for user-facing endpoints."""
import pytest


def admin_login(client):
    client.post("/api/admin/login", json={"password": "admin123"})


def setup_schedule(client):
    """Create a year, class, and schedule for testing."""
    admin_login(client)
    r = client.post("/api/admin/years", json={"name": "2025"})
    yid = r.get_json()["id"]
    cr = client.post(f"/api/admin/years/{yid}/classes", json={"name": "10.8"})
    cid = cr.get_json()["id"]
    schedule = {
        "1": {
            "1": {"block_label": None, "courses": [
                {"id": "c1", "name_cn": "数学HL", "name_en": "Math HL"},
                {"id": "c2", "name_cn": "数学SL", "name_en": "Math SL"}
            ]},
            "2": {"block_label": "理科1", "courses": [
                {"id": "c3", "name_cn": "物理", "name_en": "Physics"},
                {"id": "c4", "name_cn": "化学", "name_en": "Chemistry"}
            ]}
        }
    }
    client.put(f"/api/admin/classes/{yid}/{cid}/schedule", json={"schedule": schedule})
    client.post("/api/admin/logout")
    return yid, cid


@pytest.mark.api
class TestPublicEndpoints:
    def test_list_years(self, client):
        admin_login(client)
        client.post("/api/admin/years", json={"name": "2025"})
        client.post("/api/admin/logout")
        res = client.get("/api/years")
        assert len(res.get_json()["years"]) == 1

    def test_list_classes(self, client):
        yid, _ = setup_schedule(client)
        res = client.get(f"/api/years/{yid}/classes")
        classes = res.get_json()["classes"]
        assert len(classes) == 1
        assert classes[0]["name"] == "10.8"

    def test_get_schedule(self, client):
        yid, cid = setup_schedule(client)
        res = client.get(f"/api/classes/{yid}/{cid}/schedule")
        data = res.get_json()
        assert data["class_name"] == "10.8"
        assert "1" in data["schedule"]


@pytest.mark.api
class TestSelections:
    def test_save_and_load_selections(self, client):
        yid, cid = setup_schedule(client)
        # Register user
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        # Save
        res = client.post("/api/selections", json={
            "year_id": yid, "class_id": cid,
            "selections": {"1_1": "c1", "1_2": "c3"}
        })
        assert res.status_code == 200
        # Load
        res = client.get("/api/selections")
        data = res.get_json()
        assert data["selections"]["1_1"] == "c1"
        assert data["selections"]["1_2"] == "c3"

    def test_selections_require_login(self, client):
        res = client.get("/api/selections")
        assert res.status_code == 401

    def test_selections_overwrite(self, client):
        yid, cid = setup_schedule(client)
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        client.post("/api/selections", json={"year_id": yid, "class_id": cid, "selections": {"1_1": "c1"}})
        client.post("/api/selections", json={"year_id": yid, "class_id": cid, "selections": {"1_1": "c2"}})
        res = client.get("/api/selections")
        assert res.get_json()["selections"]["1_1"] == "c2"
