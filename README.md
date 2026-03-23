# CS2WeaponModder

Desktop editor for Counter-Strike 2 weapon `.vdata` files.

## What It Does

- Open `.vdata`, `.txt`, or `.cfg` weapon data files
- Load the bundled default `weapons.vdata`
- Edit weapon properties with a desktop UI
- Duplicate, delete, and add custom weapons
- Batch-add weapons from model lists
- Export files as `.vdata`

## Project Structure

- [app](app): Electron desktop application
- [panorama](panorama): bundled weapon icons
- [weapons.vdata](weapons.vdata): source data file

## Development

```powershell
cd app
npm install
npm start
```

## Build

Portable Windows executable:

```powershell
cd app
npm run build
```

Windows installer:

```powershell
cd app
npm run build-installer
```
