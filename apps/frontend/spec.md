Perfect — let’s design the product shell spec for the modern Burp Suite competitor (Project Arachne).
This spec will define navigation, sidebars, topbars, panels, modals, and overall layout conventions, so the UI is consistent and extensible.

⸻

Product Shell Specification – Project Arachne

1. Core Layout Structure

The application shell is composed of five main regions: 1. Topbar (Global Controls) – persistent, app-level controls. 2. Sidebar Navigation (Primary Modules) – module switching. 3. Sub-Navigation / Context Sidebar – context-specific tools & filters. 4. Main Workspace (Content Area) – core tool panels (proxy, scanner, etc.). 5. Bottom Panel (Console / Logs / Status) – background tasks, live logs, system health.

---

| Topbar (global) |

---

| Sidebar | Context Sidebar | Main Workspace |
| Nav | (filters/tools) | (panels/tabs) |
| | | |

---

| Bottom Console / Logs / Status |

---

⸻

2. Topbar (Global Controls)

The Topbar is persistent across all modules.

Elements:
• App Menu (☰) – File, Edit, Settings, Plugins, Help.
• Workspace Switcher – dropdown to switch between projects/workspaces.
• Search Bar – global search across requests, vulnerabilities, logs.
• Notifications Bell – queued scans, completed tasks, warnings.
• Profile Menu – user settings, license info, team workspace switch (enterprise).
• Quick Actions (+) – start scan, import API schema, new request, etc.

⸻

3. Sidebar Navigation (Primary Modules)

A vertical left sidebar with icons + labels (collapsible).

Default Modules: 1. Dashboard – high-level workspace overview. 2. Proxy – traffic interception. 3. Scanner – vulnerability scanning. 4. Intruder – attack/fuzzing tools. 5. Repeater – manual request crafting. 6. Sequencer – token entropy analysis. 7. Logger – full traffic logs. 8. Collaborator – OOB interactions. 9. Automation – workflows, CI/CD. 10. Reports – compliance & exports. 11. Settings – app + workspace configs.

Sidebar Features:
• Collapse/Expand toggle.
• Pinned Shortcuts (user can pin most-used tools).
• Hover Tooltips with descriptions.
• Module Notifications (badges showing # of findings, requests, etc.).

⸻

4. Sub-Navigation / Context Sidebar

Right-hand panel (or secondary sidebar) changes depending on module.

Examples:
• Proxy: Intercept toggle, filter by MIME type, filter by method, match rules.
• Scanner: Scope selection, scan progress, vulnerability filter.
• Repeater: Request history, environment variables, script snippets.
• Intruder: Payload sets, attack configuration, progress view.
• Logger: Filter/search queries (status code, host, content-type).
• Reports: Template chooser, compliance mappings.

This panel is collapsible.

⸻

5. Main Workspace (Content Area)

The central area is where the active module’s UI lives.

Workspace Behavior:
• Tabbed Layout: Multiple requests, scans, or intruder sessions open as tabs.
• Split View Support: Horizontal/vertical split (like VSCode).
• Drag-and-Drop: Requests from Logger → Repeater, Proxy → Scanner, etc.
• Resizable Panels: Request/Response side-by-side with drag divider.

Example per Module:
• Proxy: Intercepted request list + request/response editor.
• Scanner: List of vulnerabilities + detailed issue description panel.
• Repeater: Raw editor with syntax highlighting, response viewer (JSON, raw, preview).
• Logger: Table view of requests + JSON/raw inspector.

⸻

6. Bottom Console / Logs / Status

A persistent bottom bar with expandable panels.

Elements:
• Task Runner – ongoing scans, intruder attacks.
• System Logs – app logs, warnings, plugin errors.
• Collaboration Log – comments, annotations from team members.
• Performance Monitor – memory/CPU/network usage (useful during fuzzing).

Docking modes:
• Collapsed (status bar only).
• Half-screen expandable console.
• Detachable (new window for advanced users).

⸻

7. Navigation Patterns
   • Global Search (⌘K / Ctrl+K) – jump to requests, findings, tools.
   • Command Palette – quick actions like “Start Scan on Domain”, “Send to Repeater”.
   • Breadcrumbs in workspace (e.g., Proxy > example.com > /api/users).
   • Contextual Right-Click Menus – send to intruder, send to repeater, mark as scope.

⸻

8. Visual Design Principles
   • Modern Dark UI by default (light mode optional).
   • Two-column panels (request/response, finding/details).
   • Consistent iconography (Lucide/Feather icons).
   • Keyboard-first UX – every feature accessible via hotkeys.
   • Animations – subtle transitions (not heavy).

⸻

9. Extensibility in Shell
   • Sidebar Plugins – new tools/modules appear as icons.
   • Context Sidebar Plugins – inject filters, custom configs.
   • Custom Panels – plugins can register new tabs or bottom panels.
   • Theme API – allow custom skins (enterprise branding).

⸻

10. Example Navigation Flow

Scenario: Testing a GraphQL API 1. Proxy captures traffic → user right-clicks → “Send to Repeater.” 2. In Repeater, schema auto-loaded in Context Sidebar. 3. User crafts query, sends → results logged in Repeater tab. 4. Right-click request → “Send to Scanner.” 5. Scanner runs fuzzing → results appear in Workspace + badge updates in Sidebar. 6. Findings → user opens detailed panel → exports as compliance report via Reports module.

⸻

11. Hotkey Conventions
    • ⌘/Ctrl + 1–9 → Switch modules.
    • ⌘/Ctrl + T → New tab.
    • ⌘/Ctrl + E → Send to Repeater.
    • ⌘/Ctrl + I → Send to Intruder.
    • ⌘/Ctrl + / → Global search.
