// In-memory storage for study materials and conversation history
// In production, this would be replaced with a database

class Storage {
  constructor() {
    this.studyMaterial = null;
    this.conversationHistory = [];
    this.qaHistory = [];
    this.sources = []; // Array of sources (files, links, text)
  }

  setStudyMaterial(material) {
    this.studyMaterial = {
      context: material.context,
      contextParts: material.contextParts,
      sources: material.sources || [],
      stats: material.stats || {},
      ingestedAt: new Date().toISOString(),
    };
  }

  getStudyMaterial() {
    return this.studyMaterial;
  }

  addToHistory(entry) {
    this.conversationHistory.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  getHistory() {
    return this.conversationHistory;
  }

  addQAEntry(entry) {
    this.qaHistory.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  getQAHistory() {
    return this.qaHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
    this.qaHistory = [];
  }

  // Source management methods
  addSource(source) {
    const newSource = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...source,
      addedAt: new Date().toISOString(),
    };
    this.sources.push(newSource);
    return newSource;
  }

  removeSource(id) {
    const index = this.sources.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sources.splice(index, 1);
      return true;
    }
    return false;
  }

  getSources() {
    return this.sources;
  }

  clearSources() {
    this.sources = [];
  }

  getStats() {
    return {
      materialLoaded: this.studyMaterial !== null,
      historyLength: this.conversationHistory.length,
      qaHistoryLength: this.qaHistory.length,
      cacheSize: this.studyMaterial ? (this.studyMaterial.context ? this.studyMaterial.context.length : (this.studyMaterial.stats?.totalLength || 0)) : 0,
      sourceCount: this.sources.length,
    };
  }
}

// Singleton instance
const storage = new Storage();

export default storage;

