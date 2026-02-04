
import React, { useState } from 'react';
import { Role } from '../types';
import { UserCircle, Plus, Loader2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useBackgroundLoading } from '../hooks/useBackgroundLoading';

interface RoleListProps {
  roles: Role[];
  selectedRoleId?: string;
  onSelectRole: (role: Role) => void;
  onCreateClick: () => void;
  onEditRole?: (role: Role) => void;
  isCollapsed?: boolean;
}

export const RoleList: React.FC<RoleListProps> = ({
  roles,
  selectedRoleId,
  onSelectRole,
  onCreateClick,
  onEditRole,
  isCollapsed = false,
}) => {
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  
  // ✅ 获取所有正在 loading 的 agent，用于在列表中显示思考指示器
  const { allLoadingAgentIds } = useBackgroundLoading(selectedRoleId);
  const loadingSet = new Set(allLoadingAgentIds);
  
  return (
    <div className="flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100">
      {/* Header */}
      <div className={`p-2 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 ${isCollapsed ? 'flex justify-center' : 'flex items-center justify-between'}`}>
        {isCollapsed ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isExpanded ? "折叠 Agents" : "展开 Agents"}
          >
            <Users size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 flex-1 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-md px-2 py-1 transition-colors"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">Agents</h2>
              {roles.length > 0 && (
                <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {roles.length}
                </span>
              )}
            </button>
            <button
              onClick={onCreateClick}
              className="p-2 rounded-full transition-colors
                         hover:bg-slate-100 active:scale-[0.98]
                         dark:hover:bg-slate-800"
              title="创建 Agent"
            >
              <Plus size={18} className="text-blue-600 dark:text-blue-400" />
            </button>
          </>
        )}
      </div>

      {/* List */}
      {isExpanded && (
        <div className="py-2 overflow-y-auto max-h-[50vh]">
        {roles.map((role) => {
          const active = selectedRoleId === role.id;
          const isThinking = loadingSet.has(role.id);

          return (
            <div key={role.id} className="group w-full flex items-center justify-between">
              <button
                onClick={() => onSelectRole(role)}
                className={[
                  isCollapsed ? 'w-full py-2 flex justify-center' : 'w-full text-left px-4 py-3 flex items-center gap-3',
                  'transition-colors rounded-xl mx-2',
                  'hover:bg-slate-100 dark:hover:bg-slate-800/60',
                  active && 'bg-slate-200 dark:bg-slate-800',
                ].join(' ')}
                title={isCollapsed ? role.name : undefined}
              >
                {/* Icon / Avatar */}
                <div className="shrink-0 relative">
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
                  {/* ✅ 后台 loading 指示器 - 显示在头像右下角 */}
                  {isThinking && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                      <Loader2 size={10} className="animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* Text - 只在非折叠模式显示 */}
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p
                      className={[
                        'font-medium truncate',
                      ].join(' ')}
                    >
                      {role.name}
                      {/* ✅ 思考中文字提示 */}
                      {isThinking && (
                        <span className="ml-2 text-xs font-normal text-blue-500 dark:text-blue-400">
                          思考中...
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </button>
              {/* 编辑按钮 - 仅悬停时显示 */}
              {!isCollapsed && (
                <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEditRole?.(role)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    title="Edit"
                  >
                    {/* simple pencil icon using SVG */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {roles.length === 0 && !isCollapsed && (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            暂无 Agents，点击右上角 <span className="font-semibold">+</span> 创建一个吧
          </div>
        )}
      </div>
      )}
    </div>
  );
};
