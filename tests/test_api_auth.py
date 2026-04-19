"""API tests for authentication endpoints."""
import pytest


@pytest.mark.api
class TestAdminAuth:
    def test_admin_first_login_sets_password(self, client):
        res = client.post("/api/admin/login", json={"password": "admin123"})
        assert res.status_code == 200
        data = res.get_json()
        assert data["first_time"] is True

    def test_admin_login_correct_password(self, client):
        client.post("/api/admin/login", json={"password": "admin123"})
        res = client.post("/api/admin/login", json={"password": "admin123"})
        assert res.status_code == 200

    def test_admin_login_wrong_password(self, client):
        client.post("/api/admin/login", json={"password": "admin123"})
        res = client.post("/api/admin/login", json={"password": "wrong"})
        assert res.status_code == 401

    def test_admin_logout(self, client):
        client.post("/api/admin/login", json={"password": "admin123"})
        res = client.post("/api/admin/logout")
        assert res.status_code == 200


@pytest.mark.api
class TestUserAuth:
    def test_register(self, client):
        res = client.post("/api/auth/register", json={
            "username": "student1", "password": "pass123", "email": "s@t.com"
        })
        assert res.status_code == 201
        assert res.get_json()["user"]["username"] == "student1"

    def test_register_duplicate(self, client):
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        res = client.post("/api/auth/register", json={"username": "student1", "password": "pass456"})
        assert res.status_code == 409

    def test_register_short_password(self, client):
        res = client.post("/api/auth/register", json={"username": "s", "password": "12"})
        assert res.status_code == 400

    def test_login(self, client):
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        res = client.post("/api/auth/login", json={"username": "student1", "password": "pass123"})
        assert res.status_code == 200

    def test_login_wrong(self, client):
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        res = client.post("/api/auth/login", json={"username": "student1", "password": "wrong"})
        assert res.status_code == 401

    def test_me_logged_in(self, client):
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        res = client.get("/api/auth/me")
        assert res.get_json()["user"]["username"] == "student1"

    def test_me_not_logged_in(self, client):
        res = client.get("/api/auth/me")
        assert res.get_json()["user"] is None

    def test_logout(self, client):
        client.post("/api/auth/register", json={"username": "student1", "password": "pass123"})
        client.post("/api/auth/logout")
        res = client.get("/api/auth/me")
        assert res.get_json()["user"] is None
