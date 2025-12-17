import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

const FileDropZone = ({ onFileSelect, accept, maxSize = 10 }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    }, [onFileSelect]);

    const handleFileInput = useCallback((e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            onFileSelect(files[0]);
        }
    }, [onFileSelect]);

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${isDragging
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-slate-600/60 bg-slate-900/40 hover:border-emerald-400/60'
                }`}
        >
            <input
                type="file"
                id="file-upload"
                className="hidden"
                accept={accept}
                onChange={handleFileInput}
            />

            <label
                htmlFor="file-upload"
                className="flex cursor-pointer flex-col items-center gap-3"
            >
                <div className={`rounded-full p-4 ${isDragging ? 'bg-emerald-500/20' : 'bg-slate-800/60'}`}>
                    <Upload className={`h-8 w-8 ${isDragging ? 'text-emerald-300' : 'text-slate-400'}`} />
                </div>

                <div className="space-y-1">
                    <p className="text-sm font-medium text-coolwhite">
                        {isDragging ? 'Drop file here' : 'Drag & drop or choose file to upload'}
                    </p>
                    <p className="text-xs text-slate-400">
                        Supported: PDF, .txt, Markdown, .docx (max {maxSize}MB)
                    </p>
                </div>
            </label>
        </div>
    );
};

export default FileDropZone;
