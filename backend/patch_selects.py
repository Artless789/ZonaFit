import os
import re
import glob

FRONTEND_SRC = "C:/Dev/ZonaFit/frontend/src"

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    modified = False

    # 1. Replace Tremor Select imports
    if "from '@tremor/react'" in content and ("Select," in content or "Select " in content or "SelectItem" in content):
        # We need to replace the Tremor Select with our shared Select.
        # It's tricky to parse all imports, let's just add the import if missing and remove Select from Tremor.
        
        # Add import if missing
        if "components/shared/Select" not in content:
            # count directories up
            depth = filepath.replace("\\", "/").count("/") - FRONTEND_SRC.count("/")
            prefix = "../" * (depth - 1) if depth > 1 else "./"
            import_statement = f"import {{ Select, SelectItem }} from '{prefix}components/shared/Select';\n"
            
            # Insert after other imports
            first_import = content.find("import ")
            if first_import != -1:
                content = content[:first_import] + import_statement + content[first_import:]
                modified = True
                
        # Remove Select and SelectItem from Tremor imports
        content = re.sub(r'(\s*)Select,(\s*)', r'\1', content)
        content = re.sub(r'(\s*)SelectItem,(\s*)', r'\1', content)
        content = re.sub(r'(\s*)Select(\s+|}|\n)', r'\2', content)
        content = re.sub(r'(\s*)SelectItem(\s+|}|\n)', r'\2', content)
        modified = True

    # 2. Replace native <select> with <Select>
    if "<select" in content:
        # Check if we already have the import
        if "components/shared/Select" not in content:
            depth = filepath.replace("\\", "/").count("/") - FRONTEND_SRC.count("/")
            prefix = "../" * (depth - 1) if depth > 1 else "./"
            import_statement = f"import {{ Select }} from '{prefix}components/shared/Select';\n"
            first_import = content.find("import ")
            if first_import != -1:
                content = content[:first_import] + import_statement + content[first_import:]
                
        # Replace <select> and </select>
        # We need to be careful with className in native select. Our <Select> supports className.
        content = content.replace("<select", "<Select")
        content = content.replace("</select>", "</Select>")
        modified = True

    if modified:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Patched {filepath}")

for root, _, files in os.walk(FRONTEND_SRC):
    for file in files:
        if file.endswith(".tsx") and file != "Select.tsx":
            process_file(os.path.join(root, file))
