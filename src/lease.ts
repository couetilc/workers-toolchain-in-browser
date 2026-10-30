/** One editing tab owns the SAH pool. The browser releases the lock on tab exit. */
export function acquireLease(name: string, locks = navigator.locks) {
  return new Promise<() => void>((resolve, reject) => {
    void locks.request(name, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('This workspace is open in another tab. Close that tab and retry.')); return; }
      await new Promise<void>(release => resolve(release));
    }).catch(reject);
  });
}
