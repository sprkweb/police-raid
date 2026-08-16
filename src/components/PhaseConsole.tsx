import React from 'react';

export interface ConsoleView {
  title: string;
  big?: string;
  verdict?: string;
  verdictTone?: 'police' | 'moles' | 'approve' | 'reject' | 'clean' | 'blown';
  note?: string;
  stat?: string;
  result?: boolean;
}

export interface ActionView {
  key: string;
  label: string;
  tone?: 'blue' | 'green' | 'red';
  disabled?: boolean;
  onClick: () => void;
}

export const PhaseConsole: React.FC<{ view: ConsoleView }> = ({ view }) => (
  <div className={view.result ? 'pr-console-result' : undefined}>
    <div className="pr-console-title">{view.title}</div>
    {view.big && <div className="pr-console-big">{view.big}</div>}
    {view.verdict && (
      <div className={`pr-verdict${view.verdictTone ? ` pr-verdict-${view.verdictTone}` : ''}`}>
        {view.verdict}
      </div>
    )}
    {view.note && <div className="pr-console-note">{view.note}</div>}
    {view.stat && <div className="pr-console-stat">{view.stat}</div>}
  </div>
);

export const ActionButtons: React.FC<{ actions: ActionView[] }> = ({ actions }) => {
  if (actions.length === 0) return null;
  return (
    <div className="pr-actions">
      {actions.map(action => (
        <button
          key={action.key}
          type="button"
          className={`pr-btn${action.tone ? ` pr-${action.tone}` : ''}`}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};
