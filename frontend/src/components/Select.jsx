import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import '../styles/select.css';

/**
 * Accessible replacement for <select>.
 *
 * A native select's dropdown is drawn by the operating system, so the
 * highlighted row stays the system accent colour no matter what CSS says.
 * Rendering the list ourselves is the only way to control it — at the cost of
 * having to implement keyboard handling and ARIA, which is what this does.
 *
 * options: [{ value, label, hint? }]
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  id,
  ariaLabel,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const listId = `${id || autoId}-listbox`;

  const selectedIndex = options.findIndex(o => String(o.value) === String(value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // close on outside click / focus leaving the component
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, close]);

  // keep the highlighted option in view while arrowing through a long list
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const commit = (index) => {
    const opt = options[index];
    if (!opt) return;
    onChange?.(opt.value);
    close();
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => (i - 1 + options.length) % options.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      default:
        // typeahead: jump to the first option starting with the typed letter
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const ch = e.key.toLowerCase();
          const from = activeIndex + 1;
          const order = [...options.slice(from), ...options.slice(0, from)];
          const hit = order.find(o => (o.label || '').toLowerCase().startsWith(ch));
          if (hit) setActiveIndex(options.indexOf(hit));
        }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`ui-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        id={id}
        className={`ui-select-trigger${selected ? '' : ' is-placeholder'}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
      >
        <span className="ui-select-value">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="ui-select-caret" />
      </button>

      {open && (
        <ul className="ui-select-list" id={listId} role="listbox" ref={listRef} tabIndex={-1}>
          {options.length === 0 && <li className="ui-select-empty">No options</li>}
          {options.map((opt, i) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <li
                key={`${opt.value}-${i}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                className={
                  'ui-select-option' +
                  (i === activeIndex ? ' is-active' : '') +
                  (isSelected ? ' is-selected' : '') +
                  (opt.value === '' ? ' is-placeholder-option' : '')
                }
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()} /* keep focus on the trigger */
                onClick={() => commit(i)}
              >
                <span className="ui-select-option-label">
                  {opt.label}
                  {opt.hint && <span className="ui-select-option-hint">{opt.hint}</span>}
                </span>
                {isSelected && <Check size={15} className="ui-select-tick" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
