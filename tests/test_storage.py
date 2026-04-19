"""Unit tests for storage layer."""
import pytest
import storage


@pytest.mark.unit
class TestStorage:
    def test_gen_id(self):
        id1 = storage.gen_id()
        id2 = storage.gen_id()
        assert len(id1) == 8
        assert id1 != id2

    def test_admin_config(self):
        cfg = storage.get_admin_config()
        assert cfg["password_hash"] == ""
        storage.set_admin_password("hashed123")
        cfg = storage.get_admin_config()
        assert cfg["password_hash"] == "hashed123"

    def test_create_and_find_user(self):
        user = storage.create_user("alice", "hash", "a@b.com")
        assert user["username"] == "alice"
        found = storage.find_user("alice")
        assert found is not None
        assert found["email"] == "a@b.com"
        assert storage.find_user("bob") is None

    def test_create_year(self):
        year = storage.create_year("2025")
        assert year["name"] == "2025"
        # Duplicate
        assert storage.create_year("2025") is None

    def test_delete_year(self):
        year = storage.create_year("2025")
        storage.delete_year(year["id"])
        index = storage.get_years()
        assert len(index["years"]) == 0

    def test_create_class(self):
        year = storage.create_year("2025")
        cls = storage.create_class(year["id"], "10.8")
        assert cls["name"] == "10.8"
        # Duplicate
        assert storage.create_class(year["id"], "10.8") is None

    def test_update_schedule(self):
        year = storage.create_year("2025")
        cls = storage.create_class(year["id"], "10.8")
        schedule = {"1": {"1": {"block_label": "理科1", "courses": []}}}
        assert storage.update_schedule(year["id"], cls["id"], schedule)
        got = storage.get_class(year["id"], cls["id"])
        assert got["schedule"]["1"]["1"]["block_label"] == "理科1"

    def test_selections(self):
        assert storage.get_selections("user1") is None
        storage.save_selections("user1", {"selections": {"1_1": "c1"}})
        got = storage.get_selections("user1")
        assert got["selections"]["1_1"] == "c1"
