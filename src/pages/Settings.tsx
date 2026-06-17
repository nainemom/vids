import { Header } from '../components/Header';
import { Page } from '../components/Page';
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
    <Page header={<Header title="Settings" />}>
      <div className="flex flex-col gap-4">
        {SETTINGS.map((s) => (
          <ListItem key={s.label} label={s.label} hint={s.hint} />
        ))}
      </div>
    </Page>
  );
}
