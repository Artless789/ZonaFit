import os
import re

FRONTEND_SRC = "C:/Dev/ZonaFit/frontend/src"

files_to_check = [
    "pages/Onboarding.tsx",
    "pages/superadmin/SuperadminPlans.tsx",
    "pages/cash_registers/CashRegisterPage.tsx"
]

for rel_path in files_to_check:
    filepath = os.path.join(FRONTEND_SRC, rel_path)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # We want to remove the className="..." from <Select ...>
    # Since className might span multiple lines or have a lot of text, we can use regex
    # But it's safer to just remove known bad classNames for Select
    
    # Actually, we can just replace:
    # className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
    # with nothing.
    
    # Let's just find <Select... className="..." and remove the className entirely.
    
    # We can do this with regex:
    # <Select([^>]*)className="[^"]*"([^>]*)>
    content = re.sub(r'(<Select[^>]*)className="[^"]*"([^>]*>)', r'\1\2', content)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Removed classNames from Select in {rel_path}")

