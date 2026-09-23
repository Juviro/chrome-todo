import { useState } from "react";
import { useAppState } from "./hooks/useAppState";
import { createDefaultGroup, createTodo } from "./storage/defaults";
import { generateRandomTodo } from "./random/generateRandomTodo";
import { completeTodoInState } from "./history/completeTodo";
import { deleteGroupInState } from "./history/deleteGroup";
import { moveGroupInState } from "./groups/reorderGroups";
import { exportBackup } from "./backup/exportBackup";
import { parseBackupFile } from "./backup/importBackup";
import { markBackedUp } from "./backup/markBackedUp";
import { Toolbar } from "./components/Toolbar";
import { GroupCard } from "./components/GroupCard";
import { AddGroupCard } from "./components/AddGroupCard";
import { CompletedHistory } from "./components/CompletedHistory";
import "./styles/app.scss";

const App = () => {
  const { state, updateState, replaceState, isLoading, syncStatus } =
    useAppState();
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);

  if (isLoading || !state) {
    return (
      <div className="app app--loading">
        <p className="app__loading-text">Loading…</p>
      </div>
    );
  }

  const handleAddGroup = () => {
    const newGroup = { ...createDefaultGroup(), title: "" };
    updateState((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
    }));
    setFocusGroupId(newGroup.id);
  };

  const handleAddTodo = (groupId: string, text: string) => {
    const todo = createTodo(text);
    updateState((prev) => ({
      ...prev,
      groups: prev.groups.map((group) =>
        group.id === groupId
          ? { ...group, todos: [...group.todos, todo] }
          : group,
      ),
    }));
  };

  const handleCompleteTodo = (groupId: string, todoId: string) => {
    updateState((prev) => completeTodoInState(prev, groupId, todoId));
  };

  const handleEditTodo = (groupId: string, todoId: string, text: string) => {
    updateState((prev) => ({
      ...prev,
      groups: prev.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              todos: group.todos.map((todo) =>
                todo.id === todoId ? { ...todo, text } : todo,
              ),
            }
          : group,
      ),
    }));
  };

  const handleAddRandomTodo = () => {
    updateState((prev) => {
      if (prev.groups.length === 0) return prev;
      const randomGroup =
        prev.groups[Math.floor(Math.random() * prev.groups.length)];
      const todo = createTodo(generateRandomTodo());
      return {
        ...prev,
        groups: prev.groups.map((group) =>
          group.id === randomGroup.id
            ? { ...group, todos: [...group.todos, todo] }
            : group,
        ),
      };
    });
  };

  const handleGroupDragStart = (groupId: string) => {
    setDraggingGroupId(groupId);
  };

  const handleGroupDragOver = (targetGroupId: string) => {
    if (!draggingGroupId || draggingGroupId === targetGroupId) return;
    updateState((prev) =>
      moveGroupInState(prev, draggingGroupId, targetGroupId),
    );
  };

  const handleGroupDragEnd = () => {
    setDraggingGroupId(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    const confirmed = window.confirm(
      `Delete "${group?.title ?? "this group"}"? Open todos will be marked as done.`,
    );
    if (!confirmed) return;
    updateState((prev) => deleteGroupInState(prev, groupId));
  };

  const handleRestoreFromHistory = (itemId: string) => {
    updateState((prev) => {
      const item = prev.completedHistory.find((h) => h.id === itemId);
      if (!item) return prev;

      const targetGroup =
        prev.groups.find((g) => g.id === item.groupId) ?? prev.groups[0];
      if (!targetGroup) return prev;

      const todo = createTodo(item.text);

      return {
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === targetGroup.id
            ? { ...g, todos: [...g.todos, todo] }
            : g,
        ),
        completedHistory: prev.completedHistory.filter(
          (h) => h.id !== itemId,
        ),
      };
    });
  };

  const handleTitleChange = (groupId: string, title: string) => {
    updateState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, title } : g,
      ),
    }));
  };

  const handleNotesChange = (groupId: string, notes: string) => {
    updateState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, notes } : g,
      ),
    }));
  };

  const handleDownloadBackup = () => {
    exportBackup(state);
    updateState(markBackedUp);
  };

  const handleRestoreBackup = async (file: File) => {
    const text = await file.text();
    const parsed = parseBackupFile(text);
    if (!parsed) {
      window.alert("Invalid backup file. Please choose a valid JSON backup.");
      return;
    }
    const confirmed = window.confirm(
      "Replace all current todos and notes with this backup? This also replaces them on your other synced devices.",
    );
    if (!confirmed) return;
    replaceState(parsed);
  };

  return (
    <div className="app">
      <div className="app__inner">
        <Toolbar
          onAddRandomTodo={handleAddRandomTodo}
          onDownloadBackup={handleDownloadBackup}
          onRestoreBackup={handleRestoreBackup}
          syncStatus={syncStatus}
        />
        <main className="app__main">
          {state.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onTitleChange={(title) => handleTitleChange(group.id, title)}
              onNotesChange={(notes) => handleNotesChange(group.id, notes)}
              onAddTodo={(text) => handleAddTodo(group.id, text)}
              onCompleteTodo={(todoId) =>
                handleCompleteTodo(group.id, todoId)
              }
              onEditTodo={(todoId, text) =>
                handleEditTodo(group.id, todoId, text)
              }
              onDelete={() => handleDeleteGroup(group.id)}
              autoFocusTitle={focusGroupId === group.id}
              onTitleFocused={() => setFocusGroupId(null)}
              isDragging={draggingGroupId === group.id}
              onDragStartGroup={() => handleGroupDragStart(group.id)}
              onDragOverGroup={() => handleGroupDragOver(group.id)}
              onDragEndGroup={handleGroupDragEnd}
            />
          ))}
          <AddGroupCard onAddGroup={handleAddGroup} />
        </main>
        <CompletedHistory
          items={state.completedHistory}
          onRestore={handleRestoreFromHistory}
        />
      </div>
    </div>
  );
};

export default App;
