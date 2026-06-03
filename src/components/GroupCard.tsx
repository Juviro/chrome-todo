import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Group } from "../types";
import { useScrollOverflow } from "../hooks/useScrollOverflow";
import { TodoInput } from "./TodoInput";
import { TodoRow } from "./TodoRow";

const INTERACTIVE_SELECTOR = "input, textarea, button, label, a";

type Props = {
  group: Group;
  onTitleChange: (title: string) => void;
  onNotesChange: (notes: string) => void;
  onAddTodo: (text: string) => void;
  onCompleteTodo: (todoId: string) => void;
  onEditTodo: (todoId: string, text: string) => void;
  onDelete: () => void;
  autoFocusTitle: boolean;
  onTitleFocused: () => void;
  isDragging: boolean;
  onDragStartGroup: () => void;
  onDragOverGroup: () => void;
  onDragEndGroup: () => void;
};

export const GroupCard = ({
  group,
  onTitleChange,
  onNotesChange,
  onAddTodo,
  onCompleteTodo,
  onEditTodo,
  onDelete,
  autoFocusTitle,
  onTitleFocused,
  isDragging,
  onDragStartGroup,
  onDragOverGroup,
  onDragEndGroup,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [isDraggable, setIsDraggable] = useState(false);
  const activeTodos = group.todos.filter((todo) => todo.completedAt === null);
  const { ref: todoListRef, overflow } = useScrollOverflow<HTMLUListElement>([
    activeTodos.length,
  ]);

  useEffect(() => {
    if (!autoFocusTitle) return;
    titleRef.current?.focus();
    onTitleFocused();
  }, [autoFocusTitle, onTitleFocused]);

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    inputRef.current?.focus();
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    inputRef.current?.focus();
  };

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", group.id);
    onDragStartGroup();
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    onDragOverGroup();
  };

  const handleDragEnd = () => {
    setIsDraggable(false);
    onDragEndGroup();
  };

  const sectionClassName = isDragging
    ? "group-card group-card--dragging"
    : "group-card";

  return (
    <section
      className={sectionClassName}
      onClick={handleCardClick}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={handleDragEnd}
    >
      <div className="group-card__header">
        <button
          type="button"
          className="group-card__drag-handle"
          aria-label={`Reorder group ${group.title}`}
          title="Drag to reorder"
          onMouseDown={() => setIsDraggable(true)}
          onMouseUp={() => setIsDraggable(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="5" cy="3" r="1.4" />
            <circle cx="11" cy="3" r="1.4" />
            <circle cx="5" cy="8" r="1.4" />
            <circle cx="11" cy="8" r="1.4" />
            <circle cx="5" cy="13" r="1.4" />
            <circle cx="11" cy="13" r="1.4" />
          </svg>
        </button>
        <input
          ref={titleRef}
          type="text"
          className="group-card__title"
          value={group.title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Group name"
          aria-label="Group title"
        />
        <button
          type="button"
          className="group-card__delete"
          onClick={onDelete}
          aria-label={`Delete group ${group.title}`}
          title="Delete group"
        >
          ×
        </button>
      </div>
      <TodoInput ref={inputRef} onAdd={onAddTodo} />
      {activeTodos.length > 0 && (
        <ul
          ref={todoListRef}
          className="group-card__todo-list"
          data-can-scroll-up={overflow.canScrollUp}
          data-can-scroll-down={overflow.canScrollDown}
        >
          {activeTodos.map((todo) => (
            <TodoRow
              key={todo.id}
              text={todo.text}
              onComplete={() => onCompleteTodo(todo.id)}
              onEdit={(text) => onEditTodo(todo.id, text)}
            />
          ))}
        </ul>
      )}
      <textarea
        className="group-card__notes"
        value={group.notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Notes, links…"
        aria-label={`Notes for ${group.title}`}
        rows={3}
      />
    </section>
  );
};
