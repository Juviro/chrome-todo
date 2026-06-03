import { useRef, type ChangeEvent } from "react";

type Props = {
  onAddRandomTodo: () => void;
  onDownloadBackup: () => void;
  onRestoreBackup: (file: File) => void;
};

export const Toolbar = ({
  onAddRandomTodo,
  onDownloadBackup,
  onRestoreBackup,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onRestoreBackup(file);
    event.target.value = "";
  };

  return (
    <header className="toolbar">
      <h1 className="toolbar__heading">Todo</h1>
      <div className="toolbar__actions">
        <button
          type="button"
          className="toolbar__button"
          onClick={onAddRandomTodo}
          title="Add a random todo to a random group"
        >
          Surprise me
        </button>
        <button
          type="button"
          className="toolbar__button"
          onClick={onDownloadBackup}
        >
          Download backup
        </button>
        <button
          type="button"
          className="toolbar__button"
          onClick={() => fileInputRef.current?.click()}
        >
          Restore backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="toolbar__file-input"
          onChange={handleFileChange}
          aria-hidden
          tabIndex={-1}
        />
      </div>
    </header>
  );
};
