import os
import re

FRONTEND_SRC = "C:/Dev/ZonaFit/frontend/src"

found = []
for root, _, files in os.walk(FRONTEND_SRC):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Find <Select ... className="..." ... >
            matches = re.finditer(r'<Select([^>]*?)className="([^"]*)"([^>]*?)>', content)
            for m in matches:
                cls = m.group(2)
                found.append(f"{filepath}: {cls}")

if found:
    print("Found Selects with className:")
    for f in found:
        print(f)
else:
    print("NO SELECTS WITH CLASSNAME FOUND.")
