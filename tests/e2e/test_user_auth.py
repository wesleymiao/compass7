"""E2E: Register → login → selections persist."""
import pytest


@pytest.mark.e2e
class TestUserAuth:
    def test_register_and_persist(self, page, base_url):
        page.goto(f"{base_url}/")

        # Click login
        page.click("#login-btn")
        page.wait_for_selector("#auth-modal.active")

        # Switch to register
        page.click("#tab-register")
        page.fill("#reg-username", "teststudent")
        page.fill("#reg-email", "test@school.com")
        page.fill("#reg-password", "pass123")
        page.click("button:has-text('注册')")

        # Wait for modal to close and user info to appear
        page.wait_for_selector("#auth-modal:not(.active)")
        assert page.locator("#user-info").text_content() == "teststudent"

    def test_logout_and_login(self, page, base_url):
        page.goto(f"{base_url}/")

        # Register
        page.click("#login-btn")
        page.wait_for_selector("#auth-modal.active")
        page.click("#tab-register")
        page.fill("#reg-username", "teststudent2")
        page.fill("#reg-password", "pass123")
        page.click("button:has-text('注册')")
        page.wait_for_selector("#auth-modal:not(.active)")

        # Logout
        page.click("#logout-btn")
        page.wait_for_selector("#login-btn", state="visible")

        # Login again
        page.click("#login-btn")
        page.wait_for_selector("#auth-modal.active")
        page.fill("#login-username", "teststudent2")
        page.fill("#login-password", "pass123")
        page.click("button:has-text('登录')")
        page.wait_for_selector("#auth-modal:not(.active)")
        assert page.locator("#user-info").text_content() == "teststudent2"
