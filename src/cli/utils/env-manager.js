const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class EnvManager {
  constructor() {
    this.configDir = this.getConfigDir();
    this.configFile = path.join(this.configDir, 'config.json');
    this.ensureConfigDir();
  }

  getConfigDir() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'acture-mcp');
    }
    
    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'acture-mcp');
    }
    
    // Linux and others using XDG
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
      return path.join(xdgConfig, 'acture-mcp');
    }
    
    return path.join(os.homedir(), '.config', 'acture-mcp');
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  getDefaultRepoPath() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'acture-mcp', 'repos');
    }
    
    return path.join(os.homedir(), '.acture-mcp', 'repos');
  }

  saveConfig(config) {
    try {
      // Encrypt the token before saving
      const encryptedConfig = {
        ...config,
        githubToken: this.encryptToken(config.githubToken),
      };
      
      fs.writeFileSync(this.configFile, JSON.stringify(encryptedConfig, null, 2), 'utf8');
      return true;
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  loadConfig() {
    try {
      if (!fs.existsSync(this.configFile)) {
        return null;
      }
      
      const data = fs.readFileSync(this.configFile, 'utf8');
      const config = JSON.parse(data);
      
      // Decrypt the token
      if (config.githubToken) {
        config.githubToken = this.decryptToken(config.githubToken);
      }
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  encryptToken(token) {
    const key = crypto.scryptSync(process.env.USER || 'default', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted,
    };
  }

  decryptToken(encryptedToken) {
    if (typeof encryptedToken === 'string') {
      // Legacy plain text token
      return encryptedToken;
    }
    
    const key = crypto.scryptSync(process.env.USER || 'default', 'salt', 32);
    const iv = Buffer.from(encryptedToken.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedToken.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  configExists() {
    return fs.existsSync(this.configFile);
  }

  deleteConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to delete config: ${error.message}`);
    }
  }
}

module.exports = EnvManager;
