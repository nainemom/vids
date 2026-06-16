import { ListItem } from '../components/ListItem';

// Placeholder content — real settings land later.
const SETTINGS = [
  { label: 'Autoplay next episode', hint: 'On' },
  { label: 'Subtitles', hint: 'English' },
  { label: 'Video quality', hint: 'Auto' },
  { label: 'Clear watch history' },
];

export function Settings() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="px-1 text-lg font-semibold text-neutral-400">Settings</h2>
      {SETTINGS.map((s) => (
        <ListItem key={s.label} label={s.label} hint={s.hint} />
      ))}
    </div>
  );
}
