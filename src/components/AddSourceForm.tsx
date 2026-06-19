import { useEffect, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Dialog, type DialogAction } from './Dialog';
import { FocusableButton } from './FocusableButton';
import { FocusableField } from './FocusableField';
import {
  SOURCE_FIELDS,
  SOURCE_TYPES,
  buildSource,
  type Source,
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
 */
export function AddSourceForm({ onAdd, onClose }: AddSourceFormProps) {
  const [type, setType] = useState<SourceType | null>(null);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  // Step 1 focuses the type list; step 2 focuses the first field. Entered
  // values are kept across Back so re-picking the same type doesn't lose them.
  useEffect(() => {
    setFocus(type ? 'field-name' : FIRST_TYPE_KEY);
  }, [type]);

  const fields = type ? SOURCE_FIELDS[type] : [];
  const canSubmit =
    name.trim().length > 0 &&
    fields
      .filter((f) => f.required)
      .every((f) => (values[f.key] ?? '').trim().length > 0);

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!type || !canSubmit) return;
    onAdd(buildSource(type, name.trim(), values));
    onClose();
  };

  const typeLabel = SOURCE_TYPES.find((t) => t.type === type)?.label ?? '';
  const actions: DialogAction[] = type
    ? [
        {
          label: 'Back',
          icon: <ArrowLeft className="h-5 w-5" />,
          onPress: () => setType(null),
        },
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
        </>
      )}
    </Dialog>
  );
}
