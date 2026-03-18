import { useState, useRef, useCallback } from "react";

const UNDO_WINDOW_MS = 5000;

export function useUndo(onRestore) {
  const [undoItem, setUndoItem] = useState(null); // { id, label, snapshot, timeoutId }
  const timeoutRef = useRef(null);

  const push = useCallback((id, label, snapshot) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setUndoItem(null), UNDO_WINDOW_MS);

    setUndoItem({ id, label, snapshot, startedAt: Date.now() });
  }, []);

  const undo = useCallback(() => {
    if (!undoItem) return;
    clearTimeout(timeoutRef.current);
    onRestore(undoItem.id, undoItem.snapshot);
    setUndoItem(null);
  }, [undoItem, onRestore]);

  const dismiss = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setUndoItem(null);
  }, []);

  return { undoItem, push, undo, dismiss, UNDO_WINDOW_MS };
}
