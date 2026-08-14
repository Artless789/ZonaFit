import re

files = [
    "C:/Dev/ZonaFit/frontend/src/pages/audit/AuditPage.tsx",
    "C:/Dev/ZonaFit/frontend/src/pages/users/UserDrawer.tsx",
    "C:/Dev/ZonaFit/frontend/src/pages/users/UsersPage.tsx"
]

for filepath in files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # The broken syntax is like `< value=` or `<  value=` instead of `<Select value=`
    # and `< value="ALL"` instead of `<SelectItem value="ALL"`
    
    # Replace `< value` with `<Select value` if it has onValueChange, otherwise it's SelectItem?
    # Wait, the regex `(\s*)Select(\s+|}|\n)` replaced `Select ` with ` `
    # So `<Select ` became `< `
    # `<SelectItem ` became `< `
    
    # Actually, Tremor Select elements look like:
    # <Select value={action} onValueChange={setAction}>
    # which became
    # < value={action} onValueChange={setAction}>
    
    # <SelectItem value="ALL">
    # became
    # < value="ALL">
    
    content = re.sub(r'<\s+value=', r'<SelectItem value=', content)
    # But wait, <Select value= also was < value=
    # Let's fix Select manually by looking for onValueChange
    content = content.replace('<SelectItem value={', '<Select value={')
    
    # Also <Select onValueChange=... without value?
    # Let's just fix it properly by checking `<SelectItem ` and changing it to `<Select ` if it contains onValueChange
    
    # Also, we need to fix the import statement!
    # In AuditPage, the import became: import { } from '../../components/shared/Select';
    content = content.replace("import { } from", "import { Select, SelectItem } from")
    
    # Wait, in UserDrawer.tsx the import was:
    # import { Button, TextInput, Select, SelectItem, Text } from '@tremor/react';
    # which became
    # import { Button, TextInput, Text } from '@tremor/react';
    # And we prepended the shared import. Let's make sure it's correct.
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

