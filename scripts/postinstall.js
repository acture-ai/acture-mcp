#!/usr/bin/env node

/**
 * Post-install script to ensure bin files are executable on Unix systems
 */

const fs = require('fs');
const path = require('path');

// Only needed on Unix systems
if (process.platform === 'win32') {
  process.exit(0);
}

const binDir = path.join(__dirname, '..', 'bin');
const bins = ['acture-mcp', 'acture-mcp-server'];

try {
  for (const bin of bins) {
    const binPath = path.join(binDir, bin);
    if (fs.existsSync(binPath)) {
      // Make executable (chmod +x equivalent): 0o755 = rwxr-xr-x
      fs.chmodSync(binPath, 0o755);
    }
  }
  console.log('✓ Binaries made executable');
} catch (error) {
  // Non-fatal: npm may have already set permissions correctly
  if (process.env.DEBUG) {
    console.error('Warning: Could not set executable permissions:', error.message);
  }
}
