// @flow

import React from 'react';
import { createPortal } from 'react-dom';

export type Props = {|
  portalContainer?: Element,
|};

export default function Elements({ portalContainer }: Props) {
  const children = <div>TODO</div>;

  return portalContainer != null
    ? createPortal(children, portalContainer)
    : children;
}
