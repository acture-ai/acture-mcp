/**
 * Simple storage for Notion report metadata
 * Stores report IDs, URLs, titles, dates in a JSON file
 */

const fs = require('fs');
const path = require('path');
const EnvManager = require('./env-manager');

class ReportStorage {
  constructor() {
    const envManager = new EnvManager();
    this.storageFile = path.join(envManager.configDir, 'notion-reports.json');
    this.reports = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = fs.readFileSync(this.storageFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[ReportStorage] Load error:', error.message);
    }
    return { reports: [], lastUpdated: null };
  }

  save() {
    try {
      this.reports.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.storageFile, JSON.stringify(this.reports, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('[ReportStorage] Save error:', error.message);
      return false;
    }
  }

  add(report) {
    const entry = {
      id: report.id,
      url: report.url,
      title: report.title || 'Untitled Report',
      templateId: report.templateId || 'unknown',
      createdAt: report.createdAt || new Date().toISOString(),
      pageId: report.pageId || report.id,
    };

    // Avoid duplicates
    const existingIndex = this.reports.reports.findIndex(r => r.id === entry.id);
    if (existingIndex >= 0) {
      this.reports.reports[existingIndex] = entry;
    } else {
      this.reports.reports.unshift(entry); // Add to beginning (newest first)
    }

    // Keep only last 100 reports to prevent bloat
    if (this.reports.reports.length > 100) {
      this.reports.reports = this.reports.reports.slice(0, 100);
    }

    return this.save();
  }

  getAll(options = {}) {
    let reports = [...this.reports.reports];

    if (options.templateId) {
      reports = reports.filter(r => r.templateId === options.templateId);
    }

    if (options.limit) {
      reports = reports.slice(0, parseInt(options.limit));
    }

    return reports;
  }

  getById(id) {
    return this.reports.reports.find(r => r.id === id || r.pageId === id);
  }

  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.reports.reports.filter(r => 
      r.title.toLowerCase().includes(lowerQuery) ||
      r.templateId.toLowerCase().includes(lowerQuery)
    );
  }

  delete(id) {
    const index = this.reports.reports.findIndex(r => r.id === id);
    if (index >= 0) {
      this.reports.reports.splice(index, 1);
      return this.save();
    }
    return false;
  }
}

module.exports = ReportStorage;
