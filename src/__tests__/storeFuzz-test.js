// @flow

const prettyFormatPkg = require('pretty-format');
function prettyFormat(thing) {
  return prettyFormatPkg(thing, {
    plugins: [
      prettyFormatPkg.plugins.ReactElement,
      prettyFormatPkg.plugins.ReactTestComponent,
    ],
  });
}

describe('StoreFuzz', () => {
  let React;
  let ReactDOM;
  let TestUtils;
  let store;
  let print;
  let random;

  const act = (callback: Function) => {
    TestUtils.act(() => {
      callback();
    });

    jest.runAllTimers(); // Flush Bridge operations
  };

  beforeEach(() => {
    store = global.store;

    React = require('react');
    ReactDOM = require('react-dom');
    TestUtils = require('react-dom/test-utils');
    print = require('./storeSerializer').print;
    random = require('random-seed').create(0);
  });

  const A = ({children}) => children || 'A';
  const B = ({children}) => children || 'B';
  const C = ({children}) => children || 'C';

  function makeRandomNode(key, mustBeLeaf) {
    let props = {};
    if (!mustBeLeaf && random.floatBetween(0, 1) < 0.25) {
      props.children = makeRandomNode('', true);
    }

    let i = random.intBetween(0, 2);
    switch (i) {
      case 0:
        return <A key={key} {...props} />;
      case 1:
        return <B key={key} {...props} />;
      case 2:
        return <C key={key} {...props} />;
      default:
        throw new Error('Unexpected');
    }
  }

  function makeRandomChildren() {
    let children = [];
    let length = random.intBetween(0, 4);
    for (let i = 0; i < length; i++) {
      const element = makeRandomNode(i, false);
      children.push(element);
    }
    return <React.Fragment>{children}</React.Fragment>;
  }

  function Root({children}) {
    return children;
  }

  function execute(actions) {
    let container = document.createElement('div');
    for (let action of actions) {
      switch (action.type) {
        case 'render':
          act(() => ReactDOM.render(<Root>{action.children}</Root>, container));
          break;
        default:
          throw new Error('Not implemented');
      }
    }
  }
  
  // TODO

  fit('lol', () => {
    let sequences = [];
    for (let i = 0; i < 500; i++) {
      sequences.push(makeRandomChildren());
    }

    let mountSnapshots = [];
    for (let i = 0; i < sequences.length; i++) {
      const container = document.createElement('div');
      const sequence = sequences[i];
      act(() => ReactDOM.render(<Root>{sequence}</Root>, container));

      const snapshot = print(store);
      mountSnapshots.push(snapshot);

      act(() => ReactDOM.unmountComponentAtNode(container));      
      expect(print(store)).toBe('');
    }

    let reusedContainer = document.createElement('div');
    for (let i = 0; i < sequences.length; i++) {
      const sequence = sequences[i];
      act(() => ReactDOM.render(<Root>{sequence}</Root>, reusedContainer));
      const snapshot = print(store);
      const mountSnapshot = mountSnapshots[i];
      try {
        expect(snapshot).toEqual(mountSnapshot);
      } catch (err) {
        console.error(
          'Error between ' + prettyFormat(sequence)
        );
        throw err;
      }
    }
    act(() => ReactDOM.unmountComponentAtNode(reusedContainer));      
    expect(print(store)).toBe('');    
  });
});
