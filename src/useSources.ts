import { useEffect, useState } from 'react';

// The kind of backend a source points at. Only `local` is wired up in the UI
// today; `ssh` (a remote server) is modelled here and lands later. Add the tag
// here and a matching member to the `Source` union below for each new type.
export type SourceType = 'local' | 'ssh';

/** Fields shared by every source, regardless of type. */
type SourceBase = {
  /** Stable unique id, assigned on creation. */
  id: string;
  /** User-given display name. */
  name: string;
};

/** A source backed by a folder on the local filesystem. */
export type LocalSource = SourceBase & {
  type: 'local';
  /** Absolute path to the folder. */
  path: string;
};

/** A source backed by a folder on a remote server, reached over SSH. */
export type SshSource = SourceBase & {
  type: 'ssh';
  /** Hostname or IP of the remote server. */
  host: string;
  /** SSH port; defaults to 22 when omitted. */
  port?: number;
  /** Login user. */
  user: string;
  /** Password auth; omitted when relying on key-based auth. */
  password?: string;
  /** Absolute path to the folder on the remote. */
  path: string;
};

/**
 * A configured media source. This is a discriminated union keyed on `type` —
 * narrow on `source.type` to access the type-specific fields. Add a new member
 * here (plus its tag in `SourceType`) to support a new kind of source.
 */
export type Source = LocalSource | SshSource;

// --- Add-source form schema -------------------------------------------------
// The form is generated from these descriptors so it stays generic: to support
// a new source type, add its `Source` union member above, list it in
// SOURCE_TYPES, give it fields in SOURCE_FIELDS, and handle it in buildSource.

/** How a field is rendered/collected in the add-source form. */
export type SourceFieldKind = 'text' | 'password';

export type SourceFieldDef = {
  /** Key the value is stored under, and the property it maps to on the Source. */
  key: string;
  label: string;
  kind: SourceFieldKind;
  required?: boolean;
  placeholder?: string;
};

/** Source types, in the order shown in the type picker. */
export const SOURCE_TYPES: {
  type: SourceType;
  label: string;
  /** Shown greyed-out and not selectable (the schema exists but isn't wired up yet). */
  disabled?: boolean;
}[] = [
  { type: 'local', label: 'Local' },
  { type: 'ssh', label: 'SSH', disabled: true },
];

/** The type-specific fields collected after a type is chosen (`name` is shared). */
export const SOURCE_FIELDS: Record<SourceType, SourceFieldDef[]> = {
  local: [
    {
      key: 'path',
      label: 'Folder',
      kind: 'text',
      required: true,
      placeholder: '~/Videos',
    },
  ],
  ssh: [
    {
      key: 'host',
      label: 'Host',
      kind: 'text',
      required: true,
      placeholder: '192.168.1.10',
    },
    { key: 'port', label: 'Port', kind: 'text', placeholder: '22' },
    { key: 'user', label: 'User', kind: 'text', required: true, placeholder: 'user' },
    {
      key: 'password',
      label: 'Password',
      kind: 'password',
      placeholder: 'Leave empty for key auth',
    },
    {
      key: 'path',
      label: 'Path',
      kind: 'text',
      required: true,
      placeholder: '/home/user/Videos',
    },
  ],
};

/**
 * Builds a fully-typed Source from the raw string values the form collected.
 * This is the one place that knows how to assemble each type (e.g. parsing the
 * SSH port and dropping empty optional fields); the `never` default flags any
 * new type that isn't handled here.
 */
export function buildSource(
  type: SourceType,
  name: string,
  values: Record<string, string>,
): Source {
  const id = crypto.randomUUID();
  switch (type) {
    case 'local':
      return { id, name, type, path: values.path };
    case 'ssh':
      return {
        id,
        name,
        type,
        host: values.host,
        user: values.user,
        path: values.path,
        ...(values.port ? { port: Number(values.port) } : {}),
        ...(values.password ? { password: values.password } : {}),
      };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Reads and mutates the list of configured sources, persisting every change to
 * ~/.config/vids/sources.json via the main process. Each mutation returns a new
 * array so React re-renders.
 */
export function useSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load once on mount from disk.
  useEffect(() => {
    let mounted = true;
    window.app?.readSources().then((stored) => {
      if (mounted) {
        setSources(stored);
        setLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist on change — but only after the initial load, so the empty starting
  // state can't overwrite the file before it's been read.
  useEffect(() => {
    if (loaded) window.app?.writeSources(sources);
  }, [sources, loaded]);

  const addSource = (source: Source) => {
    setSources((prev) => [...prev, source]);
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  return { sources, addSource, removeSource };
}
