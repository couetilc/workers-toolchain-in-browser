self.onmessage = () => { throw new Error('Intentional worker crash'); };
export {};
