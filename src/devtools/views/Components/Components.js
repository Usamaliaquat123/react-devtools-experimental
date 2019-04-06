// @flow

import React, { Suspense } from 'react';
import { createPortal } from 'react-dom';
import Tree from './Tree';
import SelectedElement from './SelectedElement';
import styles from './Components.css';

export type Props = {|
  portalContainer?: Element,
|};

export default function Components({ portalContainer }: Props) {
  // TODO Flex wrappers below should be user resizable.
  const children = (
    <div className={styles.Components}>
      <div className={styles.TreeWrapper}>
        <Tree />
      </div>
      <div className={styles.SelectedElementWrapper}>
        {/* TODO */}
        <Suspense fallback={null}>
          <SelectedElement />
        </Suspense>
      </div>
    </div>
  );

  return portalContainer != null
    ? createPortal(children, portalContainer)
    : children;
}
