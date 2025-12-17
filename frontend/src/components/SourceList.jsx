import { FileText, Link as LinkIcon, Trash2, Youtube } from 'lucide-react';

const SourceList = ({ sources, onRemove }) => {
    if (!sources || sources.length === 0) {
        return (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4 text-center text-sm text-slate-400">
                No sources added yet
            </div>
        );
    }

    const getSourceIcon = (type) => {
        switch (type) {
            case 'file':
            case 'pdf':
            case 'docx':
            case 'text':
            case 'markdown':
                return <FileText className="h-4 w-4 text-emerald-400" />;
            case 'youtube':
                return <Youtube className="h-4 w-4 text-red-400" />;
            case 'drive':
                return <LinkIcon className="h-4 w-4 text-blue-400" />;
            default:
                return <FileText className="h-4 w-4 text-slate-400" />;
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-300">Added Sources ({sources.length})</h4>
            <div className="max-h-60 space-y-2 overflow-y-auto">
                {sources.map((source) => (
                    <div
                        key={source.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 transition-colors hover:bg-slate-900/60"
                    >
                        <div className="flex-shrink-0">{getSourceIcon(source.type)}</div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-coolwhite">
                                {source.name || source.fileName || 'Unnamed source'}
                            </p>
                            <p className="text-xs text-slate-400">
                                {source.type} {source.size ? `• ${formatSize(source.size)}` : ''}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => onRemove(source.id)}
                            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Remove source"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SourceList;
