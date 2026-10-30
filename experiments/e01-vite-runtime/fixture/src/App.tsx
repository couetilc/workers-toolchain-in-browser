import { useState } from 'react';
import { message } from './message';

export default function App() {
  const [count, setCount] = useState(0);
  const [lazy, setLazy] = useState('Not loaded');
  return <main>
    <h1>Browser-built React</h1>
    <p>{message}</p>
    <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    <button onClick={async () => setLazy((await import('./lazy')).label)}>Load module</button>
    <p>{lazy}</p>
    <button onClick={() => { throw new Error('Fixture runtime error'); }}>Throw error</button>
  </main>;
}
