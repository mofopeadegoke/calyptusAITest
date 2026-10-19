import 'react';

declare module 'react' {
  interface CSSProperties {
    '--bar'?: string;
  }
}
