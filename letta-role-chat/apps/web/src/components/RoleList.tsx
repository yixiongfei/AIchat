
import React, { useState } from 'react';
import { Role } from '../types';
import { UserCircle, Plus } from 'lucide-react';

interface RoleListProps {
  roles: Role[];
  selectedRoleId?: string;
  onSelectRole: (role: Role) => void;
  onCreateClick: () => void;
  onEditRole?: (role: Role) => void;
}

export const RoleList: React.FC<RoleListProps> = ({
  roles,
  selectedRoleId,
  onSelectRole,
  onCreateClick,
  onEditRole,
}) => {
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white/70 backdrop-blur flex items-center justify-between
                      dark:border-slate-800 dark:bg-slate-900/70">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200">Agents</h2>

        <button
          onClick={onCreateClick}
          className="p-2 rounded-full transition-colors
                     hover:bg-slate-100 active:scale-[0.98]
                     dark:hover:bg-slate-800"
          title="Create a new agent"
        >
          <Plus size={18} className="text-blue-600 dark:text-blue-400" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1  py-2">
        {roles.map((role) => {
          const active = selectedRoleId === role.id;

          return (
            <div key={role.id} className="w-full flex items-center justify-between">
              <button
                onClick={() => onSelectRole(role)}
                className={[
                  'w-full text-left px-4 py-3 flex items-center gap-3',
                  'transition-colors rounded-xl mx-2',
                  'hover:bg-slate-100 dark:hover:bg-slate-800/60',
                ].join(' ')}
            >
              {/* Icon / Avatar */}
              <div className="shrink-0">
                {role.avatar && !failedAvatars[role.id] ? (
                  <img
                    src={role.avatar}
                    alt={role.name}
                    className="h-8 w-8 rounded-full object-cover"
                    onError={() => setFailedAvatars((s) => ({ ...s, [role.id]: true }))}
                  />
                ) : (
                  <UserCircle size={34} className={['text-slate-400'].join(' ')} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={[
                    'font-medium truncate',
                  ].join(' ')}
                >
                  {role.name}
                </p>
              </div>
              </button>
              <div className="pr-2">
                <button
                  onClick={() => onEditRole?.(role)}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  title="Edit"
                >
                  {/* simple pencil icon using SVG */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                </button>
              </div>
            </div>
          );
        })}

        {roles.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            暂无 Agents，点击右上角 <span className="font-semibold">+</span> 创建一个吧
          </div>
        )}
      </div>
    </div>
  );
};
