import React, { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, X, User as UserIcon } from 'lucide-react';
import { UserAccountSummary } from '../types';

interface SearchableUserSelectProps {
  candidates: UserAccountSummary[];
  value: string; // selected profile id, '' = none
  onChange: (profileId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Live-filtering "type to search" replacement for a plain <select> — used
// everywhere the app needs to pick one person out of a list to promote
// (Section 2's explicit ask, extended here to every level of the
// promotion hierarchy for consistency: Super Admin -> Admin -> Dean ->
// Adviser -> Officer all use this same component).
export const SearchableUserSelect: React.FC<SearchableUserSelectProps> = ({
  candidates, value, onChange, placeholder = 'Search by name or email...', disabled
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = candidates.find(c => c.id === value) || null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = query.trim()
    ? candidates.filter(c => {
        const q = query.toLowerCase();
        return c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
      })
    : candidates;

  const handleSelect = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
  };

  return (
    <div className="relative" ref={containerRef}>
      {selected ? (
        <div className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-slate-50">
          <span className="flex items-center gap-1.5 min-w-0">
            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-semibold text-slate-800">{selected.full_name}</span>
            <span className="truncate text-slate-400 text-xs">({selected.email})</span>
          </span>
          {!disabled && (
            <button type="button" onClick={handleClear} className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E] disabled:opacity-50"
          />
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-slate-400">No matching accounts.</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 transition cursor-pointer flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block font-bold text-slate-900 truncate">{c.full_name}</span>
                  <span className="block text-slate-400 truncate">{c.email}</span>
                </span>
                {c.department && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">{c.department}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableUserSelect;
