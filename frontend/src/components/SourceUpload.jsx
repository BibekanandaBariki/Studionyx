import { useState, useEffect } from 'react';
import { X, Upload, Link as LinkIcon, FileText, Type } from 'lucide-react';
import FileDropZone from './FileDropZone.jsx';
import SourceList from './SourceList.jsx';
import { uploadFile, addSource, fetchSources, removeSource } from '../utils/api.js';

const SourceUpload = ({ onClose, onSourcesUpdated, showToast }) => {
    const [activeTab, setActiveTab] = useState('file');
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form states
    const [driveUrl, setDriveUrl] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [textContent, setTextContent] = useState('');
    const [textName, setTextName] = useState('');

    useEffect(() => {
        loadSources();
    }, []);

    const loadSources = async () => {
        try {
            const data = await fetchSources();
            setSources(data.sources || []);
        } catch (err) {
            console.error('Failed to load sources:', err);
        }
    };

    const handleFileSelect = async (file) => {
        setLoading(true);
        try {
            await uploadFile(file);
            showToast(`File "${file.name}" uploaded successfully`);
            await loadSources();
            onSourcesUpdated?.();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDrive = async (e) => {
        e.preventDefault();
        if (!driveUrl.trim()) return;

        setLoading(true);
        try {
            await addSource({
                type: 'drive',
                url: driveUrl,
                name: 'Google Drive PDF',
            });
            showToast('Google Drive link added successfully');
            setDriveUrl('');
            await loadSources();
            onSourcesUpdated?.();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddYouTube = async (e) => {
        e.preventDefault();
        if (!youtubeUrl.trim()) return;

        setLoading(true);
        try {
            await addSource({
                type: 'youtube',
                url: youtubeUrl,
                name: 'YouTube Video',
            });
            showToast('YouTube link added successfully');
            setYoutubeUrl('');
            await loadSources();
            onSourcesUpdated?.();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddText = async (e) => {
        e.preventDefault();
        if (!textContent.trim()) return;

        setLoading(true);
        try {
            await addSource({
                type: 'text',
                content: textContent,
                name: textName.trim() || 'Pasted Text',
            });
            showToast('Text content added successfully');
            setTextContent('');
            setTextName('');
            await loadSources();
            onSourcesUpdated?.();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveSource = async (id) => {
        try {
            await removeSource(id);
            showToast('Source removed');
            await loadSources();
            onSourcesUpdated?.();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const tabs = [
        { id: 'file', label: 'Upload File', icon: Upload },
        { id: 'drive', label: 'Google Drive', icon: LinkIcon },
        { id: 'youtube', label: 'YouTube', icon: FileText },
        { id: 'text', label: 'Paste Text', icon: Type },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-700/50 p-4">
                    <h2 className="text-lg font-semibold text-coolwhite">Manage Sources</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-coolwhite"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-700/50 px-4">
                    <div className="flex gap-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                                            ? 'border-emerald-400 text-emerald-300'
                                            : 'border-transparent text-slate-400 hover:text-slate-300'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'file' && (
                        <div className="space-y-4">
                            <FileDropZone
                                onFileSelect={handleFileSelect}
                                accept=".pdf,.txt,.md,.docx"
                                maxSize={10}
                            />
                            {loading && (
                                <p className="text-center text-sm text-emerald-400">Uploading...</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'drive' && (
                        <form onSubmit={handleAddDrive} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Google Drive URL
                                </label>
                                <input
                                    type="url"
                                    value={driveUrl}
                                    onChange={(e) => setDriveUrl(e.target.value)}
                                    placeholder="https://drive.google.com/file/d/..."
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-coolwhite placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                    required
                                />
                                <p className="mt-1.5 text-xs text-slate-400">
                                    Paste the shareable link to your Google Drive PDF
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !driveUrl.trim()}
                                className="w-full rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add Google Drive Source'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'youtube' && (
                        <form onSubmit={handleAddYouTube} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                    YouTube URL
                                </label>
                                <input
                                    type="url"
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-coolwhite placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                    required
                                />
                                <p className="mt-1.5 text-xs text-slate-400">
                                    Paste the YouTube video URL (transcript will be extracted)
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !youtubeUrl.trim()}
                                className="w-full rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add YouTube Source'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'text' && (
                        <form onSubmit={handleAddText} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Source Name (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={textName}
                                    onChange={(e) => setTextName(e.target.value)}
                                    placeholder="e.g., Chapter 5 Notes"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-coolwhite placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Text Content
                                </label>
                                <textarea
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    placeholder="Paste your study material text here..."
                                    rows={8}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-coolwhite placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !textContent.trim()}
                                className="w-full rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add Text Source'}
                            </button>
                        </form>
                    )}

                    {/* Source List */}
                    <div className="mt-6">
                        <SourceList sources={sources} onRemove={handleRemoveSource} />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700/50 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-coolwhite transition-colors hover:bg-slate-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SourceUpload;
