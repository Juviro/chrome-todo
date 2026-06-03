import { useState, type KeyboardEvent, type Ref } from "react";

type Props = {
  onAdd: (text: string) => void;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
};

export const TodoInput = ({
  onAdd,
  placeholder = "Add a todo…",
  ref,
}: Props) => {
  const [value, setValue] = useState("");

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const text = value.trim();
    if (!text) return;
    onAdd(text);
    setValue("");
  };

  return (
    <input
      ref={ref}
      type="text"
      className="todo-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label="Add todo"
    />
  );
};
