self.onmessage = (event: MessageEvent<number>) => {
  const result = event.data > 0 ? 'positive' : 'nonpositive';
  self.postMessage(result);
};

export {};
