import { useState } from "react";
import type { CompletedHistoryItem } from "../types";

type Props = {
  items: CompletedHistoryItem[];
  onRestore: (itemId: string) => void;
};

export const CompletedHistory = ({ items, onRestore }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <section className="completed-history">
      <button
        type="button"
        className="completed-history__toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        Recently completed ({items.length})
      </button>
      {isOpen && (
        <ul className="completed-history__list">
          {items.map((item) => (
            <li key={item.id} className="completed-history__item">
              <span className="completed-history__meta">
                {item.groupTitle} ·{" "}
                {new Date(item.completedAt).toLocaleDateString()}
              </span>
              <span className="completed-history__text">{item.text}</span>
              <button
                type="button"
                className="completed-history__restore"
                onClick={() => onRestore(item.id)}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
