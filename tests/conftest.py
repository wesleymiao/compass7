"""Shared test fixtures - mock storage for API tests."""
import json
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock storage: in-memory dict instead of Azure Blob
_mock_store = {}


def _mock_read_blob(path, default=None):
    return json.loads(json.dumps(_mock_store.get(path, default)))


def _mock_write_blob(path, data):
    _mock_store[path] = json.loads(json.dumps(data))


def _mock_delete_blob(path):
    _mock_store.pop(path, None)


@pytest.fixture(autouse=True)
def mock_storage(monkeypatch):
    """Replace Azure Blob calls with in-memory dict."""
    import storage
    _mock_store.clear()
    monkeypatch.setattr(storage, "_read_blob", _mock_read_blob)
    monkeypatch.setattr(storage, "_write_blob", _mock_write_blob)
    monkeypatch.setattr(storage, "_delete_blob", _mock_delete_blob)
    yield _mock_store


@pytest.fixture
def client(mock_storage):
    """Flask test client."""
    from app import app
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"
    with app.test_client() as c:
        yield c
