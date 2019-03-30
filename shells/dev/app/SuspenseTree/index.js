// @flow

import React, { useState, Suspense } from 'react';

function SuspenseTree() {
  const [show, setShow] = useState(true);
  return (
    <>
      <button onClick={() => setShow(s => !s)}>Toggle tree</button>
      {show &&
        <>
          <h1>Suspense</h1>
          <Suspense fallback={<h2>Loading outer</h2>}>
            <Parent />
          </Suspense>
        </>
      }
    </>
  );
}

function Parent() {
  return (
    <div>
      <Suspense fallback={<h3>Loading inner 1</h3>}>
        <Child>Hello</Child>
      </Suspense>
      <Suspense fallback={<h3>Loading inner 2</h3>}>
        <Child>World</Child>
      </Suspense>
    </div>
  );
}

function Child({ children }) {
  return <p>{children}</p>;
}

export default SuspenseTree;
