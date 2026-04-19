"""E2E fixtures for Playwright tests."""
import pytest


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


@pytest.fixture
def page(browser):
    p = browser.new_page()
    yield p
    p.close()


@pytest.fixture
def mobile_page(browser):
    p = browser.new_page(viewport={"width": 375, "height": 667})
    yield p
    p.close()


@pytest.fixture
def tablet_page(browser):
    p = browser.new_page(viewport={"width": 768, "height": 1024})
    yield p
    p.close()
