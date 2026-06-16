import { useState } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Trash2 } from 'lucide-react';
import { ListItem } from '../components/ListItem';
import { AddSourceForm } from '../components/AddSourceForm';
import { useSources, type Source } from '../useSources';

type SourceRowProps = {
  source: Source;
  onRemove: () => void;
};

// A single configured source. Shares the focus styling language of ListItem but
// shows the source's name + path, and removes the source on OK — surfaced by
// the "Remove" affordance that appears while focused.
function SourceRow({ source, onRemove }: SourceRowProps) {
  const { ref, focused } = useFocusable({ onEnterPress: onRemove });

  return (
    <div
      ref={ref}
      className={[
        'flex items-center justify-between gap-4 rounded-xl px-6 py-5 transition-all duration-150',
        focused
          ? 'scale-[1.02] bg-white text-black ring-4 ring-sky-400'
          : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xl font-medium">{source.name}</span>
        <span
          className={[
            'truncate text-sm',
            focused ? 'text-neutral-500' : 'text-neutral-400',
          ].join(' ')}
        >
          {source.path}
        </span>
      </div>
      <span
        className={[
          'flex shrink-0 items-center gap-2 text-sm font-medium',
          focused ? 'text-red-600' : 'text-neutral-500',
        ].join(' ')}
      >
        <Trash2 className="h-5 w-5" />
        {focused && <span>Remove</span>}
      </span>
    </div>
  );
}

export function Sources() {
  const { sources, addSource, removeSource } = useSources();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h2 className="px-1 text-lg font-semibold text-neutral-400">
        Your sources
      </h2>
      {sources.length === 0 && (
        <p className="px-1 text-neutral-500">
          No sources yet. Add one to get started.
        </p>
      )}
      {sources.map((s) => (
        <SourceRow key={s.id} source={s} onRemove={() => removeSource(s.id)} />
      ))}
      <ListItem label="+ Add source" onSelect={() => setAdding(true)} />

      {adding && (
        <AddSourceForm onAdd={addSource} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
