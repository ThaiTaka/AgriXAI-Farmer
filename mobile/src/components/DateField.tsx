import DateTimePicker from '@react-native-community/datetimepicker';
import React, {useState} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';

import {formatDate} from '../utils/format';
import {PickerField} from './form';
import {CalendarIcon} from './icons';

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  maximumDate?: Date;
  hint?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A PickerField that opens the platform date picker. Stores epoch ms at local noon. */
export function DateField({label, value, onChange, maximumDate, hint, error, style, testID}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerField
        testID={testID}
        label={label}
        value={value ? formatDate(value) : ''}
        placeholder="Chọn ngày"
        onPress={() => setOpen(true)}
        icon={<CalendarIcon />}
        hint={hint}
        error={error}
        style={style}
      />
      {open ? (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          maximumDate={maximumDate}
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === 'set' && selected) {
              // Noon keeps the calendar date stable across time-zone maths.
              const d = new Date(selected);
              d.setHours(12, 0, 0, 0);
              onChange(d.getTime());
            }
          }}
        />
      ) : null}
    </>
  );
}
