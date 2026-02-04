const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

class GitSync {
  constructor(localPath, githubToken) {
    this.localPath = localPath;
    this.githubToken = githubToken;
    this.git = null;
  }

  async syncRepository(repoUrl) {
    const repoExists = fs.existsSync(path.join(this.localPath, '.git'));
    
    if (repoExists) {
      return await this.pullLatest();
    } else {
      return await this.cloneRepository(repoUrl);
    }
  }

  async cloneRepository(repoUrl) {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }

      const authUrl = this.getAuthenticatedUrl(repoUrl);
      
      return new Promise((resolve, reject) => {
        const git = simpleGit();
        
        git.clone(authUrl, this.localPath, ['--progress'], (err) => {
          if (err) {
            reject(new Error(`Clone failed: ${err.message}`));
          } else {
            resolve({
              action: 'clone',
              success: true,
              message: 'Repository cloned successfully',
            });
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async pullLatest() {
    try {
      this.git = simpleGit(this.localPath);
      
      // Check if there are any changes to pull
      const status = await this.git.status();
      
      if (status.behind === 0) {
        return {
          action: 'pull',
          success: true,
          message: 'Repository is up to date',
          stats: {
            ahead: status.ahead,
            behind: status.behind,
            files: status.files.length,
          },
        };
      }
      
      const summary = await this.git.pull();
      
      return {
        action: 'pull',
        success: true,
        message: 'Repository updated successfully',
        stats: {
          filesChanged: summary.summary.changes || 0,
          insertions: summary.summary.insertions || 0,
          deletions: summary.summary.deletions || 0,
          ahead: status.ahead,
          behind: status.behind,
        },
      };
    } catch (error) {
      throw new Error(`Failed to pull latest changes: ${error.message}`);
    }
  }

  async getRepositoryStatus() {
    try {
      if (!fs.existsSync(path.join(this.localPath, '.git'))) {
        return {
          isCloned: false,
          commit: null,
          branch: null,
          ahead: 0,
          behind: 0,
        };
      }

      this.git = simpleGit(this.localPath);
      
      const [status, log] = await Promise.all([
        this.git.status(),
        this.git.log({ maxCount: 1 }),
      ]);

      return {
        isCloned: true,
        commit: log.latest ? log.latest.hash.substring(0, 7) : null,
        branch: status.current || null,
        ahead: status.ahead || 0,
        behind: status.behind || 0,
        modified: status.modified.length,
        staged: status.staged.length,
        isClean: status.isClean(),
      };
    } catch (error) {
      return {
        isCloned: false,
        error: error.message,
      };
    }
  }

  async getFileStats() {
    try {
      if (!fs.existsSync(this.localPath)) {
        return { exists: false };
      }

      const stats = await this.calculateDirectoryStats(this.localPath);
      return {
        exists: true,
        ...stats,
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
      };
    }
  }

  async calculateDirectoryStats(dirPath) {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    let fileCount = 0;
    let dirCount = 0;
    let totalSize = 0;

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      
      if (file.name === '.git') continue;
      
      if (file.isDirectory()) {
        dirCount++;
        const subStats = await this.calculateDirectoryStats(fullPath);
        fileCount += subStats.files;
        dirCount += subStats.directories;
        totalSize += subStats.size;
      } else if (file.isFile()) {
        fileCount++;
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
      }
    }

    return {
      files: fileCount,
      directories: dirCount,
      size: totalSize,
    };
  }

  getAuthenticatedUrl(repoUrl) {
    // Handle different repo URL formats
    let url = repoUrl;
    
    if (!url.startsWith('http')) {
      // Convert owner/repo format to full URL
      url = `https://github.com/${repoUrl}.git`;
    }
    
    // Add token to URL for authentication
    if (this.githubToken) {
      const urlObj = new URL(url);
      urlObj.username = this.githubToken;
      return urlObj.toString();
    }
    
    return url;
  }

  getRepoUrlFromConfig(repository) {
    return `https://github.com/${repository}.git`;
  }
}

module.exports = GitSync;
