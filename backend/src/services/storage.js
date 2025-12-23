// In-memory storage for study materials and conversation history
// In production, this would be replaced with a database

class Storage {
  constructor() {
    this.notebooks = new Map();
    this.activeNotebookId = null;
    this._initDefaultNotebook();
  }

  _initDefaultNotebook() {
    const id = 'default';
    const notebook = {
      id,
      name: 'Default Notebook',
      isDefault: true,
      createdAt: new Date().toISOString(),
      sources: [],
      studyMaterial: null,
      conversationHistory: [],
      qaHistory: [],
      suggestedQuestions: [],
    };
    this.notebooks.set(id, notebook);
    this.activeNotebookId = id;
  }

  _getActiveNotebook() {
    return this.notebooks.get(this.activeNotebookId);
  }

  setActiveNotebook(id) {
    if (!this.notebooks.has(id)) throw new Error('Notebook not found');
    this.activeNotebookId = id;
  }

  listNotebooks() {
    return Array.from(this.notebooks.values()).map(n => ({
      id: n.id,
      name: n.name,
      isDefault: !!n.isDefault,
      createdAt: n.createdAt,
      sourceCount: n.sources.length,
    }));
  }

  createNotebook(name = 'Untitled Notebook') {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const notebook = {
      id,
      name,
      isDefault: false,
      createdAt: new Date().toISOString(),
      sources: [],
      studyMaterial: null,
      conversationHistory: [],
      qaHistory: [],
      suggestedQuestions: [],
    };
    this.notebooks.set(id, notebook);
    this.activeNotebookId = id;
    return notebook;
  }

  renameNotebook(id, name) {
    const nb = this.notebooks.get(id);
    if (!nb) throw new Error('Notebook not found');
    if (nb.isDefault) throw new Error('Default Notebook cannot be renamed');
    nb.name = name;
    return nb;
  }

  deleteNotebook(id) {
    const nb = this.notebooks.get(id);
    if (!nb) throw new Error('Notebook not found');
    if (nb.isDefault) throw new Error('Default Notebook cannot be deleted');
    const wasActive = this.activeNotebookId === id;
    this.notebooks.delete(id);
    if (wasActive) {
      this.activeNotebookId = 'default';
    }
    return true;
  }

  setStudyMaterial(material) {
    const nb = this._getActiveNotebook();
    nb.studyMaterial = {
      context: material.context,
      contextParts: material.contextParts,
      sources: material.sources || [],
      stats: material.stats || {},
      ingestedAt: new Date().toISOString(),
    };
  }

  getStudyMaterial() {
    const nb = this._getActiveNotebook();
    return nb.studyMaterial;
  }

  addToHistory(entry) {
    const nb = this._getActiveNotebook();
    nb.conversationHistory.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  getHistory() {
    const nb = this._getActiveNotebook();
    return nb.conversationHistory;
  }

  addQAEntry(entry) {
    const nb = this._getActiveNotebook();
    nb.qaHistory.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  getQAHistory() {
    const nb = this._getActiveNotebook();
    return nb.qaHistory;
  }

  clearHistory() {
    const nb = this._getActiveNotebook();
    nb.conversationHistory = [];
    nb.qaHistory = [];
  }

  addSource(source) {
    const nb = this._getActiveNotebook();
    const newSource = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...source,
      addedAt: new Date().toISOString(),
    };
    nb.sources.push(newSource);
    return newSource;
  }

  removeSource(id) {
    const nb = this._getActiveNotebook();
    const index = nb.sources.findIndex(s => s.id === id);
    if (index !== -1) {
      nb.sources.splice(index, 1);
      return true;
    }
    return false;
  }

  getSources() {
    const nb = this._getActiveNotebook();
    return nb.sources;
  }

  clearSources() {
    const nb = this._getActiveNotebook();
    nb.sources = [];
  }

  clearStudyMaterial() {
    const nb = this._getActiveNotebook();
    nb.studyMaterial = null;
    nb.suggestedQuestions = [];
  }

  isDefaultActive() {
    const nb = this._getActiveNotebook();
    return !!nb.isDefault;
  }

  getSuggestedQuestions() {
    const nb = this._getActiveNotebook();
    return nb.suggestedQuestions || [];
  }

  setSuggestedQuestions(questions) {
    const nb = this._getActiveNotebook();
    nb.suggestedQuestions = questions;
  }

  getStats() {
    const nb = this._getActiveNotebook();
    return {
      activeNotebookId: this.activeNotebookId,
      activeNotebookName: nb.name,
      isDefaultNotebook: !!nb.isDefault,
      materialLoaded: nb.studyMaterial !== null,
      historyLength: nb.conversationHistory.length,
      qaHistoryLength: nb.qaHistory.length,
      cacheSize: nb.studyMaterial ? (nb.studyMaterial.context ? nb.studyMaterial.context.length : (nb.studyMaterial.stats?.totalLength || 0)) : 0,
      sourceCount: nb.sources.length,
      notebookCount: this.notebooks.size,
    };
  }
}

// Singleton instance
const storage = new Storage();

export default storage;
