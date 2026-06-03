import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useSpawnLoot } from "../effects/useSpawnLoot";

type Props = {
  text: string;
  onComplete: () => void;
  onEdit: (text: string) => void;
};

export const TodoRow = ({ text, onComplete, onEdit }: Props) => {
  const checkboxBoxRef = useRef<HTMLSpanElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const spawnLoot = useSpawnLoot();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    if (!isEditing) return;
    const input = editInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isEditing]);

  const handleComplete = () => {
    const box = checkboxBoxRef.current;
    if (box) {
      const rect = box.getBoundingClientRect();
      spawnLoot({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    onComplete();
  };

  const startEditing = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    setDraft(text);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) {
      onEdit(trimmed);
    }
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(text);
      setIsEditing(false);
    }
  };

  return (
    <li className="todo-row">
      <label className="todo-row__check">
        <input
          type="checkbox"
          className="todo-row__checkbox"
          onChange={handleComplete}
          aria-label={`Complete: ${text}`}
        />
        <span
          ref={checkboxBoxRef}
          className="todo-row__checkbox-box"
          aria-hidden
        >
          <svg
            className="todo-row__checkbox-icon"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </label>
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          className="todo-row__edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleEditKeyDown}
          aria-label="Edit todo"
        />
      ) : (
        <span
          className="todo-row__text"
          onClick={startEditing}
          title="Click to edit"
        >
          {text}
        </span>
      )}
    </li>
  );
};
