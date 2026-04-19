"""E2E: Admin login → create year → create class → edit schedule."""
import pytest


@pytest.mark.e2e
class TestAdminFlow:
    def test_admin_login_and_create_year(self, page, base_url):
        # Capture console errors
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: console_messages.append(f"PAGE ERROR: {exc}"))

        page.goto(f"{base_url}/admin")
        page.wait_for_selector("#admin-pwd")

        # Login
        page.fill("#admin-pwd", "admin123")
        page.click("button:has-text('登录')")

        # Wait with shorter timeout and capture state
        try:
            page.wait_for_selector("#admin-panel", state="visible", timeout=10000)
        except Exception:
            # Print diagnostic info
            print("Console messages:", console_messages)
            print("Page URL:", page.url)
            print("Toast visible:", page.locator(".toast").is_visible())
            toast_text = page.locator(".toast").text_content() if page.locator(".toast").is_visible() else "N/A"
            print("Toast text:", toast_text)
            # Try calling API directly from page
            result = page.evaluate("() => fetch('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:'admin123'})}).then(r=>r.text()).catch(e=>e.message)")
            print("Direct fetch result:", result)
            raise

        # Create year
        page.click("text=+")
        page.wait_for_selector("#modal-overlay.active")
        page.fill("#new-year-name", "2025")
        page.click("#modal-save")
        page.wait_for_selector("#modal-overlay:not(.active)")

        # Verify year appears in sidebar
        assert page.locator(".sidebar-item:has-text('2025')").is_visible()

    def test_create_class_and_edit_schedule(self, page, base_url):
        page.goto(f"{base_url}/admin")
        page.fill("#admin-pwd", "admin123")
        page.click("button:has-text('登录')")
        page.wait_for_selector("#admin-panel", state="visible")

        # Create year
        page.click(".sidebar button:has-text('+')")
        page.wait_for_selector("#modal-overlay.active")
        page.fill("#new-year-name", "2025")
        page.click("#modal-save")
        page.wait_for_selector("#modal-overlay:not(.active)")

        # Select year
        page.click(".sidebar-item:has-text('2025')")

        # Create class
        page.click("#add-class-btn")
        page.wait_for_selector("#modal-overlay.active")
        page.fill("#new-class-name", "10.8")
        page.click("#modal-save")
        page.wait_for_selector("#modal-overlay:not(.active)")

        # Select class
        page.click(".sidebar-item:has-text('10.8')")
        page.wait_for_selector("#schedule-editor", state="visible")

        # Add course to Period 1, Monday
        add_buttons = page.locator(".add-course-btn")
        add_buttons.first.click()
        page.wait_for_selector("#modal-overlay.active")
        page.fill("#course-cn", "数学HL")
        page.fill("#course-en", "Math HL")
        page.click("#modal-save")
        page.wait_for_selector("#modal-overlay:not(.active)")

        # Verify course tag appears
        assert page.locator(".course-tag:has-text('数学HL')").is_visible()

        # Save schedule
        page.click("button:has-text('保存')")
        page.wait_for_selector(".toast.success")
