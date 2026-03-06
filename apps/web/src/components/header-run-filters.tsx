interface HeaderRunFiltersProps {
  runsStatusFilter: "all" | "running" | "finished";
  setRunsStatusFilter: (value: "all" | "running" | "finished") => void;
  runsSortOrder: "updatedDesc" | "updatedAsc";
  setRunsSortOrder: (value: "updatedDesc" | "updatedAsc") => void;
}

export function HeaderRunFilters({
  runsStatusFilter,
  setRunsStatusFilter,
  runsSortOrder,
  setRunsSortOrder
}: HeaderRunFiltersProps): JSX.Element {
  return (
    <>
      <label>
        Status
        <select
          value={runsStatusFilter}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "running" || value === "finished") {
              setRunsStatusFilter(value);
              return;
            }

            setRunsStatusFilter("all");
          }}
        >
          <option value="all">All</option>
          <option value="running">Running</option>
          <option value="finished">Finished</option>
        </select>
      </label>
      <label>
        Sort
        <select
          value={runsSortOrder}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "updatedAsc") {
              setRunsSortOrder("updatedAsc");
              return;
            }

            setRunsSortOrder("updatedDesc");
          }}
        >
          <option value="updatedDesc">Updated ↓</option>
          <option value="updatedAsc">Updated ↑</option>
        </select>
      </label>
    </>
  );
}