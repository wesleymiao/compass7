"""
Compass7 - Flask Backend API
"""
import os
import json
import secrets
from functools import wraps

import bcrypt
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS

import storage

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
CORS(app)


# ── Helpers ────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin login required"}), 401
        return f(*args, **kwargs)
    return decorated


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Login required"}), 401
        return f(*args, **kwargs)
    return decorated


# ── Pages ──────────────────────────────────────────────

@app.route("/")
def index_page():
    return send_from_directory("templates", "index.html")


@app.route("/admin")
def admin_page():
    return send_from_directory("templates", "admin.html")


# ── Auth: Admin ────────────────────────────────────────

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    password = data.get("password", "")
    config = storage.get_admin_config()
    if not config["password_hash"]:
        # First time: set password
        storage.set_admin_password(hash_password(password))
        session["is_admin"] = True
        return jsonify({"message": "Admin password set", "first_time": True})
    if check_password(password, config["password_hash"]):
        session["is_admin"] = True
        return jsonify({"message": "Login successful"})
    return jsonify({"error": "Invalid password"}), 401


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("is_admin", None)
    return jsonify({"message": "Logged out"})


# ── Auth: User ─────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def user_register():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    email = data.get("email", "").strip()
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if storage.find_user(username):
        return jsonify({"error": "Username already exists"}), 409
    user = storage.create_user(username, hash_password(password), email)
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return jsonify({"message": "Registered", "user": {"id": user["id"], "username": user["username"]}}), 201


@app.route("/api/auth/login", methods=["POST"])
def user_login():
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")
    user = storage.find_user(username)
    if not user or not check_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return jsonify({"message": "Login successful", "user": {"id": user["id"], "username": user["username"]}})


@app.route("/api/auth/logout", methods=["POST"])
def user_logout():
    session.pop("user_id", None)
    session.pop("username", None)
    return jsonify({"message": "Logged out"})


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    if session.get("user_id"):
        return jsonify({"user": {"id": session["user_id"], "username": session["username"]}})
    return jsonify({"user": None})


# ── Admin: Academic Years ──────────────────────────────

@app.route("/api/admin/years", methods=["GET"])
@admin_required
def admin_list_years():
    return jsonify(storage.get_years())


@app.route("/api/admin/years", methods=["POST"])
@admin_required
def admin_create_year():
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Year name required"}), 400
    year = storage.create_year(name)
    if not year:
        return jsonify({"error": "Year already exists"}), 409
    return jsonify(year), 201


@app.route("/api/admin/years/<year_id>", methods=["DELETE"])
@admin_required
def admin_delete_year(year_id):
    storage.delete_year(year_id)
    return jsonify({"message": "Deleted"})


# ── Admin: Classes ─────────────────────────────────────

@app.route("/api/admin/years/<year_id>/classes", methods=["GET"])
@admin_required
def admin_list_classes(year_id):
    year = storage.get_year(year_id)
    if not year:
        return jsonify({"error": "Year not found"}), 404
    return jsonify({"classes": year["classes"]})


@app.route("/api/admin/years/<year_id>/classes", methods=["POST"])
@admin_required
def admin_create_class(year_id):
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Class name required"}), 400
    cls = storage.create_class(year_id, name)
    if not cls:
        return jsonify({"error": "Class already exists or year not found"}), 409
    return jsonify(cls), 201


@app.route("/api/admin/years/<year_id>/classes/<class_id>", methods=["DELETE"])
@admin_required
def admin_delete_class(year_id, class_id):
    storage.delete_class(year_id, class_id)
    return jsonify({"message": "Deleted"})


@app.route("/api/admin/years/<year_id>/classes/<class_id>", methods=["PUT"])
@admin_required
def admin_rename_class(year_id, class_id):
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Class name required"}), 400
    if storage.rename_class(year_id, class_id, name):
        return jsonify({"message": "Renamed"})
    return jsonify({"error": "Class not found"}), 404


# ── Admin: Schedule ────────────────────────────────────

@app.route("/api/admin/classes/<year_id>/<class_id>/schedule", methods=["GET"])
@admin_required
def admin_get_schedule(year_id, class_id):
    cls = storage.get_class(year_id, class_id)
    if not cls:
        return jsonify({"error": "Class not found"}), 404
    return jsonify({"schedule": cls["schedule"]})


@app.route("/api/admin/classes/<year_id>/<class_id>/schedule", methods=["PUT"])
@admin_required
def admin_update_schedule(year_id, class_id):
    data = request.get_json()
    schedule = data.get("schedule", {})
    if storage.update_schedule(year_id, class_id, schedule):
        return jsonify({"message": "Schedule updated"})
    return jsonify({"error": "Class not found"}), 404


# ── Admin: Course Groups ──────────────────────────────

@app.route("/api/admin/classes/<year_id>/<class_id>/course-groups", methods=["GET"])
@admin_required
def admin_get_course_groups(year_id, class_id):
    groups = storage.get_course_groups(year_id, class_id)
    return jsonify({"groups": groups})


@app.route("/api/admin/classes/<year_id>/<class_id>/course-groups", methods=["PUT"])
@admin_required
def admin_save_course_groups(year_id, class_id):
    data = request.get_json()
    groups = data.get("groups", [])
    storage.save_course_groups(year_id, class_id, groups)
    return jsonify({"message": "Course groups saved"})


@app.route("/api/admin/classes/<year_id>/<class_id>/slot", methods=["PUT"])
@admin_required
def admin_update_slot(year_id, class_id):
    data = request.get_json()
    day = str(data.get("day"))
    period = str(data.get("period"))
    slot_data = data.get("slot", {})
    if storage.update_slot(year_id, class_id, day, period, slot_data):
        return jsonify({"message": "Slot updated"})
    return jsonify({"error": "Class not found"}), 404


# ── Public: Years & Classes (for students) ─────────────

@app.route("/api/years", methods=["GET"])
def public_list_years():
    return jsonify(storage.get_years())


@app.route("/api/years/<year_id>/classes", methods=["GET"])
def public_list_classes(year_id):
    year = storage.get_year(year_id)
    if not year:
        return jsonify({"error": "Year not found"}), 404
    # Return classes without full schedule detail
    classes = [{"id": c["id"], "name": c["name"]} for c in year["classes"]]
    return jsonify({"classes": classes})


@app.route("/api/classes/<year_id>/<class_id>/schedule", methods=["GET"])
def public_get_schedule(year_id, class_id):
    cls = storage.get_class(year_id, class_id)
    if not cls:
        return jsonify({"error": "Class not found"}), 404
    return jsonify({"class_name": cls["name"], "schedule": cls["schedule"]})


# ── User Selections ────────────────────────────────────

@app.route("/api/selections", methods=["POST"])
@login_required
def save_selections():
    data = request.get_json()
    user_id = session["user_id"]
    storage.save_selections(user_id, {
        "year_id": data.get("year_id"),
        "class_id": data.get("class_id"),
        "selections": data.get("selections", {})
    })
    return jsonify({"message": "Saved"})


@app.route("/api/selections", methods=["GET"])
@login_required
def get_selections():
    user_id = session["user_id"]
    sel = storage.get_selections(user_id)
    if not sel:
        return jsonify({"selections": None})
    return jsonify(sel)


# ── Test Reset (only in testing mode) ─────────────────

if os.environ.get("TESTING_MODE") == "1":
    @app.route("/api/test/reset", methods=["POST"])
    def test_reset():
        """Reset all data - only available in testing mode."""
        import shutil
        data_dir = os.environ.get("LOCAL_DATA_DIR", "data")
        if os.path.exists(data_dir):
            shutil.rmtree(data_dir)
        os.makedirs(data_dir, exist_ok=True)
        session.clear()
        return jsonify({"message": "Reset complete"})


# ── Run ────────────────────────────────────────────────

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug, port=8000)
