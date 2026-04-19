"""
Compass7 - Storage layer for Azure Blob Storage (JSON files)
"""
import json
import os
import uuid
from datetime import datetime, timezone

from azure.storage.blob import BlobServiceClient

CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
CONTAINER_NAME = os.environ.get("AZURE_STORAGE_CONTAINER", "compass7-data")

_blob_service = None


def _get_blob_service():
    global _blob_service
    if _blob_service is None:
        _blob_service = BlobServiceClient.from_connection_string(CONNECTION_STRING)
    return _blob_service


def _get_container():
    return _get_blob_service().get_container_client(CONTAINER_NAME)


def _read_blob(path: str, default=None):
    """Read a JSON blob. Returns default if not found."""
    try:
        client = _get_container().get_blob_client(path)
        data = client.download_blob().readall()
        return json.loads(data)
    except Exception:
        return default


def _write_blob(path: str, data):
    """Write a JSON blob (overwrite)."""
    client = _get_container().get_blob_client(path)
    client.upload_blob(json.dumps(data, ensure_ascii=False, indent=2),
                       overwrite=True, content_type="application/json")


def _delete_blob(path: str):
    """Delete a blob if it exists."""
    try:
        client = _get_container().get_blob_client(path)
        client.delete_blob()
    except Exception:
        pass


def gen_id():
    return str(uuid.uuid4())[:8]


# ── Admin ──────────────────────────────────────────────

def get_admin_config():
    return _read_blob("admin.json", {"password_hash": ""})


def set_admin_password(password_hash: str):
    _write_blob("admin.json", {"password_hash": password_hash})


# ── Users ──────────────────────────────────────────────

def get_users():
    return _read_blob("users.json", {"users": []})


def save_users(data):
    _write_blob("users.json", data)


def find_user(username: str):
    users = get_users()["users"]
    for u in users:
        if u["username"] == username:
            return u
    return None


def create_user(username: str, password_hash: str, email: str = ""):
    data = get_users()
    user = {
        "id": gen_id(),
        "username": username,
        "email": email,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    data["users"].append(user)
    save_users(data)
    return user


# ── Academic Years ─────────────────────────────────────

def get_years():
    """List all academic years (reads index)."""
    return _read_blob("years/index.json", {"years": []})


def save_years_index(data):
    _write_blob("years/index.json", data)


def get_year(year_id: str):
    return _read_blob(f"years/{year_id}.json")


def create_year(name: str):
    index = get_years()
    # Check duplicate
    for y in index["years"]:
        if y["name"] == name:
            return None
    year_id = gen_id()
    year_data = {
        "id": year_id,
        "name": name,
        "classes": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    index["years"].append({"id": year_id, "name": name})
    save_years_index(index)
    _write_blob(f"years/{year_id}.json", year_data)
    return year_data


def delete_year(year_id: str):
    index = get_years()
    index["years"] = [y for y in index["years"] if y["id"] != year_id]
    save_years_index(index)
    _delete_blob(f"years/{year_id}.json")
    # Also delete associated selections
    # (best effort - selections reference class_id so they become orphaned)
    return True


# ── Classes ────────────────────────────────────────────

def create_class(year_id: str, name: str):
    year = get_year(year_id)
    if not year:
        return None
    for c in year["classes"]:
        if c["name"] == name:
            return None
    class_id = gen_id()
    class_data = {
        "id": class_id,
        "name": name,
        "schedule": {}
    }
    year["classes"].append(class_data)
    _write_blob(f"years/{year_id}.json", year)
    return class_data


def delete_class(year_id: str, class_id: str):
    year = get_year(year_id)
    if not year:
        return False
    year["classes"] = [c for c in year["classes"] if c["id"] != class_id]
    _write_blob(f"years/{year_id}.json", year)
    return True


def get_class(year_id: str, class_id: str):
    year = get_year(year_id)
    if not year:
        return None
    for c in year["classes"]:
        if c["id"] == class_id:
            return c
    return None


# ── Schedule ───────────────────────────────────────────

def update_schedule(year_id: str, class_id: str, schedule: dict):
    """
    Replace the entire schedule for a class.
    schedule format:
    {
      "1": {  // day (1=Mon)
        "1": {  // period
          "block_label": "理科1 Block" or null,
          "courses": [
            {"id": "xxx", "name_cn": "数学HL", "name_en": "Math HL"},
            ...
          ]
        }
      }
    }
    """
    year = get_year(year_id)
    if not year:
        return False
    for c in year["classes"]:
        if c["id"] == class_id:
            c["schedule"] = schedule
            _write_blob(f"years/{year_id}.json", year)
            return True
    return False


def update_slot(year_id: str, class_id: str, day: str, period: str, slot_data: dict):
    """Update a single slot in the schedule."""
    year = get_year(year_id)
    if not year:
        return False
    for c in year["classes"]:
        if c["id"] == class_id:
            if day not in c["schedule"]:
                c["schedule"][day] = {}
            c["schedule"][day][period] = slot_data
            _write_blob(f"years/{year_id}.json", year)
            return True
    return False


# ── User Selections ───────────────────────────────────

def get_selections(user_id: str):
    return _read_blob(f"selections/{user_id}.json")


def save_selections(user_id: str, data: dict):
    _write_blob(f"selections/{user_id}.json", data)
