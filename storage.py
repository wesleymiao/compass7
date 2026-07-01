"""
Compass7 - Storage layer for Azure Blob Storage (JSON files)
Supports local file storage for development/testing via STORAGE_MODE=local
"""
import json
import os
import uuid
from datetime import datetime, timezone, timedelta

STORAGE_MODE = os.environ.get("STORAGE_MODE", "azure")  # "azure" or "local"
LOCAL_DATA_DIR = os.environ.get("LOCAL_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
CONTAINER_NAME = os.environ.get("AZURE_STORAGE_CONTAINER", "compass7-data")

_blob_service = None


def _get_blob_service():
    global _blob_service
    if _blob_service is None:
        from azure.storage.blob import BlobServiceClient
        _blob_service = BlobServiceClient.from_connection_string(CONNECTION_STRING)
    return _blob_service


def _get_container():
    return _get_blob_service().get_container_client(CONTAINER_NAME)


def _read_blob(path: str, default=None):
    """Read a JSON blob. Returns default if not found."""
    if STORAGE_MODE == "local":
        fpath = os.path.join(LOCAL_DATA_DIR, path)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default
    try:
        client = _get_container().get_blob_client(path)
        data = client.download_blob().readall()
        return json.loads(data)
    except Exception:
        return default


def _write_blob(path: str, data):
    """Write a JSON blob (overwrite)."""
    if STORAGE_MODE == "local":
        fpath = os.path.join(LOCAL_DATA_DIR, path)
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return
    client = _get_container().get_blob_client(path)
    client.upload_blob(json.dumps(data, ensure_ascii=False, indent=2),
                       overwrite=True, content_type="application/json")


def _delete_blob(path: str):
    """Delete a blob if it exists."""
    if STORAGE_MODE == "local":
        fpath = os.path.join(LOCAL_DATA_DIR, path)
        try:
            os.remove(fpath)
        except FileNotFoundError:
            pass
        return
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
    # Build initial schedule from elective slots of existing classes
    initial_schedule = {}
    if year["classes"]:
        ref = year["classes"][0]["schedule"]
        for day, periods in ref.items():
            for period, slot in periods.items():
                courses = slot.get("courses", [])
                if len(courses) > 2:
                    # Elective slot — copy with new IDs
                    if day not in initial_schedule:
                        initial_schedule[day] = {}
                    new_courses = [
                        {"id": gen_id(), "name_cn": c["name_cn"], "name_en": c["name_en"],
                         "teacher": c.get("teacher", ""), "room": c.get("room", "")}
                        for c in courses
                    ]
                    initial_schedule[day][period] = {
                        "block_label": slot.get("block_label"),
                        "courses": new_courses
                    }
    class_id = gen_id()
    class_data = {
        "id": class_id,
        "name": name,
        "schedule": initial_schedule
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


def rename_class(year_id: str, class_id: str, new_name: str):
    year = get_year(year_id)
    if not year:
        return False
    for c in year["classes"]:
        if c["id"] == class_id:
            c["name"] = new_name
            _write_blob(f"years/{year_id}.json", year)
            return True
    return False


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


# ── Course Groups (per year, shared across all classes) ───

def get_course_groups(year_id: str, class_id: str = None):
    """Get course groups for a year. class_id is accepted but ignored (backward compat)."""
    return _read_blob(f"course_groups/{year_id}.json", default=[])


def save_course_groups(year_id: str, class_id: str = None, groups: list = None):
    """Save course groups for a year. class_id is accepted but ignored (backward compat)."""
    if groups is None:
        groups = []
    _write_blob(f"course_groups/{year_id}.json", groups)


# ── Course Library (per year, shared across all classes) ───

def get_course_library(year_id: str):
    return _read_blob(f"course_library/{year_id}.json", default=[])


def save_course_library(year_id: str, library: list):
    _write_blob(f"course_library/{year_id}.json", library)


# ── Clubs (社团介绍) ───────────────────────────────────

def get_clubs():
    """Get all clubs sorted by created_at descending."""
    data = _read_blob("clubs.json", {"clubs": []})
    # Sort by created_at descending (newest first)
    data["clubs"].sort(key=lambda c: c.get("created_at", ""), reverse=True)
    # Ensure image URLs have valid SAS tokens
    for club in data["clubs"]:
        if club.get("qrcode"):
            club["qrcode"] = _ensure_sas_url(club["qrcode"])
        if club.get("poster"):
            club["poster"] = _ensure_sas_url(club["poster"])
        # Legacy field migration
        if club.get("leader_photo"):
            club["leader_photo"] = _ensure_sas_url(club["leader_photo"])
    return data


def _ensure_sas_url(url: str) -> str:
    """Ensure a blob URL has a valid SAS token for access."""
    if STORAGE_MODE == "local":
        return url
    if not url or "blob.core.windows.net" not in url:
        return url
    # If URL already has a SAS token that's not expired, return as-is
    if "?" in url and "sig=" in url:
        # Check if SAS is still valid (simplified check - just regenerate if it looks old)
        # For simplicity, always regenerate SAS for now
        url = url.split("?")[0]

    # Generate new SAS token
    from datetime import timedelta
    from azure.storage.blob import generate_blob_sas, BlobSasPermissions

    try:
        # Parse blob path from URL
        # URL format: https://account.blob.core.windows.net/container/path
        parts = url.replace("https://", "").split("/")
        if len(parts) < 3:
            return url
        account_name = parts[0].split(".")[0]
        container = parts[1]
        blob_path = "/".join(parts[2:])

        account_key = _get_blob_service().credential.account_key
        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container,
            blob_name=blob_path,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(days=7)
        )
        return f"{url}?{sas_token}"
    except Exception:
        return url


def save_clubs(data):
    _write_blob("clubs.json", data)


def create_club(name: str, description: str = "", slogan: str = "",
                poster: str = None, qrcode: str = None, leaders: list = None):
    """Create a new club.

    Args:
        name: 社团名称
        description: 社团简介
        slogan: 社团宣传语
        poster: 社团海报 URL
        qrcode: 招新群二维码 URL
        leaders: 社长列表 [{"name": "xxx", "contact": "xxx"}, ...]
    """
    data = get_clubs()
    club = {
        "id": gen_id(),
        "name": name,
        "description": description,
        "slogan": slogan,
        "poster": poster,
        "qrcode": qrcode,
        "leaders": leaders or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    data["clubs"].append(club)
    save_clubs(data)
    return club


def update_club(club_id: str, name: str = None, description: str = None,
                slogan: str = None, poster: str = None, qrcode: str = None,
                leaders: list = None):
    """Update an existing club."""
    data = get_clubs()
    for club in data["clubs"]:
        if club["id"] == club_id:
            if name is not None:
                club["name"] = name
            if description is not None:
                club["description"] = description
            if slogan is not None:
                club["slogan"] = slogan
            if poster is not None:
                club["poster"] = poster
            if qrcode is not None:
                club["qrcode"] = qrcode
            if leaders is not None:
                club["leaders"] = leaders
            club["updated_at"] = datetime.now(timezone.utc).isoformat()
            save_clubs(data)
            return club
    return None


def delete_club(club_id: str):
    """Delete a club by ID."""
    data = get_clubs()
    data["clubs"] = [c for c in data["clubs"] if c["id"] != club_id]
    save_clubs(data)
    return True


def get_club(club_id: str):
    """Get a single club by ID."""
    data = get_clubs()
    for club in data["clubs"]:
        if club["id"] == club_id:
            return club
    return None


# ── Visit Analytics (访问统计) ─────────────────────────

# Public pages we track. Anything else is bucketed under "other".
TRACKED_PAGES = {"home", "timetable", "clubs"}
_ANALYTICS_DAILY_LIMIT = 120  # keep at most ~4 months of daily buckets


def _empty_analytics():
    return {
        "totals": {
            "views": 0,            # all page views
            "guest_views": 0,      # views by anonymous visitors
            "user_views": 0,       # views by logged-in registered users
        },
        "pages": {},               # page -> view count
        "daily": {},               # "YYYY-MM-DD" -> {views, guest, user}
        "visitors": [],            # unique anonymous visitor ids seen
        "users": [],               # unique registered user ids seen
        "updated_at": None,
    }


def get_analytics():
    """Return the raw analytics aggregate (with sensible defaults)."""
    data = _read_blob("analytics.json", None)
    if not data:
        return _empty_analytics()
    base = _empty_analytics()
    # Merge stored values onto defaults so missing keys never break callers.
    base["totals"].update(data.get("totals", {}))
    base["pages"] = data.get("pages", {})
    base["daily"] = data.get("daily", {})
    base["visitors"] = data.get("visitors", [])
    base["users"] = data.get("users", [])
    base["updated_at"] = data.get("updated_at")
    return base


def record_visit(page: str, visitor_id: str = None, user_id: str = None):
    """Record a single page view.

    Args:
        page: logical page key (home / timetable / clubs / ...)
        visitor_id: anonymous per-browser id (localStorage), used for unique
            visitor counting.
        user_id: registered user id if the visitor is logged in. When present
            the view is counted as a "user" (注册用户) view, otherwise "guest"
            (游客) view.
    """
    page = (page or "other").strip().lower()
    if page not in TRACKED_PAGES:
        page = "other"

    data = get_analytics()
    is_user = bool(user_id)

    # Totals
    data["totals"]["views"] += 1
    if is_user:
        data["totals"]["user_views"] += 1
    else:
        data["totals"]["guest_views"] += 1

    # Per-page
    data["pages"][page] = data["pages"].get(page, 0) + 1

    # Daily bucket (local-agnostic: uses UTC date)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day = data["daily"].get(today, {"views": 0, "guest": 0, "user": 0})
    day["views"] += 1
    if is_user:
        day["user"] += 1
    else:
        day["guest"] += 1
    data["daily"][today] = day

    # Trim daily history to a bounded window
    if len(data["daily"]) > _ANALYTICS_DAILY_LIMIT:
        for old_key in sorted(data["daily"].keys())[:-_ANALYTICS_DAILY_LIMIT]:
            data["daily"].pop(old_key, None)

    # Unique visitors / users (store ids; lists kept small in practice)
    if visitor_id and visitor_id not in data["visitors"]:
        data["visitors"].append(visitor_id)
    if is_user and user_id not in data["users"]:
        data["users"].append(user_id)

    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_blob("analytics.json", data)
    return data


def get_analytics_summary(days: int = 14):
    """Return a dashboard-friendly summary.

    Includes totals, guest/user split, unique counts, a per-page breakdown,
    today's views, and a `days`-length daily trend (oldest -> newest).
    """
    data = get_analytics()
    totals = data["totals"]

    # Daily trend for the last `days` days (fill gaps with zeros)
    trend = []
    today = datetime.now(timezone.utc).date()
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        bucket = data["daily"].get(key, {"views": 0, "guest": 0, "user": 0})
        trend.append({
            "date": key,
            "views": bucket.get("views", 0),
            "guest": bucket.get("guest", 0),
            "user": bucket.get("user", 0),
        })

    today_key = today.strftime("%Y-%m-%d")
    today_bucket = data["daily"].get(today_key, {"views": 0, "guest": 0, "user": 0})

    # Per-page breakdown sorted by views desc
    pages = [{"page": p, "views": v} for p, v in data["pages"].items()]
    pages.sort(key=lambda x: x["views"], reverse=True)

    return {
        "totals": {
            "views": totals.get("views", 0),
            "guest_views": totals.get("guest_views", 0),
            "user_views": totals.get("user_views", 0),
            "unique_visitors": len(data.get("visitors", [])),
            "unique_users": len(data.get("users", [])),
        },
        "today": {
            "views": today_bucket.get("views", 0),
            "guest": today_bucket.get("guest", 0),
            "user": today_bucket.get("user", 0),
        },
        "pages": pages,
        "trend": trend,
        "updated_at": data.get("updated_at"),
    }


# ── Image Upload ──────────────────────────────────────
def upload_image_blob(filename: str, data: bytes, content_type: str = "image/jpeg"):
    """Upload an image to blob storage and return the URL with SAS token for access."""
    from datetime import timedelta
    image_id = gen_id()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    blob_path = f"images/{image_id}.{ext}"

    if STORAGE_MODE == "local":
        fpath = os.path.join(LOCAL_DATA_DIR, blob_path)
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "wb") as f:
            f.write(data)
        return f"/static/uploads/{image_id}.{ext}"  # For local dev

    # Azure blob storage
    from azure.storage.blob import generate_blob_sas, BlobSasPermissions
    client = _get_container().get_blob_client(blob_path)
    client.upload_blob(data, overwrite=True, content_type=content_type)

    # Generate a long-lived SAS token (1 year) for public read access
    account_name = _get_blob_service().account_name
    account_key = _get_blob_service().credential.account_key
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=CONTAINER_NAME,
        blob_name=blob_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(days=365)
    )
    return f"{client.url}?{sas_token}"
