
import React from 'react';
import { Role } from '../types';
import { UserCircle, Plus } from 'lucide-react';

interface RoleListProps {
  roles: Role[];
  selectedRoleId?: string;
  onSelectRole: (role: Role) => void;
  onCreateClick: () => void;
}

export const RoleList: React.FC<RoleListProps> = ({
  roles,
  selectedRoleId,
  onSelectRole,
  onCreateClick,
}) => {
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
            <button
              key={role.id}
              onClick={() => onSelectRole(role)}
              className={[
                'w-full text-left px-4 py-3 flex items-center gap-3',
                'transition-colors rounded-xl mx-2',
                'hover:bg-slate-100 dark:hover:bg-slate-800/60',
              ].join(' ')}
            >
              {/* Icon / Avatar */}
              <div className="shrink-0">
                <UserCircle
                  size={34}
                  className={[
                    'text-slate-400',
                  ].join(' ')}
                />
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

                <p className="text-xs truncate text-slate-500 dark:text-slate-400">
                  {role.persona}
                </p>
              </div>
            </button>
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
