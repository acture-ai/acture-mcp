const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const https = require('https');

class GhManager {
  constructor(githubToken) {
    this.githubToken = githubToken;
    this.platform = os.platform();
    this.arch = os.arch();
    
    // Local installation path (project-local, no admin needed)
    this.localDir = path.join(__dirname, '..', '..', '..', 'vendor', 'gh');
    this.ghPath = this.getLocalGhPath();
  }

  getLocalGhPath() {
    const ext = this.platform === 'win32' ? '.exe' : '';
    return path.join(this.localDir, `gh${ext}`);
  }

  getDownloadUrl() {
    const version = '2.65.0';
    
    // Platform mapping
    let platform;
    if (this.platform === 'win32') platform = 'windows';
    else if (this.platform === 'darwin') platform = 'macOS';
    else platform = 'linux';
    
    // Arch mapping
    let arch = this.arch;
    if (arch === 'x64') arch = 'amd64';
    else if (arch === 'ia32') arch = '386';
    else if (arch === 'arm64') arch = 'arm64';
    else if (arch.startsWith('arm')) arch = 'armv6';
    
    const ext = this.platform === 'win32' ? 'zip' : 'tar.gz';
    return `https://github.com/cli/cli/releases/download/v${version}/gh_${version}_${platform}_${arch}.${ext}`;
  }

  isInstalledLocally() {
    return fs.existsSync(this.ghPath);
  }

  isInstalledGlobally() {
    try {
      execSync('gh --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  isInstalled() {
    return this.isInstalledLocally() || this.isInstalledGlobally();
  }

  getGhPath() {
    if (this.isInstalledLocally()) {
      return this.ghPath;
    }
    return 'gh';
  }

  getVersion() {
    try {
      const gh = this.getGhPath();
      return execSync(`"${gh}" --version`, { encoding: 'utf-8' }).trim().split('\n')[0];
    } catch {
      return null;
    }
  }

  isAuthenticated() {
    const gh = this.getGhPath();
    
    // Check if already authenticated (stored credentials)
    try {
      execSync(`"${gh}" auth status`, { stdio: 'ignore', timeout: 5000 });
      return true;
    } catch {
      // Not stored, check with provided token via GH_TOKEN (5s timeout)
      if (this.githubToken) {
        try {
          const env = { ...process.env, GH_TOKEN: this.githubToken };
          execSync(`"${gh}" api user -q .login`, { 
            env, 
            stdio: 'ignore',
            encoding: 'utf-8',
            timeout: 5000
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      let request;
      
      const cleanup = () => {
        if (request && !request.destroyed) {
          request.destroy();
        }
      };
      
      const handleResponse = (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          request = https.get(response.headers.location, handleResponse).on('error', (err) => {
            cleanup();
            reject(err);
          });
          return;
        }
        
        if (response.statusCode !== 200) {
          cleanup();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            cleanup();
            resolve();
          });
        });
      };
      
      request = https.get(url, handleResponse).on('error', (err) => {
        cleanup();
        reject(err);
      });
    });
  }

  extract(archivePath, destDir) {
    if (archivePath.endsWith('.zip')) {
      // Windows - use PowerShell
      const cmd = `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`;
      execSync(cmd, { stdio: 'ignore', windowsHide: true });
    } else {
      // macOS/Linux - use tar (strip the version directory)
      execSync(`tar -xzf "${archivePath}" -C "${destDir}" --strip-components=1`, { stdio: 'ignore' });
    }
  }

  findBinary(extractDir) {
    const binName = this.platform === 'win32' ? 'gh.exe' : 'gh';
    
    // Check direct bin path first (Windows zip style: bin/gh.exe)
    let binPath = path.join(extractDir, 'bin', binName);
    if (fs.existsSync(binPath)) {
      return binPath;
    }
    
    // Check nested directory (tar.gz extracts to subdirectory)
    const entries = fs.readdirSync(extractDir);
    for (const entry of entries) {
      const fullPath = path.join(extractDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        binPath = path.join(fullPath, 'bin', binName);
        if (fs.existsSync(binPath)) {
          return binPath;
        }
      }
    }
    
    return null;
  }

  async download() {
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }

    const url = this.getDownloadUrl();
    const ext = this.platform === 'win32' ? '.zip' : '.tar.gz';
    const archivePath = path.join(this.localDir, `gh${ext}`);
    const extractDir = path.join(this.localDir, 'temp');

    try {
      await this.downloadFile(url, archivePath);

      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }
      
      this.extract(archivePath, extractDir);

      const ghBinary = this.findBinary(extractDir);

      if (!ghBinary) {
        throw new Error('gh binary not found in archive');
      }

      fs.copyFileSync(ghBinary, this.ghPath);
      fs.chmodSync(this.ghPath, 0o755);

      // Cleanup
      fs.unlinkSync(archivePath);
      fs.rmSync(extractDir, { recursive: true, force: true });

      return true;
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      throw error;
    }
  }

  async authenticate() {
    if (!this.githubToken) {
      throw new Error('GitHub token required');
    }
    const gh = this.getGhPath();
    
    // GH_TOKEN env var is automatically used by gh CLI
    const env = { ...process.env, GH_TOKEN: this.githubToken };
    
    // Verify token works by running a simple command (with 10s timeout)
    try {
      execSync(`"${gh}" api user -q .login`, { 
        env, 
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 10000
      });
    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        throw new Error('GitHub API timeout - check your internet connection');
      }
      throw new Error('Invalid GitHub token');
    }
    
    return true;
  }

  async setup() {
    if (!this.isInstalledLocally() && !this.isInstalledGlobally()) {
      await this.download();
    }
    if (!this.isAuthenticated() && this.githubToken) {
      await this.authenticate();
    }
    return this.isAuthenticated();
  }
}

module.exports = GhManager;
