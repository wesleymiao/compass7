"""API tests for admin CRUD operations."""
import pytest


def admin_login(client):
    client.post("/api/admin/login", json={"password": "admin123"})


@pytest.mark.api
class TestYears:
    def test_create_year(self, client):
        admin_login(client)
        res = client.post("/api/admin/years", json={"name": "2025"})
        assert res.status_code == 201
        assert res.get_json()["name"] == "2025"

    def test_list_years(self, client):
        admin_login(client)
        client.post("/api/admin/years", json={"name": "2025"})
        client.post("/api/admin/years", json={"name": "2026"})
        res = client.get("/api/admin/years")
        assert len(res.get_json()["years"]) == 2

    def test_duplicate_year(self, client):
        admin_login(client)
        client.post("/api/admin/years", json={"name": "2025"})
        res = client.post("/api/admin/years", json={"name": "2025"})
        assert res.status_code == 409

    def test_delete_year(self, client):
        admin_login(client)
        r = client.post("/api/admin/years", json={"name": "2025"})
        yid = r.get_json()["id"]
        client.delete(f"/api/admin/years/{yid}")
        res = client.get("/api/admin/years")
        assert len(res.get_json()["years"]) == 0

    def test_requires_admin(self, client):
        res = client.get("/api/admin/years")
        assert res.status_code == 401


@pytest.mark.api
class TestClasses:
    def test_create_class(self, client):
        admin_login(client)
        r = client.post("/api/admin/years", json={"name": "2025"})
        yid = r.get_json()["id"]
        res = client.post(f"/api/admin/years/{yid}/classes", json={"name": "10.8"})
        assert res.status_code == 201
        assert res.get_json()["name"] == "10.8"

    def test_list_classes(self, client):
        admin_login(client)
        r = client.post("/api/admin/years", json={"name": "2025"})
        yid = r.get_json()["id"]
        client.post(f"/api/admin/years/{yid}/classes", json={"name": "10.8"})
        client.post(f"/api/admin/years/{yid}/classes", json={"name": "10.9"})
        res = client.get(f"/api/admin/years/{yid}/classes")
        assert len(res.get_json()["classes"]) == 2

    def test_delete_class(self, client):
        admin_login(client)
        r = client.post("/api/admin/years", json={"name": "2025"})
        yid = r.get_json()["id"]
        cr = client.post(f"/api/admin/years/{yid}/classes", json={"name": "10.8"})
        cid = cr.get_json()["id"]
        client.delete(f"/api/admin/years/{yid}/classes/{cid}")
        res = client.get(f"/api/admin/years/{yid}/classes")
        assert len(res.get_json()["classes"]) == 0


@pytest.mark.api
class TestSchedule:
    def _setup(self, client):
        admin_login(client)
        r = client.post("/api/admin/years", json={"name": "2025"})
        yid = r.get_json()["id"]
        cr = client.post(f"/api/admin/years/{yid}/classes", json={"name": "10.8"})
        cid = cr.get_json()["id"]
        return yid, cid

    def test_update_schedule(self, client):
        yid, cid = self._setup(client)
        schedule = {
            "1": {
                "1": {
                    "block_label": None,
                    "courses": [
                        {"id": "c1", "name_cn": "数学HL", "name_en": "Math HL"},
                        {"id": "c2", "name_cn": "数学SL", "name_en": "Math SL"}
                    ]
                }
            }
        }
        res = client.put(f"/api/admin/classes/{yid}/{cid}/schedule", json={"schedule": schedule})
        assert res.status_code == 200

    def test_get_schedule(self, client):
        yid, cid = self._setup(client)
        schedule = {"1": {"1": {"block_label": "理科1", "courses": [{"id": "c1", "name_cn": "物理", "name_en": "Physics"}]}}}
        client.put(f"/api/admin/classes/{yid}/{cid}/schedule", json={"schedule": schedule})
        res = client.get(f"/api/admin/classes/{yid}/{cid}/schedule")
        data = res.get_json()
        assert data["schedule"]["1"]["1"]["block_label"] == "理科1"
        assert len(data["schedule"]["1"]["1"]["courses"]) == 1

    def test_update_slot(self, client):
        yid, cid = self._setup(client)
        res = client.put(f"/api/admin/classes/{yid}/{cid}/slot", json={
            "day": 1, "period": 3,
            "slot": {"block_label": "理科2 Block", "courses": [{"id": "c1", "name_cn": "化学", "name_en": "Chemistry"}]}
        })
        assert res.status_code == 200
