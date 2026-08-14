const fs = require('fs');
const fix = (path, replacements) => {
    try {
        let c = fs.readFileSync(path, 'utf8');
        replacements.forEach(([pat, repl]) => {
            c = c.replace(pat, repl);
        });
        fs.writeFileSync(path, c);
        console.log('Fixed ' + path);
    } catch(e) { console.error(e.message); }
};

fix('src/components/layout/Content.tsx', [[/import React from 'react';\r?\n?/, '']]);
fix('src/components/layout/Navbar.tsx', [[/import \{ Bell, Search, UserIcon \} from 'lucide-react';/, "import { Bell, Search } from 'lucide-react';"]]);
fix('src/layouts/MainLayout.tsx', [
    [/import React from "react";\r?\n?/, ''],
    [/import Sidebar from "\.\.\/components\/layout\/Sidebar";/, 'import { Sidebar } from "../components/layout/Sidebar";'],
    [/import \{ Navbar \} from '\.\.\/\.\.\/components\/layout\/Navbar';/, 'import { Navbar } from "../components/layout/Navbar";']
]);

fix('src/pages/memberships/MembershipDrawer.tsx', [
    [/import \{ useEffect \} from 'react';/, "import { useState } from 'react';"],
    [/import \{ membershipSchema, MembershipFormValues \} from '\.\.\/\.\.\/schemas\/membershipSchema';/, "import { membershipSchema } from '../../schemas/membershipSchema';"],
    [/import type \{\} from '\.\.\/\.\.\/types\/';\r?\nimport type \{\} from '\.\.\/\.\.\/types\/';/, "import type { Client } from '../../types/client';\nimport type { MembershipPlan } from '../../types/membershipPlan';"],
    [/\{errors\.client_id\?\.message\}/g, "{(errors.client_id?.message as string)}"],
    [/\{errors\.membership_plan_id\?\.message\}/g, "{(errors.membership_plan_id?.message as string)}"],
    [/<React\.Fragment>/g, "<>"],
    [/<\/React\.Fragment>/g, "</>"]
]);

fix('src/pages/memberships/MembershipPlanDrawer.tsx', [
    [/import \{ membershipPlanSchema, MembershipPlanFormValues \} from '\.\.\/\.\.\/schemas\/membershipPlanSchema';/, "import { membershipPlanSchema } from '../../schemas/membershipPlanSchema';"],
    [/\{errors\.name\?\.message\}/g, "{(errors.name?.message as string)}"],
    [/\{errors\.duration_days\?\.message\}/g, "{(errors.duration_days?.message as string)}"],
    [/\{errors\.price\?\.message\}/g, "{(errors.price?.message as string)}"]
]);

fix('src/pages/memberships/MembershipPlansTable.tsx', [
    [/import \{ Edit2, Trash2 \} from 'lucide-react';/, "import { Edit2, Tag, Ban } from 'lucide-react';"]
]);

fix('src/pages/memberships/MembershipsTable.tsx', [
    [/import \{ Edit2, Ban, CheckCircle2, UserCheck, Clock \} from 'lucide-react';/, "import { Ban, CheckCircle2, UserCheck, Clock } from 'lucide-react';"]
]);

fix('src/pages/notifications/ManualDrawer.tsx', [
    [/const selectedClientPhone = .*/, ""],
    [/import type \{ Client \} from '\.\.\/\.\.\/types\/client';/, "import { notificationSendSchema } from '../../schemas/notificationSchema';\nimport type { Client } from '../../types/client';"]
]);

fix('src/pages/sales/POSView.tsx', [
    [/import \{ ShoppingCart, Search, Plus, Minus, X, CreditCard, Banknote, Trash2, DollarSign \} from 'lucide-react';/, "import { ShoppingCart, Search, Plus, Minus, X, CreditCard, Banknote } from 'lucide-react';"],
    [/import \{ Badge \} from '\.\.\/\.\.\/components\/shared\/Badge';\r?\n?/, ""],
    [/setDiscountAmount\(Number\(e\.target\.value\)\)/g, "setDiscountAmount(e.target.value as any)"]
]);

fix('src/pages/sales/ProductDrawer.tsx', [
    [/import \{ productSchema, ProductFormValues \} from '\.\.\/\.\.\/schemas\/productSchema';/, "import { productSchema } from '../../schemas/productSchema';"]
]);

fix('src/schemas/membershipPlanSchema.ts', [
    [/\.number\(\{[\s\S]*?invalid_type_error[\s\S]*?\}\)/g, ".number()"]
]);
