import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plug, Terminal, X } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Dialog, type DialogAction } from './Dialog';
import { FocusableButton } from './FocusableButton';
import { FocusableField } from './FocusableField';
import {
  SOURCE_FIELDS,
  SOURCE_TYPES,
  TRUST_REASONS,
  buildSource,
  type Source,
  type SshSource,
  type SshTestResult,
  type SourceType,
} from '../useSources';

/** Focus key of the first selectable type, used to focus step 1 on open / Back. */
const FIRST_TYPE_KEY = `source-type-${
  (SOURCE_TYPES.find((t) => !t.disabled) ?? SOURCE_TYPES[0]).type
}`;

type AddSourceFormProps = {
  onAdd: (source: Source) => void;
  onClose: () => void;
};

/**
 * Adds a source in two steps. Step 1 (`type === null`) only asks for the type;
 * choosing one advances to step 2, which shows the name + the type-specific
 * fields from SOURCE_FIELDS plus a Back button. Focus trapping, scrolling and
 * the footer buttons come from the generic Dialog.
 *
 * For SSH sources, step 2 also exposes a "Test" action that probes the server
 * and, when the host hasn't been trusted yet (or auth fails), offers "Connect in
 * terminal" — which hands off to the native `ssh` client so the user answers the
 * real trust prompt and logs in once. After that, Test confirms it's reachable.
 */
export function AddSourceForm({ onAdd, onClose }: AddSourceFormProps) {
  const [type, setType] = useState<SourceType | null>(null);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [test, setTest] = useState<SshTestResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1 focuses the type list; step 2 focuses the first field. Entered
  // values are kept across Back so re-picking the same type doesn't lose them.
  useEffect(() => {
    setFocus(type ? 'field-name' : FIRST_TYPE_KEY);
  }, [type]);

  // A stale "connected"/error result would mislead once the connection details
  // change, so clear it whenever they (or the type) do.
  useEffect(() => {
    setTest(null);
  }, [type, values.host, values.port, values.user, values.password, values.path]);

  const fields = type ? SOURCE_FIELDS[type] : [];
  const canSubmit =
    name.trim().length > 0 &&
    fields
      .filter((f) => f.required)
      .every((f) => (values[f.key] ?? '').trim().length > 0);

  // Testing/connecting only needs somewhere to log in — not a name, and not the
  // remote path (which is only needed to actually Add the source). Requiring the
  // path here left Test silently disabled while the user filled in the folder.
  const canTest =
    type === 'ssh' &&
    ['host', 'user'].every((k) => (values[k] ?? '').trim().length > 0);

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // A throwaway Source carrying just the connection details, for test/connect.
  const sshDraft = () => buildSource('ssh', name.trim() || 'SSH', values) as SshSource;

  const submit = () => {
    if (!type || !canSubmit) return;
    onAdd(buildSource(type, name.trim(), values));
    onClose();
  };

  const runTest = async () => {
    if (!canTest || busy) return;
    setBusy(true);
    const result = await window.app?.testSshSource(sshDraft());
    setTest(result ?? { ok: false, reason: 'unknown', message: 'SSH test is unavailable.' });
    setBusy(false);
  };

  const connectInTerminal = async () => {
    if (busy) return;
    setBusy(true);
    const res = await window.app?.openSshTerminal(sshDraft());
    if (res && !res.ok) {
      setTest({ ok: false, reason: 'unknown', message: res.message ?? 'Could not open a terminal.' });
    } else {
      setTest({
        ok: false,
        reason: 'untrusted',
        message: 'Opened a terminal. Trust the host (type "yes") and sign in, then press Test again.',
      });
    }
    setBusy(false);
  };

  const offerTerminal = type === 'ssh' && test && !test.ok && TRUST_REASONS.includes(test.reason);

  const typeLabel = SOURCE_TYPES.find((t) => t.type === type)?.label ?? '';
  const actions: DialogAction[] = type
    ? [
        {
          label: 'Back',
          icon: <ArrowLeft className="h-5 w-5" />,
          onPress: () => setType(null),
        },
        ...(type === 'ssh'
          ? [
              {
                label: busy ? 'Testing…' : 'Test',
                icon: <Plug className="h-5 w-5" />,
                disabled: !canTest || busy,
                onPress: runTest,
              },
            ]
          : []),
        {
          label: 'Add',
          icon: <Check className="h-5 w-5" />,
          disabled: !canSubmit,
          onPress: submit,
        },
      ]
    : [{ label: 'Cancel', icon: <X className="h-5 w-5" />, onPress: onClose }];

  return (
    <Dialog
      title={type ? `Add ${typeLabel} source` : 'Add source'}
      onClose={onClose}
      actions={actions}
    >
      {type === null ? (
        <div className="flex flex-col gap-3">
          {SOURCE_TYPES.map((t) => (
            <FocusableButton
              key={t.type}
              focusKey={`source-type-${t.type}`}
              label={t.label}
              disabled={t.disabled}
              onPress={() => setType(t.type)}
            />
          ))}
        </div>
      ) : (
        <>
          <FocusableField
            focusKey="field-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Movies"
          />
          {fields.map((f) => (
            <FocusableField
              key={f.key}
              label={f.label}
              type={f.kind === 'password' ? 'password' : 'text'}
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={(v) => setValue(f.key, v)}
            />
          ))}

          {test && (
            <p
              className={[
                'rounded-xl px-4 py-3 text-sm',
                test.ok
                  ? 'bg-green-950/60 text-green-300'
                  : 'bg-red-950/60 text-red-300',
              ].join(' ')}
            >
              {test.message}
            </p>
          )}

          {offerTerminal && (
            <FocusableButton
              label="Connect in terminal"
              icon={<Terminal className="h-5 w-5" />}
              onPress={connectInTerminal}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
