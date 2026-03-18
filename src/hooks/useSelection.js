import { useState, useCallback } from "react";

export function useSelection() {
  const [selected, setSelected] = useState(new Set());

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  return { selected, toggle, selectAll, clear, isSelected, count: selected.size };
}
