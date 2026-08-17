import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRulesMarkdown } from '../rules/loadRules';
import { renderMarkdown } from '../rules/renderMarkdown';

export const RulesHelp: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const rulesHtml = renderMarkdown(getRulesMarkdown(i18n.language));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="pr-stat pr-help"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
      >
        <span className="pr-stat-k">{t('app.help')}</span>
        <span className="pr-help-ico material-icons" aria-hidden="true">
          menu_book
        </span>
      </button>

      {open && (
        <div
          className="pr-rules-overlay"
          role="presentation"
          onClick={close}
        >
          <div
            id={dialogId}
            className="pr-panel pr-rules-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pr-panel-head pr-rules-head">
              <h2 id={titleId}>{t('app.helpTitle')}</h2>
              <button
                ref={closeRef}
                type="button"
                className="pr-rules-close"
                onClick={close}
              >
                <span className="material-icons" aria-hidden="true">close</span>
                {t('app.helpClose')}
              </button>
            </div>
            <div
              className="pr-rules-body"
              dangerouslySetInnerHTML={{ __html: rulesHtml }}
            />
          </div>
        </div>
      )}
    </>
  );
};
