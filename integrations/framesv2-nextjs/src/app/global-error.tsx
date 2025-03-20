'use client';

import * as React from 'react';
import Error from 'next/error';

export type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError(
  props: GlobalErrorProps
): React.JSX.Element {
  React.useEffect(() => {
    // For example
    // Sentry.captureException(props.error);
  }, [props.error]);

  return (
    <html>
      <body>
        {/* This is the default Next.js error component but it doesn't allow omitting the statusCode property yet. */}
        <Error statusCode={undefined as never} />
      </body>
    </html>
  );
}
