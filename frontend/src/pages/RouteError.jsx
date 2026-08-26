import React from 'react'
import { useRouteError } from 'react-router-dom'

export default function RouteError() {
  const error = useRouteError()

  // React Router may provide ErrorResponseImpl objects when responses are thrown.
  // Normalize to display useful information to the user and avoid raw object dumps.
  let title = 'Something went wrong'
  let message = 'An unexpected error occurred.'
  let status = null

  if (!error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    )
  }

  // If it's a Response-like error (ErrorResponseImpl), try to read its fields
  // ErrorResponseImpl often exposes `status` and `statusText` and may include a `data` or `message`.
  if (typeof error === 'object') {
    status = error.status || error.statusCode || null
    if (status === 404) {
      title = '404 Not Found';
      message = 'The page or resource you are looking for does not exist.';
    } else {
      if (error.statusText) title = `${error.status} ${error.statusText}`;
      if (error.data && typeof error.data === 'object') {
        message = error.data.message || JSON.stringify(error.data);
      } else if (error.message) {
        message = error.message;
      } else if (error.statusText) {
        message = error.statusText;
      } else {
        try {
          message = JSON.stringify(error);
        } catch (e) {
          message = String(error);
        }
      }
    }
  } else {
    message = String(error);
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>{title}</h2>
      {status && <p><strong>Status:</strong> {status}</p>}
      <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 6 }}>{message}</pre>
    </div>
  )
}
