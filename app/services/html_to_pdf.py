from playwright.sync_api import sync_playwright

def html_to_pdf(html: str) -> bytes:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        pdf_bytes = page.pdf(format="A4", margin={"top": "20mm", "bottom": "20mm"})
        browser.close()
        return pdf_bytes
