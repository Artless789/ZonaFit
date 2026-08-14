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
            
            # Search for native <select (case insensitive)
            # Not <Select (custom component)
            # Regex: <select\b
            matches = re.finditer(r'<select\b', content)
            for m in matches:
                # Get the surrounding 50 characters
                start = max(0, m.start() - 25)
                end = min(len(content), m.end() + 25)
                found.append(f"{filepath}:\n{content[start:end]}\n")

if found:
    print("Found native selects:")
    print("-" * 40)
    for f in found:
        print(f)
else:
    print("NO NATIVE SELECTS FOUND.")
