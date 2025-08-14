<!-- Chrome Management Tool - Electron Desktop Application -->

# Chrome Management Tool

A desktop application built with Node.js and Electron for managing Chrome browser instances, profiles, proxies, and extensions.

## Features
- Create and manage Chrome profiles with table view
- Configure and assign proxies to profiles  
- Auto-install and auto-pin Chrome extensions
- Visual extension toolbar with floating interface
- Desktop interface with modern table layout
- Profile management with STT, Name, Card, Proxy, Date, Status columns
- Auto-extension management system

## Tech Stack
- Node.js
- Electron
- Puppeteer for Chrome automation
- Chrome DevTools Protocol
- HTML/CSS/JavaScript for UI
- Modern table-based interface design

## Project Status
- [x] Project requirements clarified
- [x] Project scaffolded
- [x] Dependencies installed
- [x] Core features implemented
- [x] Modern table interface for profiles
- [x] Responsive design improvements
- [x] Auto-install extensions system
- [x] Auto-pin extensions with visual toolbar
- [x] Extension management completed
- [x] Testing completed
- [x] Documentation updated

## File Structure
```
QLCHROME/
├── .github/
│   └── copilot-instructions.md
├── assets/
├── data/
│   ├── extensions.json
│   ├── profiles.json
│   ├── proxies.json
│   └── profiles/ (Chrome profile folders)
├── src/
│   ├── main.js (Main Electron process)
│   ├── preload.js (Preload script)
│   └── renderer/ (UI files)
├── enhanced-auto-pin-script.js (Extension toolbar script)
├── package.json
└── README.md
```
