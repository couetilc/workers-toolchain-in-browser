import { useState } from 'react';
import { count, settings } from './values';

export const initial: number = count;
export function Counter() {
  const [value, setValue] = useState(initial);
  return <button onClick={() => setValue(value + 1)}>{settings.title}: {value}</button>;
}
