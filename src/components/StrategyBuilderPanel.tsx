import { useState } from 'react';
import { Settings2, Plus, Trash2, Save, FileJson, PlayCircle, Bot } from 'lucide-react';
import { cn } from '../lib/utils';

interface Rule {
  id: string;
  indicator: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  size: string;
}

interface StrategyGroup {
  id: string;
  logic: 'AND' | 'OR';
  rules: Rule[];
  action: Action;
}

export function StrategyBuilderPanel() {
  const [viewMode, setViewMode] = useState<'VISUAL' | 'JSON'>('VISUAL');
  
  const [groups, setGroups] = useState<StrategyGroup[]>([
    {
      id: 'g1',
      logic: 'AND',
      rules: [
        { id: 'r1', indicator: 'RSI (14)', operator: '<', value: '30' },
        { id: 'r2', indicator: 'Price', operator: '>', value: 'EMA (200)' }
      ],
      action: { type: 'BUY', size: '100%'}
    }
  ]);

  const addGroup = () => {
    setGroups([...groups, {
      id: Date.now().toString(),
      logic: 'AND',
      rules: [{ id: Date.now().toString() + '_r', indicator: 'RSI (14)', operator: '<', value: '30' }],
      action: { type: 'BUY', size: '100%' }
    }]);
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const addRule = (groupId: string) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: [...g.rules, { id: Date.now().toString(), indicator: 'MACD', operator: 'crosses up', value: 'Signal' }]
        };
      }
      return g;
    }));
  };

  const removeRule = (groupId: string, ruleId: string) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: g.rules.filter(r => r.id !== ruleId)
        };
      }
      return g;
    }));
  };

  const updateRule = (groupId: string, ruleId: string, field: keyof Rule, value: string) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: g.rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r)
        };
      }
      return g;
    }));
  };

  const updateGroup = (groupId: string, field: 'logic' | 'action', value: any) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return { ...g, [field]: value };
      }
      return g;
    }));
  };

  const jsonConfig = JSON.stringify(groups, null, 2);

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/50 shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-indigo-400">
          <Bot className="w-4 h-4" />
          Strategy Builder
        </h3>
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
          <button 
            onClick={() => setViewMode('VISUAL')}
            className={cn("px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-md transition-colors", viewMode === 'VISUAL' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300')}
          >
            Visual
          </button>
          <button 
            onClick={() => setViewMode('JSON')}
            className={cn("px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-md transition-colors", viewMode === 'JSON' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300')}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {viewMode === 'VISUAL' ? (
          <>
            {groups.map((group, index) => (
              <div key={group.id} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 relative group/block">
                <button 
                  onClick={() => removeGroup(group.id)}
                  className="absolute top-2 right-2 p-1.5 text-neutral-600 hover:text-red-400 hover:bg-neutral-900 rounded opacity-0 group-hover/block:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase rounded tracking-wider">
                    Condition Block {index + 1}
                  </div>
                </div>

                <div className="space-y-3">
                  {group.rules.map((rule, rIndex) => (
                    <div key={rule.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 group/rule">
                      {rIndex > 0 && (
                        <select 
                          className="w-20 bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-indigo-500/50"
                          value={group.logic}
                          onChange={(e) => updateGroup(group.id, 'logic', e.target.value)}
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      )}
                      {rIndex === 0 && <div className="w-20 px-2 py-1.5 text-xs text-neutral-500 font-bold uppercase tracking-wider text-center">IF</div>}
                      
                      <div className="flex-1 grid grid-cols-3 gap-2">
                         <select 
                           className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-indigo-500/50"
                           value={rule.indicator}
                           onChange={(e) => updateRule(group.id, rule.id, 'indicator', e.target.value)}
                         >
                           <option value="RSI (14)">RSI (14)</option>
                           <option value="MACD">MACD Line</option>
                           <option value="Price">Price</option>
                           <option value="EMA (20)">EMA (20)</option>
                           <option value="EMA (50)">EMA (50)</option>
                           <option value="EMA (200)">EMA (200)</option>
                         </select>
                         
                         <select 
                           className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-indigo-500/50"
                           value={rule.operator}
                           onChange={(e) => updateRule(group.id, rule.id, 'operator', e.target.value)}
                         >
                           <option value="<">&lt;</option>
                           <option value=">">&gt;</option>
                           <option value="=">=</option>
                           <option value="crosses up">Crosses Up</option>
                           <option value="crosses down">Crosses Down</option>
                         </select>

                         <input 
                           className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-indigo-500/50"
                           value={rule.value}
                           onChange={(e) => updateRule(group.id, rule.id, 'value', e.target.value)}
                           placeholder="Value (e.g. 30)"
                         />
                      </div>
                      <button 
                        onClick={() => removeRule(group.id, rule.id)}
                        className="p-1.5 text-neutral-600 hover:text-red-400 opacity-0 group-hover/rule:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={() => addRule(group.id)}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-neutral-500 hover:text-neutral-300 pl-[88px] mt-2 group/add transition-colors"
                  >
                    <Plus className="w-3 h-3 group-hover/add:bg-neutral-800 rounded-full" />
                    Add Rule
                  </button>
                </div>

                <div className="mt-6 pt-4 border-t border-neutral-800/50 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                   <div className="w-20 px-2 py-1.5 text-xs text-emerald-500 font-bold uppercase tracking-wider text-center">THEN</div>
                   <select 
                      className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-emerald-500/50 w-32"
                      value={group.action.type}
                      onChange={(e) => updateGroup(group.id, 'action', { ...group.action, type: e.target.value })}
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                      <option value="CLOSE">CLOSE POS</option>
                    </select>
                    <input 
                      className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-emerald-500/50 w-24"
                      value={group.action.size}
                      onChange={(e) => updateGroup(group.id, 'action', { ...group.action, size: e.target.value })}
                      placeholder="Size %"
                    />
                </div>
              </div>
            ))}

            <button 
               onClick={addGroup}
               className="w-full py-4 border-2 border-dashed border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/30 rounded-xl text-neutral-500 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Strategy Block
            </button>
            <div className="flex gap-2">
              <button className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                <Save className="w-4 h-4" />
                Save Strategy
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col">
            <textarea 
              value={jsonConfig}
              readOnly
              className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono text-xs p-4 rounded-xl resize-none focus:outline-none focus:border-indigo-500/50"
            />
            <div className="flex gap-2 mt-4">
               <button className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all border border-neutral-700">
                <FileJson className="w-4 h-4" />
                Copy JSON
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
