import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import api from '../api/axios';

interface ICD10Entry {
  code: string;
  description: string;
}

interface Props {
  onSelect: (code: string, description: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ICD10Search({ onSelect, placeholder = 'Search ICD-10 codes...', className = '' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ICD10Entry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/icd10/search?q=${encodeURIComponent(query)}`);
        setResults(res.data || []);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (entry: ICD10Entry) => {
    onSelect(entry.code, entry.description);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-slate-400 text-sm">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center text-slate-400 text-sm">No results for "{query}"</div>
          ) : (
            results.map(entry => (
              <button key={entry.code} onClick={() => handleSelect(entry)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors">
                <span className="font-mono text-xs font-bold text-blue-600 mr-2">{entry.code}</span>
                <span className="text-sm text-slate-700">{entry.description}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
