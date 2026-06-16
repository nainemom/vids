import { ListItem } from '../components/ListItem';

// Placeholder content — real source management lands later. The rows are
// focusable so the remote can navigate into the page like everywhere else.
const SOURCES = [
  { label: 'Local Library', hint: '/home/media' },
  { label: 'Network Share', hint: 'smb://nas/movies' },
  { label: 'Jellyfin Server', hint: '192.168.1.10:8096' },
];

export function Sources() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h2 className="px-1 text-lg font-semibold text-neutral-400">
        Your sources
      </h2>
      {SOURCES.map((s) => (
        <ListItem key={s.label} label={s.label} hint={s.hint} />
      ))}
      <ListItem label="+ Add source" />
    </div>
  );
}
