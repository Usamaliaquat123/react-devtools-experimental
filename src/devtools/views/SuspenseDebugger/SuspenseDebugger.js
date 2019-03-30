// @flow

import React, { useEffect, useState, useContext, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { BridgeContext, StoreContext } from '../context';
import { ElementTypeSuspense } from '../../types';

export type Props = {|
  portalContainer?: Element,
|};

export default function SuspenseDebugger({ portalContainer }: Props) {
  const children = (
    <div style={{ overflow: 'scroll' }}>
      <Debugger />
    </div>
  );

  return portalContainer != null
    ? createPortal(children, portalContainer)
    : children;
}

function Debugger() {
  const store = useContext(StoreContext);
  const bridge = useContext(BridgeContext);
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    store.addListener('mutated', forceUpdate);
    return () => store.removeListener('mutated', forceUpdate);
  }, [store]);

  function buildTree(cursor, element) {
    element.children.forEach(childID => {
      const child = store._idToElement.get(childID);
      if (child === undefined) {
        return;
      }
      if (child.type === ElementTypeSuspense) {
        buildTree(stepIn(cursor, child), child);
      } else {
        buildTree(cursor, child);
      }
    });
  }

  function stepIn(cursor, element) {
    let owner = store._idToElement.get(element.ownerID) || null;
    if (owner && owner.displayName && owner.displayName.indexOf('Placeholder') !== -1) {
      // Go deeper.
      owner = store._idToElement.get(owner.ownerID) || null;
    }
    let node = { nested: [], element, owner };
    cursor.nested.push(node);
    return node;
  }

  let tree = { nested: [], element: null, owner: null };
  store._roots.forEach(id => {
    const element = store._idToElement.get(id);
    if (element !== undefined) {
      buildTree(tree, element);
    }
  });

  return (
    <ul>
      {tree.nested.map(node =>
        <SuspenseNode
          key={node.element.id}
          element={node.element}
          nested={node.nested}
          owner={node.owner}
          bridge={bridge}
          store={store}
          node={node}
        />
      )}
    </ul>
  )
}

function SuspenseNode({ bridge, store, element, nested, owner, isInHiddenTree }) {
  // TODO: we need to actually know if we're toggled.
  // This can be wrong.
  let [expanded, setExpanded] = useState(true);
  return (
    <li style={{ userSelect: 'none' }}>
      <label>
        <input
          type="checkbox"
          disabled={isInHiddenTree}
          checked={expanded}
          onChange={e => {
            setExpanded(!expanded);
            const rendererID = store.getRendererIDForElement(element.id);
            bridge.send('toggleSuspense', {
             id: element.id,
             rendererID,
            });
          }}
        />
        <span style={{ opacity: isInHiddenTree ? 0.5 : 1 }}>
          {element.displayName} {owner && owner.displayName && `(from ${owner.displayName})`}
        </span>
      </label>
      {nested.length > 0 &&
        <ul>
          {nested.map(child =>
            <SuspenseNode
              key={child.element.id}
              element={child.element}
              nested={child.nested}
              owner={child.owner}
              bridge={bridge}
              store={store}
              node={child}
              isInHiddenTree={isInHiddenTree || !expanded}
            />
          )}
        </ul>
      }
    </li>
  );
}
