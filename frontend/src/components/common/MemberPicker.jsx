import React, { useEffect, useState } from 'react';
import { members as membersService } from '../../services/index.js';
import { SearchInput } from './SearchInput.jsx';
import { UserCheck } from 'lucide-react';
import { formatMobile } from '../../lib/format.js';

export function MemberPicker({ selectedMemberId, onSelect, className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const list = await membersService.searchActive(query);
        if (active) {
          setResults(list);
          if (selectedMemberId && !selectedMember) {
            const match = list.find((m) => m.id === selectedMemberId);
            if (match) setSelectedMember(match);
          }
        }
      } catch (err) {
        console.error('Failed to search members:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(fetchMembers, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selectedMemberId, selectedMember]);

  const handleSelect = (member) => {
    setSelectedMember(member);
    onSelect(member.id, member);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search member by name or mobile..."
      />

      <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
        {loading ? (
          <div className="p-3 text-xs text-center text-slate-400">Searching...</div>
        ) : results.length === 0 ? (
          <div className="p-3 text-xs text-center text-slate-400">No active members found</div>
        ) : (
          results.map((m) => {
            const isSelected = m.id === selectedMemberId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                className={`w-full text-left rtl:text-right px-3 py-2 text-sm flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors ${
                  isSelected ? 'bg-emerald-50 dark:bg-slate-800 font-medium text-emerald-900 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-xs text-slate-500">S/o {m.father_name} · {formatMobile(m.mobile)}</div>
                </div>
                {isSelected && <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
