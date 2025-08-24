# Frontend Agent

## Overview
This is the frontend application for the Arachne project - a web-based HTTP traffic analyzer and debugging tool.

## Tech Stack
- **Framework**: Vue 3 with TypeScript
- **Build Tool**: Vite
- **Styling**: Custom CSS with design system
- **State Management**: Pinia stores
- **Routing**: Vue Router
- **WebSocket**: Native WebSocket client

## Project Structure
```
src/
├── components/          # Reusable Vue components
│   ├── BodyViewer.vue
│   ├── HeadersList.vue
│   ├── RequestPanel.vue
│   ├── ResponsePanel.vue
│   ├── Sidebar.vue
│   ├── ThemeToggle.vue
│   └── TrafficList.vue
├── composables/         # Vue composition functions
│   └── useTheme.ts
├── layouts/            # Layout components
│   └── AppShell.vue
├── services/           # API and WebSocket services
│   ├── http.ts
│   └── ws.ts
├── stores/             # Pinia state stores
│   └── transactions.ts
├── views/              # Page components
│   └── Logger.vue
└── assets/             # Static assets and styles
    ├── design-system.css
    ├── main.css
    └── semantic.css
```

## Key Features
- Real-time HTTP traffic monitoring via WebSocket
- Request/response viewer with syntax highlighting
- Collapsible sidebar navigation
- Dark/light theme toggle
- Traffic filtering and search
- Request/response body analysis

## Development
- Run `npm run dev` to start development server
- Uses Vite for hot module replacement
- TypeScript for type safety
- Component auto-imports configured

## Components
- **TrafficList**: Main list of HTTP transactions
- **RequestPanel/ResponsePanel**: Display request/response details
- **BodyViewer**: Syntax-highlighted body content viewer
- **Sidebar**: Navigation and filtering options
- **ThemeToggle**: Dark/light mode switcher

## Services
- **ws.ts**: WebSocket connection for real-time updates
- **http.ts**: HTTP client for API calls

## State Management
- **transactions.ts**: Manages HTTP transaction data and state