"""E2E: Responsive tests on mobile, tablet, desktop viewports."""
import pytest


@pytest.mark.e2e
class TestResponsive:
    def test_mobile_viewport(self, mobile_page, base_url):
        mobile_page.goto(f"{base_url}/")
        mobile_page.wait_for_selector("header")
        # Logo should be visible
        assert mobile_page.locator(".logo").is_visible()
        # Steps should be visible
        assert mobile_page.locator(".steps").is_visible()

    def test_tablet_viewport(self, tablet_page, base_url):
        tablet_page.goto(f"{base_url}/")
        tablet_page.wait_for_selector("header")
        assert tablet_page.locator(".logo").is_visible()

    def test_admin_mobile(self, mobile_page, base_url):
        mobile_page.goto(f"{base_url}/admin")
        mobile_page.wait_for_selector("#admin-pwd")
        # Login form should be visible and usable
        mobile_page.fill("#admin-pwd", "admin123")
        assert mobile_page.locator("#admin-pwd").input_value() == "admin123"

    def test_desktop_viewport(self, page, base_url):
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.goto(f"{base_url}/")
        page.wait_for_selector("header")
        assert page.locator(".logo").is_visible()
        assert page.locator(".steps").is_visible()
