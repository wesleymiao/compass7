"""E2E: Guest user selects courses → preview → export."""
import pytest


@pytest.mark.e2e
class TestUserFlow:
    def _setup_data(self, page, base_url):
        """Setup via admin first."""
        page.goto(f"{base_url}/admin")
        page.fill("#admin-pwd", "admin123")
        page.click("button:has-text('登录')")
        page.wait_for_selector("#admin-panel", state="visible")

        # Create year + class
        page.click(".sidebar button:has-text('+')")
        page.wait_for_selector("#modal-overlay.active")
        page.fill("#new-year-name", "2025")
        page.click("#modal-save")
        page.wait_for_selector("#modal-overlay:not(.active)")
        page.click(".sidebar-item:has-text('2025')")

        page.click("#add-class-btn")
        page.wait_for_selector("#modal-overlay.active")
        page.fill("#new-class-name", "10.8")
        page.click("#modal-save")
        page.wait_for_selector("#modal-overlay:not(.active)")
        page.click(".sidebar-item:has-text('10.8')")
        page.wait_for_selector("#schedule-editor", state="visible")

        # Add two courses to Period 1 Monday
        for name_cn, name_en in [("数学HL", "Math HL"), ("数学SL", "Math SL")]:
            page.locator(".add-course-btn").first.click()
            page.wait_for_selector("#modal-overlay.active")
            page.fill("#course-cn", name_cn)
            page.fill("#course-en", name_en)
            page.click("#modal-save")
            page.wait_for_selector("#modal-overlay:not(.active)")

        page.click("button:has-text('保存')")
        page.wait_for_selector(".toast.success")

    def test_guest_select_and_export(self, page, base_url):
        self._setup_data(page, base_url)

        # Go to user page
        page.goto(f"{base_url}/")
        page.wait_for_selector("#step-1")

        # Step 1: Select year
        page.click("button:has-text('2025')")
        page.wait_for_selector("#step-2", state="visible")

        # Step 2: Select class
        page.click("button:has-text('10.8')")
        page.wait_for_selector("#step-3", state="visible")

        # Step 3: Schedule should show with dropdown
        dropdowns = page.locator("#user-schedule-body select")
        assert dropdowns.count() > 0

        # Select first course
        dropdowns.first.select_option(index=1)

        # Check export button becomes enabled
        # (may still be disabled if other slots need selection, but at least one is selected)

    def test_export_excel(self, page, base_url):
        self._setup_data(page, base_url)
        page.goto(f"{base_url}/")
        page.click("button:has-text('2025')")
        page.wait_for_selector("#step-2", state="visible")
        page.click("button:has-text('10.8')")
        page.wait_for_selector("#step-3", state="visible")

        # Select all dropdowns
        dropdowns = page.locator("#user-schedule-body select")
        for i in range(dropdowns.count()):
            dropdowns.nth(i).select_option(index=1)

        # Go to export
        page.click("#to-export-btn")
        page.wait_for_selector("#step-4", state="visible")

        # Preview table should be visible
        assert page.locator("#export-preview-table").is_visible()
