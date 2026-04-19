"""E2E fixtures for Playwright tests."""
import pytest
import requests


@pytest.fixture(scope="session")
def base_url():
    """Base URL for the running app."""
    import os
    return os.environ.get("BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


@pytest.fixture(autouse=True)
def reset_data(base_url):
    """Reset server state before each test."""
    try:
        requests.post(f"{base_url}/api/test/reset", timeout=5)
    except Exception:
        pass
    yield


@pytest.fixture
def page(browser):
    ctx = browser.new_context()
    p = ctx.new_page()
    yield p
    p.close()
    ctx.close()


@pytest.fixture
def mobile_page(browser):
    ctx = browser.new_context(viewport={"width": 375, "height": 667})
    p = ctx.new_page()
    yield p
    p.close()
    ctx.close()


@pytest.fixture
def tablet_page(browser):
    ctx = browser.new_context(viewport={"width": 768, "height": 1024})
    p = ctx.new_page()
    yield p
    p.close()
    ctx.close()
