import { ListItem } from '../components/ListItem';

// Placeholder content — real search lands later.
export function Search() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="px-1 text-lg font-semibold text-neutral-400">Search</h2>
      <ListItem label="Search your library…" />
    </div>
  );
}
