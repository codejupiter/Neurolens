const { contextBridge } = require('electron');

// Expose a safe API surface to the renderer
contextBridge.exposeInMainWorld('neuroZen', {
  platform: process.platform,
  version: process.env.npm_package_version || '0.1.0',
});
